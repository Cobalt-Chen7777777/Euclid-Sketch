/**
 * 迷你条外观截图：按目标面板尺寸渲染 mini 模式，横/竖两态。
 * 用法：node scripts/shot-mini.mjs
 */
import { chromium } from "playwright-core";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexUrl = pathToFileURL(join(root, "dist", "index.html")).href;

const CASES = [
  { name: "h", w: 260, h: 52, v: false },
  { name: "v", w: 52, h: 260, v: true },
];

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});

for (const c of CASES) {
  const context = await browser.newContext({ viewport: { width: 420, height: 640 }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.mn = {
      version: 1, currentMode: "workspace", lang: "zh-Hans", theme: "light",
      api: async () => ({}),
      call: async () => { throw new Error("no native"); },
      on: () => {},
      fit: () => {}, height: () => {}, size: () => {}, mode: () => {}, close: () => {}, reload: () => {}, log: () => {},
    };
  });
  await page.route("**/pkg/assets/*", (route) =>
    route.fulfill({ path: join(root, "dist", "assets", route.request().url().split("/").pop()) }));
  await page.goto(indexUrl);
  await page.waitForTimeout(300);

  if (c.v) {
    await page.locator(".appnav button:has-text('设置')").click();
    await page.waitForTimeout(200);
    await page.locator('.choice button:has-text("竖向")').click();
    await page.waitForTimeout(150);
  }
  // 进入 mini 态（真实环境由宿主设置 data-mode），再把视口收紧到目标面板尺寸
  await page.evaluate(() => document.documentElement.setAttribute("data-mode", "mini"));
  await page.setViewportSize({ width: c.w, height: c.h });
  await page.waitForTimeout(400);

  const info = await page.locator(".mini-bar").evaluate((el) => {
    const bar = el.getBoundingClientRect();
    const kids = [...el.children].map((k) => {
      const r = k.getBoundingClientRect();
      return `${k.className || k.tagName}:${Math.round(r.width)}x${Math.round(r.height)}@${Math.round(r.x - bar.x)},${Math.round(r.y - bar.y)}`;
    });
    return { bar: `${Math.round(bar.width)}x${Math.round(bar.height)}`, kids };
  });
  await page.screenshot({ path: join(root, "shots", `mini-${c.name}.png`) });
  console.log(`\n[${c.name}] bar=${info.bar}`);
  info.kids.forEach((k) => console.log("   " + k));
  await context.close();
}

await browser.close();
