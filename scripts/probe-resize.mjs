/**
 * 尺寸变化探针：模拟宿主连续改变面板尺寸（mn.size 过渡），逐帧记录
 * SVG viewBox 与容器像素尺寸的偏差 —— 偏差 > 0.5px 就是「画面被拉伸/方框畸变」的那一帧。
 * 用法：node scripts/probe-resize.mjs
 */
import { chromium } from "playwright-core";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexUrl = pathToFileURL(join(root, "dist", "index.html")).href;

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const context = await browser.newContext({ viewport: { width: 420, height: 640 }, deviceScaleFactor: 2 });
const page = await context.newPage();
await page.addInitScript(() => {
  window.mn = {
    version: 1, currentMode: "workspace", lang: "zh-Hans", theme: "light",
    api: async () => ({}), call: async () => { throw new Error("no native"); }, on: () => {},
    fit: () => {}, height: () => {}, size: () => {}, mode: () => {}, close: () => {}, reload: () => {}, log: () => {},
  };
});
await page.route("**/pkg/assets/*", (route) =>
  route.fulfill({ path: join(root, "dist", "assets", route.request().url().split("/").pop()) }));
await page.goto(indexUrl);
await page.waitForSelector(".canvas-svg");
await page.waitForTimeout(400);

// 采样点：另注册一个 ResizeObserver（在主组件之后执行），读到的就是「本帧 paint 前」的状态
await page.evaluate(() => {
  window.__frames = [];
  const svg = document.querySelector(".canvas-svg");
  const sample = () => {
    const r = svg.getBoundingClientRect();
    const vb = (svg.getAttribute("viewBox") || "0 0 0 0").split(/\s+/).map(Number);
    window.__frames.push({
      w: Math.round(r.width * 10) / 10,
      h: Math.round(r.height * 10) / 10,
      vw: vb[2],
      vh: vb[3],
      dw: Math.round(Math.abs(r.width - vb[2]) * 10) / 10,
      dh: Math.round(Math.abs(r.height - vb[3]) * 10) / 10,
    });
  };
  window.__ro = new ResizeObserver(sample);
  window.__ro.observe(svg);
  sample();
});

// 连续改尺寸，模拟宿主的面板动画（宽 420→380，高 640→560，20 步）
for (let i = 1; i <= 20; i += 1) {
  await page.setViewportSize({ width: 420 - i * 2, height: 640 - i * 4 });
  await page.waitForTimeout(30);
}
await page.waitForTimeout(300);

const frames = await page.evaluate(() => { window.__ro.disconnect(); return window.__frames; });
const bad = frames.filter((f) => f.dw > 0.5 || f.dh > 0.5);
const maxDw = Math.max(...frames.map((f) => f.dw));
const maxDh = Math.max(...frames.map((f) => f.dh));
console.log(`采样帧数 ${frames.length}，拉伸帧（>0.5px）${bad.length}`);
console.log(`最大横向偏差 ${maxDw}px，最大纵向偏差 ${maxDh}px`);
if (bad.length) {
  console.log("前 5 个拉伸帧：");
  bad.slice(0, 5).forEach((f) => console.log(`  容器 ${f.w}×${f.h} vs viewBox ${f.vw}×${f.vh} → 偏差 ${f.dw}/${f.dh}`));
}

// 圆角是否裁切到位
const boxes = await page.evaluate(() => {
  const q = (sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; };
  const svg = document.querySelector(".canvas-svg");
  const vb = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
  return {
    root: q("#root"), panel: q(".panel"), stage: q(".stage"), canvasStage: q(".canvas-stage"),
    svg: q(".canvas-svg"), vb: `${vb[2]}x${vb[3]}`,
    svgClient: `${svg.clientWidth}x${svg.clientHeight}`,
    inner: `${window.innerWidth}x${window.innerHeight}`,
    bodyPad: getComputedStyle(document.body).padding,
  };
});
console.log("盒子尺寸：", JSON.stringify(boxes, null, 0));

const radius = await page.evaluate(() => {
  const root = document.getElementById("root");
  const cs = getComputedStyle(root);
  return { radius: cs.borderRadius, overflow: cs.overflow };
});
console.log("根容器：", JSON.stringify(radius));

await page.screenshot({ path: join(root, "shots", "probe-resize.png") });
await context.close();
await browser.close();
