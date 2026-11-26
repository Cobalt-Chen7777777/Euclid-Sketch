/**
 * 曲线缩放探针：画一条曲线 → 连续放大 → 逐步输出 path 的 d / bbox / viewBox，
 * 判断「放大后消失」是数据没了、算出 NaN，还是画到视野外。
 * 用法：node scripts/probe-zoom.mjs
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
const context = await browser.newContext({ viewport: { width: 520, height: 760 }, deviceScaleFactor: 2 });
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
await page.waitForTimeout(300);

const box = await page.locator(".canvas-svg").boundingBox();
const worldToPage = (wx, wy) => ({
  x: box.x + ((wx + 8) / 16) * box.width,
  y: box.y + ((8 - wy) / 16) * box.height,
});

// 曲线工具 → 3 点 → 同位置双击收尾
await page.locator('.rail-btn[title="曲线"]').click();
const pts = [worldToPage(-3, -1), worldToPage(0, 3), worldToPage(3, -1)];
for (const p of pts) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(150); }
await page.mouse.click(pts[2].x, pts[2].y);
await page.waitForTimeout(60);
await page.mouse.click(pts[2].x, pts[2].y);
await page.waitForTimeout(300);

const probe = async (label) => {
  const info = await page.evaluate(() => {
    const svg = document.querySelector(".canvas-svg");
    const vb = svg.getAttribute("viewBox");
    const paths = [...svg.querySelectorAll("path")].filter((p) => (p.getAttribute("d") || "").startsWith("M"));
    const last = paths[paths.length - 1];
    if (!last) return { vb, count: 0 };
    const d = last.getAttribute("d") || "";
    const bb = last.getBBox();
    const r = last.getBoundingClientRect();
    const sr = svg.getBoundingClientRect();
    const visible = r.right > sr.left && r.left < sr.right && r.bottom > sr.top && r.top < sr.bottom;
    return {
      vb, count: paths.length,
      dHead: d.slice(0, 60), dLen: d.length, nan: d.includes("NaN"),
      bbox: [bb.x, bb.y, bb.width, bb.height].map((n) => Math.round(n)),
      screen: [r.left - sr.left, r.top - sr.top, r.width, r.height].map((n) => Math.round(n)),
      visible, stroke: last.getAttribute("stroke-width"),
    };
  });
  console.log(`\n[${label}] viewBox=${info.vb} paths=${info.count}`);
  if (info.count) {
    console.log(`  nan=${info.nan} stroke=${info.stroke} dLen=${info.dLen}`);
    console.log(`  bbox(user)=${JSON.stringify(info.bbox)} screen=${JSON.stringify(info.screen)} visible=${info.visible}`);
    console.log(`  d=${info.dHead}…`);
  }
};

await probe("初始");
const c = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
await page.mouse.move(c.x, c.y);
for (let i = 1; i <= 120; i += 1) {
  await page.mouse.wheel(0, -160);
  await page.waitForTimeout(16);
  if (i % 20 === 0) await probe(`放大 ${i} 次`);
}
// 极限之后反向缩小，确认不会卡死
for (let i = 1; i <= 10; i += 1) {
  await page.mouse.wheel(0, 160);
  await page.waitForTimeout(16);
}
await probe("缩回 10 档");
await page.screenshot({ path: join(root, "shots", "probe-zoom.png") });
console.log("\n截图：shots/probe-zoom.png");

await context.close();
await browser.close();
