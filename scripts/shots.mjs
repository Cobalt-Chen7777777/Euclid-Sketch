/**
 * 生成 README 效果图：真实交互画图 + 截屏。
 * 用法：node scripts/shots.mjs（需 dist 已构建）
 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };

async function openApp(browser, theme = "light") {
  const ctx = await browser.newContext({ viewport: { width: 760, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    const rel = u.pathname.replace(/^\/pkg/, "") || "/index.html";
    const f = join(root, "dist", rel);
    try {
      route.fulfill({ status: 200, contentType: MIME[extname(f)] ?? "application/octet-stream", body: readFileSync(f) });
    } catch {
      route.fulfill({ status: 404, body: "nf" });
    }
  });
  await page.addInitScript((t) => {
    window.mn = {
      version: 1, currentMode: "workspace", lang: "zh-Hans", locale: "zh-Hans", theme: t,
      api: async (path) => {
        if (path === "/capabilities") return { routes: ["image/import"] };
        if (path === "/context") return { available: true, studySet: { topicid: "t-1" }, focusedNote: "n-2" };
        if (path === "/ui-state") return { state: { topicid: "t-1" } };
        if (path.startsWith("/study-sets/t-1/tree")) return { nodes: [{ noteid: "n-2", title: "题目二" }], nextCursor: null };
        return {};
      },
      on() {}, call: async () => { throw new Error("x"); }, size() {}, height() {}, fit() {}, mode() {}, close() {}, toast() {},
    };
  }, theme);
  await page.goto("http://pkg.local/pkg/index.html", { waitUntil: "load" });
  await page.waitForTimeout(800);
  return { ctx, page };
}

/** 在画布上从 a 拖到 b（模拟一笔） */
async function drag(page, a, b) {
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i += 1) {
    await page.mouse.move(a.x + ((b.x - a.x) * i) / 6, a.y + ((b.y - a.y) * i) / 6);
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(120);
}

const railBtn = (page, label) => page.locator(`.rail-btn[aria-label="${label}"]`);

async function main() {
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });

  // ---------- 主图：2D 画布内容 ----------
  {
    const { ctx, page } = await openApp(browser);
    // 圆
    await railBtn(page, "圆").click();
    await drag(page, { x: 340, y: 350 }, { x: 440, y: 350 });
    // 线段
    await railBtn(page, "线段").click();
    await drag(page, { x: 210, y: 560 }, { x: 600, y: 660 });
    // 角度
    await railBtn(page, "画角度").click();
    await page.mouse.click(260, 760); await page.waitForTimeout(120);
    await page.mouse.click(420, 780); await page.waitForTimeout(120);
    await page.mouse.click(330, 660); await page.waitForTimeout(200);
    // 函数
    await page.locator('.seg button:has-text("函数")').click();
    await page.waitForTimeout(500);
    const input = page.locator('.fnpad input[type="text"], .fnpad input').first();
    if (await input.count()) {
      await input.fill("sin(x)+x/2");
      await page.locator('.fnpad button:has-text("绘制")').first().click();
      await page.waitForTimeout(400);
    } else {
      console.log("fnpad input 未找到");
    }
    await page.locator('.seg button:has-text("2D")').click();
    await page.waitForTimeout(400);
    await page.waitForTimeout(2400); // 等 toast 消失
    await page.locator(".panel").screenshot({ path: join(root, "docs/screenshots/canvas.png") });
    console.log("✓ canvas.png");
    await ctx.close();
  }

  // ---------- 绘图选项（含几何参数 + 图层） ----------
  {
    const { ctx, page } = await openApp(browser);
    await railBtn(page, "圆").click();
    await drag(page, { x: 400, y: 300 }, { x: 500, y: 300 });
    await railBtn(page, "选择").click();
    await page.mouse.click(490, 300); // 选中圆周上一点
    await page.waitForTimeout(300);
    await railBtn(page, "绘图选项").click();
    await page.waitForTimeout(500);
    await page.locator(".panel").screenshot({ path: join(root, "docs/screenshots/options.png") });
    console.log("✓ options.png");
    await ctx.close();
  }

  // ---------- 函数面板 ----------
  {
    const { ctx, page } = await openApp(browser);
    await page.locator('.seg button:has-text("函数")').click();
    await page.waitForTimeout(500);
    const input = page.locator('.fnpad input[type="text"], .fnpad input').first();
    if (await input.count()) {
      await input.fill("sin(x)+x/2");
      await page.locator('.fnpad button:has-text("绘制")').first().click();
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2400);
    await page.locator(".panel").screenshot({ path: join(root, "docs/screenshots/calculator.png") });
    console.log("✓ calculator.png");
    await ctx.close();
  }

  // ---------- 3D 模型 ----------
  {
    const { ctx, page } = await openApp(browser);
    await page.locator('.seg button:has-text("3D")').click();
    await page.waitForTimeout(600);
    await page.locator('button:has-text("圆锥")').first().click();
    await page.waitForTimeout(1800);
    await page.locator(".panel").screenshot({ path: join(root, "docs/screenshots/solid.png") });
    console.log("✓ solid.png");
    await ctx.close();
  }

  // ---------- 设置页（浅色 / 深色） ----------
  for (const theme of ["light", "dark"]) {
    const { ctx, page } = await openApp(browser, theme);
    await page.locator('.appnav button:has-text("设置"), .nav-tabs button:has-text("设置")').first().click();
    await page.waitForTimeout(600);
    await page.locator(".panel").screenshot({
      path: join(root, `docs/screenshots/${theme === "dark" ? "settings-dark" : "settings"}.png`),
    });
    console.log(`✓ settings-${theme}.png`);
    await ctx.close();
  }

  await browser.close();
}

main().catch((e) => {
  console.error("ERR", e.message);
  process.exit(1);
});
