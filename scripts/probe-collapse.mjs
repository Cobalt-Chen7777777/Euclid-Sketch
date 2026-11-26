/**
 * 收起 / 展开时序探针：记录 mn.mode / mn.size 的调用序列。
 * 一次收起应该只动一次尺寸；展开后不应再被迷你条抢回小尺寸。
 * 用法：node scripts/probe-collapse.mjs
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
  window.__calls = [];
  window.mn = {
    version: 1, currentMode: "workspace", lang: "zh-Hans", theme: "light",
    api: async () => ({}), call: async () => { throw new Error("no native"); }, on: () => {},
    fit: () => {}, height: () => {}, reload: () => {}, log: () => {},
    mode: (m) => {
      window.__calls.push(["mode", m]);
      // 宿主行为：改 data-mode（同步）
      document.documentElement.setAttribute("data-mode", m);
    },
    size: (w, h) => { window.__calls.push(["size", `${w}x${h}`]); },
    close: () => {},
  };
});
await page.route("**/pkg/assets/*", (route) =>
  route.fulfill({ path: join(root, "dist", "assets", route.request().url().split("/").pop()) }));
await page.goto(indexUrl);
await page.waitForSelector(".canvas-svg");
await page.waitForTimeout(500);

const dump = async (label) => {
  const calls = await page.evaluate(() => window.__calls.splice(0));
  console.log(`\n[${label}]`);
  calls.forEach((c) => console.log(`  ${c[0]}  ${c[1]}`));
  if (!calls.length) console.log("  （无调用）");
};

await dump("初始化");

// 收起
await page.locator('.appbar button[aria-label="收起插件窗口"]').click();
await page.waitForTimeout(900);
await dump("收起（期望：mode mini + 一次条尺寸）");

// 展开：迷你条里的「展开」按钮
await page.locator('.mini-bar .mini-btn').first().click();
await page.waitForTimeout(900);
await dump("展开（期望：mode workspace + 一次记忆尺寸，之后不再有 size）");

console.log("\n最终 data-mode：", await page.evaluate(() => document.documentElement.getAttribute("data-mode")));
await context.close();

// ---------- 变体：宿主不写 data-mode（真机上出现过的情形） ----------
{
  const ctx2 = await browser.newContext({ viewport: { width: 420, height: 640 }, deviceScaleFactor: 2 });
  const p2 = await ctx2.newPage();
  await p2.addInitScript(() => {
    window.__calls = [];
    window.mn = {
      version: 1, currentMode: "workspace", lang: "zh-Hans", theme: "light",
      api: async () => ({}), call: async () => { throw new Error("no native"); }, on: () => {},
      fit: () => {}, height: () => {}, reload: () => {}, log: () => {}, close: () => {},
      mode: (m) => { window.__calls.push(["mode", m]); }, // ← 故意不写 data-mode
      size: (w, h) => { window.__calls.push(["size", `${w}x${h}`]); },
    };
  });
  await p2.route("**/pkg/assets/*", (route) =>
    route.fulfill({ path: join(root, "dist", "assets", route.request().url().split("/").pop()) }));
  await p2.goto(indexUrl);
  await p2.waitForSelector(".canvas-svg");
  await p2.waitForTimeout(400);
  await p2.evaluate(() => { window.__calls.length = 0; });
  await p2.locator('.appbar button[aria-label="收起插件窗口"]').click();
  await p2.waitForTimeout(900);
  const state = await p2.evaluate(() => {
    const bar = document.querySelector(".mini-bar");
    const cs = bar ? getComputedStyle(bar) : null;
    const r = bar ? bar.getBoundingClientRect() : null;
    return {
      dataMode: document.documentElement.getAttribute("data-mode"),
      barDisplay: cs?.display ?? "无元素",
      barSize: r ? `${Math.round(r.width)}x${Math.round(r.height)}` : "-",
      bodyPad: getComputedStyle(document.body).padding,
      calls: window.__calls,
    };
  });
  console.log("\n[宿主不写 data-mode 时收起]");
  console.log("  data-mode =", state.dataMode, "| mini-bar display =", state.barDisplay, "| 尺寸 =", state.barSize);
  console.log("  body padding =", state.bodyPad);
  console.log("  调用 =", JSON.stringify(state.calls));
  await p2.screenshot({ path: join(root, "shots", "probe-collapsed.png") });
  await ctx2.close();
}

await browser.close();
