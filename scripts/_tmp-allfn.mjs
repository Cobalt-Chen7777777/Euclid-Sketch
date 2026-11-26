import { chromium } from "playwright-core";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const root = "E:/插件开发";
const indexUrl = pathToFileURL(join(root, "dist", "index.html")).href;
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });

const cases = [
  "sin(x)", "cos(x)", "tan(x)", "x^2", "x^3", "1/x", "sqrt(x)", "ln(x)", "log(x)", "exp(x)",
  "abs(x)", "|x-1|", "x^2-3x+2", "sin(x)+x/2", "tan60°",
  "x^2+y^2=1", "x^2/9+y^2/4=1", "xy=1", "x^3+y^3-3xy=0", "x^2=4",
  "x=cos(t),y=sin(t)", "x方加y方等于1", "x平方加y平方等于1",
];

async function run(expr) {
  const context = await browser.newContext({ viewport: { width: 720, height: 780 } });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.mn = { version: 1, currentMode: "workspace", lang: "zh-Hans", theme: "light",
      api: async () => ({}), call: async () => { throw new Error("no native"); }, on: () => {},
      fit: () => {}, height: () => {}, size: () => {}, mode: () => {}, close: () => {}, reload: () => {}, log: () => {} };
  });
  await page.route("**/pkg/assets/*", (r) => r.fulfill({ path: join(root, "dist", "assets", r.request().url().split("/").pop()) }));
  await page.goto(indexUrl);
  await page.waitForTimeout(500);
  await page.locator('.seg button:has-text("函数")').click();
  await page.waitForTimeout(300);
  await page.locator(".fnbar-field").fill(expr);
  await page.locator(".fnbar-draw").click();
  await page.waitForTimeout(350);
  const res = await page.evaluate(() => {
    const items = document.querySelectorAll(".fnpad-list .fnpad-item").length;
    const bad = document.querySelector(".fnbar-result.bad");
    const hasGeo = !!document.querySelector(".canvas-svg circle, .canvas-svg ellipse") ||
      [...document.querySelectorAll(".canvas-svg path")].some((p) => (p.getAttribute("d") || "").length > 60);
    return { items, bad: !!bad, hasGeo };
  });
  await context.close();
  return res;
}

let pass = 0, fail = 0;
for (const expr of cases) {
  const r = await run(expr);
  const ok = r.items >= 1 && r.hasGeo && !r.bad;
  if (ok) pass++; else fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${expr}${r.bad ? "  (报错)" : r.hasGeo ? "" : "  (无图形)"}`);
}
console.log(`\n${pass}/${cases.length} 通过`);
await browser.close();
