/**
 * 在原帖（68960）更新 0.2.0：
 * 1) 编辑主帖：标题 0.1.0→0.2.0、安装链接更新、插入 0.2.0 更新日志段、修正过时描述
 * 2) 跟帖：v0.2.0 更新说明
 * 用法：node update-original-post.mjs
 */
import { chromium } from "playwright-core";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE = join(root, "shots", "bbs-profile");
const TOPIC = "https://bbs.marginnote.com.cn/t/topic/68960";
const NEW_TITLE = "【第三方MN插件】Euclid Sketch (0.2.0)——数学模型构图：把草稿纸搬进 MarginNote";

const CHANGELOG_SECTION = `## 更新日志

### 0.2.0（2026-11）

本次重点：**图片进出卡片全链路打通**。

**新增**
- 插入卡片图 / 从文件导入图片：题目底图进画布，导入即锁定防误擦；图片等比缩放，长图不再变形
- **复制草图图片**：一键把整张草图复制到剪贴板，直接粘贴进卡片批注
- **目标卡自动跟随**：在 MN 里摘录新题时自动成为作图目标；卡片菜单也可手动「设为草图目标卡」
- 撤销 / 重做（50 步）；套索框选（可复制粘贴、整组拖动）；选中图形快捷改色
- 虚线线型；手指画图开关（关掉后单指只平移，防误画）

**修复**
- 批注写入失败、批注重复堆叠（同卡只保留一条）、卡片图导入失败
- 窗口缩放卡顿；计算器浮条拖动乱飘；图片锁图标错位

**优化**
- 拖动绘图流畅度（静态图形层缓存）；2000+ 卡片学习集的启动速度
- 界面全面图标化；最小化迷你条重绘；深色/浅色配色统一

`;

const REPLY = `## v0.2.0 已发布（2026-11）

主帖已同步更新。本次重点：**图片进出卡片全链路打通**。

- 🖼 插入卡片图 / 从文件导入图片，导入即锁定防误擦，等比缩放不变形
- 📋 **复制草图图片**到剪贴板 → 直接粘贴进卡片批注
- 🎯 目标卡自动跟随（摘录新题自动成为作图目标 / 卡片菜单手动指定）
- ↩️ 撤销重做 · 套索框选 · 快捷改色 · 虚线线型 · 手指画图开关
- 🛠 修复：批注写入失败与堆叠、卡片图导入失败、窗口缩放卡顿、计算器浮条乱飘
- ⚡️ 优化：拖动流畅度、大学习集启动速度、全面图标化

⬇️ 下载：主帖「安装」段 / GitHub Release v0.2.0
⚠️ 两个包建议都装（卡片菜单作图命令依赖模板）；MN 对同版本包会跳过安装，升级前先删旧包。`;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: false,
    viewport: null,
    args: ["--start-maximized"],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(TOPIC, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);

  // ---- 1) 编辑主帖 ----
  const editBtn = page.locator("#post_1 .post-controls .edit, #post_1 button.edit, article#post_1 .actions button[title*='编辑'], #post_1 .d-icon-pencil").first();
  await editBtn.waitFor({ timeout: 20000 });
  await editBtn.click();
  log("✓ 打开编辑");
  await page.waitForTimeout(2500);

  // 标题
  const title = page.locator("#reply-title");
  if (await title.count()) {
    await title.fill(NEW_TITLE);
    log("✓ 标题改为 0.2.0");
  }

  // 切 markdown
  const toggle = page.locator(".d-editor-button-bar .markdown-toggle, button[title*='Markdown']").first();
  if (await toggle.count()) {
    await toggle.click().catch(() => {});
    await page.waitForTimeout(700);
    log("✓ 已切 Markdown");
  }

  const input = page.locator(".d-editor-input").first();
  await input.waitFor({ timeout: 15000 });
  let body = await input.inputValue();
  log(`当前正文 ${body.length} 字符`);

  // 局部替换：版本号与安装链接
  const before = body;
  body = body.replaceAll("Euclid Sketch-0.1.0.mntemplate", "Euclid Sketch-0.2.0.mntemplate");
  body = body.replaceAll("releases/tag/v0.1.0", "releases/tag/v0.2.0");
  // 过时描述：快捷浮球已在 0.2.0 移除
  body = body.replace(/- 快捷浮球：画笔 \/ 橡皮 \/ 角度 \/ 图形 \/ 函数 \/ 设置一键切换/, "- 窗口可自由缩放，收起后是迷你浮条（含上一张 / 下一张卡片导航）");
  // 插入更新日志段（放在「## 安装」之前）
  if (body.includes("## 更新日志") === false) {
    const idx = body.indexOf("## 安装");
    body = idx >= 0 ? body.slice(0, idx) + CHANGELOG_SECTION + body.slice(idx) : body + "\n\n" + CHANGELOG_SECTION;
  }
  log(`正文更新：${before.length} → ${body.length} 字符`);
  await input.fill(body);
  await page.waitForTimeout(800);

  const save = page.locator("#reply-control .save-button, #reply-control .btn-primary").first();
  await save.waitFor({ timeout: 10000 });
  await save.click();
  log("… 保存主帖编辑");
  await page.waitForTimeout(5000);
  await page.screenshot({ path: join(root, "shots", "bbs-topic-edited.png") });
  log("✓ 主帖已更新，URL:", page.url());

  // ---- 2) 跟帖 ----
  await page.goto(TOPIC + "/last", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const replyBtn = page.locator("#topic-footer-buttons .btn-primary, .topic-footer-main-buttons .btn-primary").first();
  if (await replyBtn.count()) {
    await replyBtn.click();
    await page.waitForTimeout(2000);
  }
  const rToggle = page.locator(".d-editor-button-bar .markdown-toggle, button[title*='Markdown']").first();
  if (await rToggle.count()) {
    await rToggle.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  const rInput = page.locator(".d-editor-input").first();
  await rInput.waitFor({ timeout: 15000 });
  await rInput.fill(REPLY);
  await page.waitForTimeout(600);
  const rSend = page.locator("#reply-control .save-button, #reply-control .btn-primary").first();
  await rSend.click();
  log("… 已发跟帖");
  await page.waitForTimeout(6000);
  await page.screenshot({ path: join(root, "shots", "bbs-topic-replied.png") });
  log("✓ 跟帖完成，当前：", page.url());
  await ctx.close();
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
