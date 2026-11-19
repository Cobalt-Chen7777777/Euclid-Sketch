/**
 * 私信 @Randa 申请插件签名认证（复用 publish-forum 的持久化 profile，无需再登录）。
 * 附上 release/Euclid Sketch-0.2.0-mn-submit.zip。
 * 用法：node publish-dm.mjs
 */
import { chromium } from "playwright-core";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE = join(root, "shots", "bbs-profile");
const BASE = "https://bbs.marginnote.com.cn";
const ZIP = join(root, "release", "Euclid Sketch-0.2.0-mn-submit.zip");

const DM_TEXT = `Randa 你好，申请插件签名认证。

- 插件：Euclid Sketch（场景插件，addonid com.mathsketch.addon）
- 版本：0.2.0
- 功能：在 MN 里为数学题作图的画布插件，支持函数绘图、几何图元、图片导入与卡片批注配合
- 附件：Euclid Sketch-0.2.0.mnaddon / .mntemplate（已打包为 zip）
- 本插件不修改自身目录下的任何文件

GitHub：https://github.com/Cobalt-Chen7777777/Euclid-Sketch

谢谢！`;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: false,
    viewport: null,
    args: ["--start-maximized"],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  // 收件人用户名（公告帖帖主，非显示名 Randa）
  await page.goto(`${BASE}/new-message?username=Randa_Support-Team`, { timeout: 60000, waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const rc = page.locator("#reply-control");
  await rc.waitFor({ timeout: 20000 });
  log("✓ 私信编辑器已打开");

  // 切 Markdown 模式
  const mdToggle = page.locator(".d-editor-button-bar .markdown-toggle, button[title*='Markdown']").first();
  if (await mdToggle.count()) {
    await mdToggle.click().catch(() => {});
    await page.waitForTimeout(600);
  }

  // 私信 composer
  const title = page.locator("#reply-title");
  if (await title.count()) {
    await title.fill("申请插件签名认证：Euclid Sketch 0.2.0");
    log("✓ 标题已填");
  }
  const input = page.locator(".d-editor-input").first();
  await input.waitFor({ timeout: 15000 });
  await input.fill(DM_TEXT);
  log("✓ 正文已填");

  // 上传附件（composer 里的文件输入）
  const fileInput = page.locator('#reply-control input[type="file"]').first();
  if (await fileInput.count()) {
    await fileInput.setInputFiles(ZIP);
    log("… 已选择附件，等待上传");
    await page.waitForTimeout(6000);
    log("✓ 附件处理完成");
  } else {
    log("⚠️ 未找到附件输入框，跳过附件");
  }

  await page.screenshot({ path: join(root, "shots", "bbs-dm-compose.png") });

  const send = page.locator("#reply-control .save-button, #reply-control .btn-primary").first();
  await send.waitFor({ timeout: 10000 });
  await send.click();
  log("… 已点发送");
  await page.waitForTimeout(6000);
  await page.screenshot({ path: join(root, "shots", "bbs-dm-sent.png") });
  log("✓ 私信流程结束，当前页面：", page.url());
  await ctx.close();
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
