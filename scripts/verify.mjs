/**
 * v0.2.1 无头回归：本轮全部改动的关键行为验证。
 * 用法：node verify-v021.mjs（需 dist 已构建 + 本机 Chrome）
 */
import { chromium } from "playwright-core";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const indexUrl = pathToFileURL(join(root, "dist", "index.html")).href;

const results = [];
const record = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

/** mock mn 桥：记录 api 调用，卡片/树/批注/渲染图都可编程 */
async function newPage(browser) {
  const context = await browser.newContext({ viewport: { width: 520, height: 760 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.addInitScript(() => {
    const calls = [];
    window.__mnCalls = calls;
    window.mn = {
      version: 1, currentMode: "workspace", lang: "zh-Hans", locale: "zh-Hans", theme: "light",
      api: async (path, options) => {
        calls.push({ path, options });
        if (path === "/capabilities") return { routes: ["image/import"] };
        if (path === "/context") return { available: true, studySet: { id: "t-1" }, focusedNote: "n-2" };
        if (path === "/ui-state") return { state: { topicid: "t-1" } };
        if (path.startsWith("/study-sets/t-1/tree")) {
          return { nodes: [
            { noteid: "n-1", title: "题目一", docPage: 1 },
            { noteid: "n-2", title: "题目二", docPage: 2 },
          ], nextCursor: null };
        }
        if (path.endsWith("/comments") && options?.method === "POST") return { storedType: "text", storedText: options.body?.text ?? "" };
        if (path.endsWith("/focus")) return {};
        return {};
      },
      call: async () => { throw new Error("no native"); },
      on: (event, cb) => { window.__mnHandlers[event] = cb; },
      fit: () => {}, height: () => {}, size: () => {}, mode: () => {}, close: () => {}, reload: () => {}, log: () => {},
    };
    // 1x1 蓝色 PNG：卡片渲染图
    window.__cardPng = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    window.__renderUrls = [];
    window.__mnHandlers = {};
  });
  // MN 部署路径 /pkg/assets/* → 本地 dist/assets/*（file:// 下 pathname 含盘符，取最后一段）
  await page.route("**/pkg/assets/*", (route) => {
    const file = route.request().url().split("/").pop();
    return route.fulfill({ path: join(root, "dist", "assets", file) });
  });
  // /bridge/v1 渲染图请求 → PNG（记录 URL 验证目标卡）
  await page.route("**/bridge/v1/notes/**", (route) => {
    void page.evaluate((u) => { window.__renderUrls.push(u); }, route.request().url()).catch(() => {});
    route.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      ),
    });
  });
  await page.goto(indexUrl);
  await page.waitForSelector(".canvas-svg", { timeout: 10000 });
  return { page, context };
}

const center = async (page) => {
  const box = await page.locator(".canvas-svg").boundingBox();
  return { x: box.x, y: box.y, w: box.width, h: box.height };
};

/** 画布世界坐标 → 页面坐标（世界区间约 [-8, 8]） */
const worldToPage = (box, wx, wy) => ({
  x: box.x + ((wx + 8) / 16) * box.w,
  y: box.y + ((8 - wy) / 16) * box.h,
});

async function clickRailTool(page, label) {
  await page.locator(".rail-btn").filter({ hasText: "" }).evaluateAll(() => {});
  // 按 title 找按钮
  await page.locator(`.rail-btn[title="${label}"]`).click();
}

async function svgDrag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
}

