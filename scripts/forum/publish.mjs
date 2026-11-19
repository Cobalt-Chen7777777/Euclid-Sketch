/**
 * 社区发帖自动化：有头 Chrome + 持久化 profile（登录一次后复用）。
 * 流程：等登录 → 找插件板块 → 新话题 → 填标题/正文 → 发布 → 截图。
 * 用法：node publish-forum.mjs
 */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE = join(root, "shots", "bbs-profile");
const BASE = "https://bbs.marginnote.com.cn";

const TITLE = "【场景插件】Euclid Sketch —— 在 MarginNote 里为数学题随手作图（0.2.0）";

function extractBody() {
  const md = readFileSync(join(root, "docs", "mn-release-notes-0.2.0.md"), "utf8");
  const start = md.indexOf("**做数学题时");
  const end = md.indexOf("## 私信 @Randa");
  return md.slice(start, end).trim();
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: false,
    viewport: null,
    args: ["--start-maximized"],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(`${BASE}/latest`, { timeout: 60000, waitUntil: "domcontentloaded" });

  // 等登录：检测右上角用户头像
  const isLoggedIn = async () => {
    try {
      return await page.evaluate(() => Boolean(document.querySelector(".header-dropdown-toggle img.avatar, #current-user img.avatar, .header-buttons .avatar")));
    } catch {
      // 登录跳转时页面导航会让 evaluate 抛错，按未登录继续等
      return false;
    }
  };
  let ok = await isLoggedIn();
  if (!ok) {
    log("⚠️ 未登录：请在弹出的浏览器窗口里登录社区（脚本会自动继续，最长等 5 分钟）");
    for (let i = 0; i < 100 && !ok; i++) {
      await page.waitForTimeout(3000);
      ok = await isLoggedIn();
    }
  }
  if (!ok) {
    log("❌ 5 分钟内未检测到登录，退出。重新运行 node publish-forum.mjs 即可");
    await ctx.close();
    process.exit(1);
  }
  log("✓ 已登录");

  // 找「插件」板块链接
  const cats = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('a[href*="/c/"]').forEach((a) => {
      const t = (a.textContent || "").replace(/\s+/g, " ").trim();
      const href = a.getAttribute("href") || "";
      if (t && href.includes("/c/") && t.length < 30) out.push({ t, href });
    });
    return out;
  });
  const uniq = [...new Map(cats.map((c) => [c.href, c])).values()];
  log("分类候选：", uniq.map((c) => `${c.t} => ${c.href}`).join(" | "));

  const pluginCat = uniq.find((c) => /插件|addon|plugin/i.test(c.t) || /plugin|addon/i.test(c.href));
  const catSlug = pluginCat ? pluginCat.href.split("/c/")[1]?.split("/")[0] : null;
  log("插件板块：", pluginCat ? pluginCat.href : "未找到，将不限定分类");

  // 打开发帖页
  await page.goto(catSlug ? `${BASE}/new-topic?category=${encodeURIComponent(catSlug)}` : `${BASE}/new-topic`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // 填标题
  const titleSel = "#reply-title";
  await page.waitForSelector(titleSel, { timeout: 20000 });
  await page.fill(titleSel, TITLE);
  log("✓ 标题已填");

  // 切到 Markdown 模式（若有切换按钮）
  const toggle = page.locator(".d-editor-button-bar .markdown-toggle, .d-editor-toggle-markdown, button[title*='Markdown']").first();
  if (await toggle.count()) {
    await toggle.click().catch(() => {});
    await page.waitForTimeout(600);
    log("✓ 已切 Markdown 模式");
  }

  // 填正文
  const body = extractBody();
  const input = page.locator(".d-editor-input").first();
  await input.waitFor({ timeout: 15000 });
  await input.fill(body);
  await page.waitForTimeout(800);
  log(`✓ 正文已填（${body.length} 字符）`);

  await page.screenshot({ path: join(root, "shots", "bbs-compose.png"), fullPage: false });

  // 选分类（若下拉存在且没自动选中）
  const chooser = page.locator(".category-chooser, .composer-fields .select-kit").first();
  if (pluginCat && (await chooser.count())) {
    try {
      const label = await chooser.innerText();
      if (!/插件|plugin/i.test(label)) {
        await chooser.click();
        await page.waitForTimeout(500);
        await page.locator(".select-kit-collection .name", { hasText: /插件|plugin/i }).first().click();
        await page.waitForTimeout(400);
        log("✓ 分类已选");
      } else {
        log("✓ 分类已自动匹配");
      }
    } catch {
      log("⚠️ 分类选择跳过（保持默认）");
    }
  }

  // 发布
  const save = page.locator("#reply-control .save-button, #reply-control .btn-primary").first();
  await save.waitFor({ timeout: 10000 });
  await save.click();
  log("… 已点发布，等待跳转");
  await page.waitForTimeout(6000);
  const url = page.url();
  log("当前页面：", url);
  await page.screenshot({ path: join(root, "shots", "bbs-posted.png"), fullPage: false });
  log("✓ 发帖流程结束（若页面已在帖子详情，即成功）");
  await ctx.close();
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
