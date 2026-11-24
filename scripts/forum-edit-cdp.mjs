/**
 * 通过 Chrome 调试端口（CDP）在真实浏览器里编辑帖子 68960。
 * 前提：Chrome 已用 --remote-debugging-port=9222 启动，且已登录论坛。
 *
 *   node scripts/forum-edit-cdp.mjs --check    # 只检查连接与登录状态
 *   node scripts/forum-edit-cdp.mjs --dry      # 读出正文、应用改动、打印差异，不保存
 *   node scripts/forum-edit-cdp.mjs --write    # 写入编辑器并点保存
 */
import { chromium } from "playwright-core";

import { EDITS } from "./forum-edits.mjs";
import { IMAGE_EDITS } from "./forum-edits-images.mjs";

const PORT = process.env.CDP_PORT || "9222";
const TOPIC = "https://bbs.marginnote.com.cn/t/topic/68960";
const MODE = process.argv.includes("--write") ? "write" : process.argv.includes("--dry") ? "dry" : "check";
// --images：只跑第二批（插图 + 附件），第一批已完成
const BATCH = process.argv.includes("--images") ? IMAGE_EDITS : EDITS;

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
const ctx = browser.contexts()[0];
if (!ctx) {
  console.error("没拿到浏览器上下文，请确认 Chrome 是用 --remote-debugging-port 启动的");
  process.exit(1);
}

const page = ctx.pages().find((p) => p.url().includes("marginnote.com.cn")) ?? (await ctx.newPage());
if (!page.url().includes("marginnote.com.cn")) {
  await page.goto(TOPIC, { waitUntil: "domcontentloaded" });
}
await page.waitForTimeout(1200);

// 登录态：右上角有头像链接
const loggedIn = await page.evaluate(() => !!document.querySelector("#current-user, .current-user, a[href^='/u/']"));
console.log("登录状态:", loggedIn ? "已登录" : "未登录（请先在浏览器里登录论坛）");
if (!loggedIn) process.exit(1);
if (MODE === "check") {
  console.log("连接正常，可以用 --dry 看差异。");
  process.exit(0);
}

if (!page.url().includes("/t/topic/68960")) {
  await page.goto(TOPIC, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
}

// 先关掉可能残留的编辑器（上一次 dry 或手动点开过）
await page.keyboard.press("Escape").catch(() => {});
await page.evaluate(() => {
  const cancel = document.querySelector("#reply-control .cancel, .composer-controls .cancel");
  if (cancel instanceof HTMLElement) cancel.click();
});
await page.waitForTimeout(600);

// 首帖（article.post）里的编辑按钮——不能用裸 button.edit，那是标题编辑
const editBtn = page.locator('#post_1 button[title="编辑此帖子"], #post_1 .post-action-menu__edit').first();
await editBtn.click({ timeout: 10000 });
const ta = page.locator("textarea.d-editor-input").first();
await ta.waitFor({ timeout: 15000 });
await page.waitForTimeout(600);

const raw = await ta.inputValue();
console.log("编辑器读到原正文", raw.length, "字符");

let out = raw;
const missed = [];
for (const [name, pattern, replacement] of BATCH) {
  const before = out;
  out = out.replace(pattern, replacement);
  if (out === before) missed.push(name);
}

if (missed.length > 0) {
  console.error("\n以下改动未命中（原文可能已改过），不写入任何内容：");
  for (const m of missed) console.error("  ✗ " + m);
  console.error("\n提示：命中的部分也不会保存，可以只把未命中的条目手动改掉。");
  process.exit(2);
}

console.log(`全部 ${BATCH.length} 处替换命中，新正文 ${out.length} 字符（+${out.length - raw.length}）`);

if (MODE === "dry") {
  // 打印前后差异片段，便于人工核对
  for (const [name] of BATCH) console.log("  ✓ " + name);
  console.log("\n--dry：未写入。确认后加 --write。");
  process.exit(0);
}

await ta.fill(out);
await page.waitForTimeout(500);
const saveBtn = page.locator(".save-button, button:has-text('保存编辑'), button:has-text('Save Edit')").first();
await saveBtn.click({ timeout: 10000 });
await page.waitForTimeout(2500);
console.log("已点击保存，请到浏览器里确认帖子内容。");
await browser.close();