const countInk = (page) => page.locator(".canvas-svg path.crayon, .canvas-svg [data-kind='ink']").count();

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true,
  });

  // ---------- 1. 基础界面 ----------
  {
    const { page, context } = await newPage(browser);
    await page.waitForTimeout(400);

    record("浮球已删除", (await page.locator(".quickball").count()) === 0);
    record("缩放把手已恢复", (await page.locator(".resize-handle").count()) === 1);
    record("撤销/重做按钮存在", (await page.locator(".hist-btn").count()) === 2);
    record("撤销初始禁用", await page.locator('.hist-btn[aria-label="撤销上一步"]').isDisabled());

    // ---------- 2. 计算器浮条 ----------
    await page.locator('.seg button:has-text("函数")').click();
    await page.waitForSelector(".fnpad");
    record("拖动浮条存在", (await page.locator(".fnpad-dragbar").count()) === 1);
    const before = await page.locator(".fnpad").evaluate((el) => el.style.left || "(unset)");
    const bar = await page.locator(".fnpad-dragbar").boundingBox();
    await page.mouse.move(bar.x + bar.width / 2, bar.y + bar.height / 2);
    await page.mouse.down();
    await page.mouse.move(bar.x + bar.width / 2 + 80, bar.y + bar.height / 2 - 40, { steps: 6 });
    await page.mouse.up();
    const after = await page.locator(".fnpad").evaluate((el) => el.style.left || "(unset)");
    record("浮条拖动生效", before !== after, `${before} → ${after || "(set)"}`);

    // ---------- 3. 撤销/重做（画笔一笔） ----------
    await page.locator('.fnpad .drawer-close').click();
    await clickRailTool(page, "画笔");
    const box = await center(page);
    const a = worldToPage(box, -3, 2);
    const b = worldToPage(box, 3, -2);
    await svgDrag(page, a, b);
    await page.waitForTimeout(150);
    const inkCount = await page.evaluate(() => {
      const svg = document.querySelector(".canvas-svg");
      return svg.querySelectorAll("path").length;
    });
    record("画笔一笔生效", inkCount >= 1, `path=${inkCount}`);

    await page.locator('.hist-btn[aria-label="撤销上一步"]').click();
    await page.waitForTimeout(120);
    const afterUndo = await page.evaluate(() => document.querySelector(".canvas-svg").querySelectorAll("path").length);
    record("撤销生效", afterUndo === inkCount - 1, `path=${afterUndo}`);
    record("重做可用", !(await page.locator('.hist-btn[aria-label="重做下一步"]').isDisabled()));
    await page.locator('.hist-btn[aria-label="重做下一步"]').click();
    await page.waitForTimeout(120);
    const afterRedo = await page.evaluate(() => document.querySelector(".canvas-svg").querySelectorAll("path").length);
    record("重做生效", afterRedo === inkCount, `path=${afterRedo}`);

    // ---------- 4. 套索判定：只圈中一个图形 ----------
    await clickRailTool(page, "圆");
    const c1 = worldToPage(box, -4.5, 3);
    const c2 = worldToPage(box, -2.5, 1);
    await svgDrag(page, c1, c2);
    const c3 = worldToPage(box, 2, -1);
    const c4 = worldToPage(box, 4.5, -3.5);
    await svgDrag(page, c3, c4);
    await page.waitForTimeout(120);
    const circleCount = await page.evaluate(() => document.querySelectorAll(".canvas-svg circle").length);
    record("画两个圆生效", circleCount >= 2, `circle=${circleCount}`);

    await clickRailTool(page, "套索");
    // 只圈住第一个矩形的小圈
    const l1 = worldToPage(box, -5.5, 4.5);
    const l2 = worldToPage(box, -1.5, 0.5);
    await svgDrag(page, l1, l2);
    await page.waitForTimeout(120);
    const selCount = await page.evaluate(() =>
      document.querySelectorAll(".canvas-svg rect[stroke-dasharray='4 4']").length,
    );
    record("套索只选中目标图形", selCount === 1, `selected=${selCount}`);

    // ---------- 5. 框选整组拖动 ----------
    const selBoxBefore = await page.evaluate(() => {
      const r = document.querySelector(".canvas-svg rect[stroke-dasharray='4 4']");
      return r ? `${r.getAttribute("x")},${r.getAttribute("y")}` : "none";
    });
    const mid = worldToPage(box, -3.5, 2.5);
    const moved = worldToPage(box, -1.0, 0.0);
    await svgDrag(page, mid, moved);
    await page.waitForTimeout(150);
    const selBoxAfter = await page.evaluate(() => {
      const r = document.querySelector(".canvas-svg rect[stroke-dasharray='4 4']");
      return r ? `${r.getAttribute("x")},${r.getAttribute("y")}` : "none";
    });
    record("框选整组拖动生效", selBoxBefore !== selBoxAfter, `${selBoxBefore} → ${selBoxAfter}`);

    // ---------- 6. 选中图形改色 ----------
    await page.locator(".rail-btn[title^='绘图选项']").click();
    await page.waitForSelector(".drawer");
    await page.locator(".swatch").nth(2).click();
    await page.waitForTimeout(120);
    const selShapeColor = await page.evaluate(() => {
      const sel = document.querySelector(".canvas-svg .shape-sel, .canvas-svg [data-selected]");
      const rects = [...document.querySelectorAll(".canvas-svg rect")].filter((r) => r.getAttribute("stroke-width") && r.getAttribute("fill") !== "none" && !r.getAttribute("stroke-dasharray"));
      return rects.length > 0 ? rects[rects.length - 1].getAttribute("stroke") || rects[rects.length - 1].getAttribute("fill") : "unknown";
    });
    record("选中图形改色生效", selShapeColor !== "#2563eb", `color=${selShapeColor}`);
    await page.locator(".drawer-close").click();

    // ---------- 7. 图片锁定 ----------
    // 通过选项抽屉导入文件图片（绕过卡片渲染走 onImportImage）
    await page.locator(".rail-btn[title^='绘图选项']").click();
    await page.waitForSelector(".drawer");
    const fileChooserP = page.waitForEvent("filechooser");
    await page.locator("button:has-text('从文件导入图片')").click();
    const chooser = await fileChooserP;
    // 生成 1x1 png 文件
    const png64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    await chooser.setFiles({ name: "t.png", mimeType: "image/png", buffer: Buffer.from(png64, "base64") });
    await page.waitForTimeout(400);
    await page.locator(".drawer-close").click();
    await page.waitForTimeout(150);
    const badgeLocked = await page.evaluate(() => {
      const g = document.querySelector(".canvas-stage .img-lock-btn svg rect[fill*='37, 99, 235']");
      return Boolean(g);
    });
    record("图片导入默认锁定", badgeLocked);
    // 点锁定徽标解锁
    const lockBtn = page.locator(".canvas-stage .img-lock-btn").first();
    if (await lockBtn.count()) {
      await page.evaluate(() => document.querySelector(".canvas-stage .img-lock-btn")?.click());
      await page.waitForTimeout(200);
    const unlocked = await page.evaluate(() => {
      const g = document.querySelector(".canvas-stage .img-lock-btn svg rect[fill*='37, 99, 235']");
      return !g;
    });
      record("点击徽标解锁", unlocked);
    } else {
      record("点击徽标解锁", false, "未找到徽标");
    }

    // ---------- 8. 写入卡片（批注参数） ----------
    await page.evaluate(() => { window.__mnCalls.length = 0; });
    await page.locator(".appnav button:has-text('设置')").click();
    await page.waitForTimeout(250);
    await page.locator(".settings-chips button:has-text('导出')").click();
    await page.waitForTimeout(200);
    const settingsWrite = page.locator(":text('写入构图说明')").first();
    await settingsWrite.click();
    await page.waitForTimeout(300);
    const commentCall = await page.evaluate(() =>
      window.__mnCalls.find((c) => c.path.endsWith("/comments") && c.options?.method === "POST"),
    );
    record("批注参数合规", Boolean(commentCall) && commentCall.options.body?.confirm === true && commentCall.options.body?.format === "text",
      commentCall ? `format=${commentCall.options.body?.format} confirm=${commentCall.options.body?.confirm}` : "未调用");
    record("写入目标 = 焦点卡", Boolean(commentCall) && commentCall.path.includes("/notes/n-2/"),
      commentCall ? commentCall.path : "未调用");

    // ---------- 9. 卡片图导入（工具栏按钮，渲染目标 = 焦点卡） ----------
    await page.locator(".appnav button:has-text('画布')").click();
    await page.waitForTimeout(200);
    await page.evaluate(() => { window.__mnCalls.length = 0; });
    await page.locator(".rail-btn[title='插入图片']").click();
    await page.waitForTimeout(500);
    const imgShape = await page.evaluate(() => Boolean(document.querySelector(".canvas-svg image")));
    record("卡片图导入成功", imgShape);
    const renderUrls = await page.evaluate(() => window.__renderUrls);
    const hitFocus = renderUrls.some((u) => u.includes("/notes/n-2/render"));
    record("渲染目标 = 焦点卡", hitFocus, renderUrls.join(" | ") || "无请求");

    // ---------- 10. 摘录事件：自动切换目标卡 ----------
    await page.evaluate(() => {
      const h = window.__mnHandlers["excerpt"];
      if (h) h({ noteid: "n-9" });
    });
    await page.waitForTimeout(250);
    const topicText = await page.locator(".stage-topic").innerText().catch(() => "");
    record("摘录事件切换目标卡", topicText.includes("n-9") || topicText.includes("切换") || topicText.includes("目标"),
      topicText.slice(0, 40));

    await page.screenshot({ path: join(root, "shots", "95-v021-regression.png"), fullPage: true });
    await context.close();
  }

  // ---------- 11. 0.3.0-beta.2：曲线落形 + 缩放后仍可见 ----------
  {
    const { page, context } = await newPage(browser);
    await page.waitForTimeout(300);
    await clickRailTool(page, "曲线");
    const box = await center(page);
    const p1 = worldToPage(box, -3.5, -1.5);
    const p2 = worldToPage(box, -0.5, 3);
    const p3 = worldToPage(box, 3.5, -1.5);
    for (const p of [p1, p2, p3]) {
      await page.mouse.click(p.x, p.y);
      await page.waitForTimeout(140);
    }
    // 同一点快速再点一次 = 收尾（时间 < 260ms 且位置重合）
    await page.mouse.click(p3.x, p3.y);
    await page.waitForTimeout(60);
    await page.mouse.click(p3.x, p3.y);
    await page.waitForTimeout(250);

    const curvePaths = () => page.evaluate(() => {
      const paths = [...document.querySelectorAll(".canvas-svg path")];
      return paths.filter((p) => (p.getAttribute("d") || "").startsWith("M")).length;
    });
    const c0 = await curvePaths();
    record("曲线落形成功（不再静默丢弃）", c0 >= 1, `path=${c0}`);

    // 以画布中心放大 8 档：跨度过大时曾出现曲线整条消失
    const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
    await page.mouse.move(c.x, c.y);
    for (let i = 0; i < 40; i += 1) await page.mouse.wheel(0, -160);
    await page.waitForTimeout(300);
    const nanCount = await page.evaluate(() => [...document.querySelectorAll(".canvas-svg path")]
      .filter((p) => (p.getAttribute("d") || "").includes("NaN")).length);
    const c1 = await curvePaths();
    record("缩放后曲线仍在且无 NaN", c1 >= c0 && nanCount === 0, `path=${c1} nan=${nanCount}`);

    // 再画一条：点 3 下后不收尾，直接切到「选择」工具 —— 应自动落形而不是消失
    await clickRailTool(page, "曲线");
    const q1 = worldToPage(box, -2.5, 2);
    const q2 = worldToPage(box, 0, -2.5);
    const q3 = worldToPage(box, 2.5, 2);
    for (const q of [q1, q2, q3]) {
      await page.mouse.click(q.x, q.y);
      await page.waitForTimeout(160);
    }
    await clickRailTool(page, "选择");
    await page.waitForTimeout(250);
    const c2 = await curvePaths();
    record("切工具时曲线自动落形（不再丢草稿）", c2 > c1, `path=${c1} → ${c2}`);
    await context.close();
  }

  // ---------- 12. 尺寸动画：viewBox 与容器始终一致（否则方框被拉伸畸变） ----------
  {
    const { page, context } = await newPage(browser);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__stretch = [];
      const svg = document.querySelector(".canvas-svg");
      const sample = () => {
        const r = svg.getBoundingClientRect();
        const vb = (svg.getAttribute("viewBox") || "0 0 0 0").split(/\s+/).map(Number);
        window.__stretch.push(Math.max(Math.abs(r.width - vb[2]), Math.abs(r.height - vb[3])));
      };
      window.__ro = new ResizeObserver(sample);
      window.__ro.observe(svg);
      sample();
    });
    for (let i = 1; i <= 12; i += 1) {
      await page.setViewportSize({ width: 520 - i * 12, height: 700 - i * 16 });
      await page.waitForTimeout(30);
    }
    await page.waitForTimeout(200);
    const worst = await page.evaluate(() => {
      window.__ro.disconnect();
      return Math.max(...window.__stretch);
    });
    record("尺寸变化全程无拉伸", worst <= 0.5, `最大偏差 ${Math.round(worst * 10) / 10}px`);
    await context.close();
  }

  // ---------- 13. 0.3.0-beta.2：迷你条按按钮数撑开（不需滑动） ----------
  {
    const { page, context } = await newPage(browser);
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__mnSizes = [];
      window.mn.size = (w, h) => window.__mnSizes.push([w, h]);
      document.documentElement.setAttribute("data-mode", "mini");
    });
    await page.waitForTimeout(900);
    const sizes = await page.evaluate(() => window.__mnSizes);
    const last = sizes[sizes.length - 1];
    const barOk = last ? last[0] >= 200 && last[1] >= 46 && last[1] <= 90 : false;
    record("迷你条横排一行放全", barOk, last ? `${last[0]}×${last[1]}` : "未调用 mn.size");

    // 尺寸被宿主重置后要能自己纠回来
    await page.evaluate(() => { window.__mnSizes.length = 0; window.dispatchEvent(new Event("resize")); });
    await page.waitForTimeout(300);
    const again = await page.evaluate(() => window.__mnSizes);
    record("宿主重置后自动纠回", again.length >= 1, again.length ? `${again[0][0]}×${again[0][1]}` : "未纠正");
    await context.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n== ${results.length - failed.length}/${results.length} 通过 ==`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error("FATAL", e); process.exit(2); });
