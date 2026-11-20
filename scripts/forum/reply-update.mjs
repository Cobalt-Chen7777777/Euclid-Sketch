/**
 * 在 MN 社区原帖（68960）跟帖追述 0.2.1-beta.1 更新日志。
 * 用持久化 profile（首次运行需在弹出的窗口登录一次）。
 * 用法：node scripts/forum/reply-update.mjs
 */
import { chromium } from "playwright-core";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE = join(root, "shots", "bbs-profile");
const TOPIC = "https://bbs.marginnote.com.cn/t/topic/68960";

const REPLY = `## v0.2.1-beta.1 测试版（2026-11-20）

这轮改动集中在「看得清」和「放得进卡片」两件事上，单独列一下方便对照测试。

**修复**
- **提示条看不清**：浅色模式是「半透明白底 + 白字」、深色模式是「深底 + 深字」——两边的对比度都不够。toast 改为独立高对比样式（深底白字 / 浅底深字 + 边框 + 阴影），不再参与玻璃化
- **复制失败只说「系统限制」**：现在会说明具体原因（剪贴板不可用 / 未授权 / 安全策略拦截）

**改进**
- **复制兼容性**：剪贴板写入改为**手势内调用**（ClipboardItem 直接接收渲染 Promise），大草图渲染耗时不再导致手势过期而失败；仍失败时自动降级为全屏大图，长按「拷贝 / 存储到照片」后回卡片粘贴——这条路径不依赖剪贴板 API

**新增**
- **检查更新可下载**：发现新版本后设置页出现「下载更新包」，浏览器下载后用 MarginNote 打开即完成更新
- **几何参数**：选中线段可输入精确长度（锚定起点），选中圆可输入半径，单位为网格
- **网格交点吸附**：拖动点 / 圆心 / 端点时，除吸附已有点外也会吸到网格交点（设置里开关文案改为「吸附到点与网格」）
- **图层**（绘图选项 → 图层）：新建图层、点图层名切换当前绘制层、整层显示/隐藏、整层锁定/解锁、把选中图形移到当前层；锁定层以 45% 不透明度淡化，隐藏层不渲染也不导出

⚠️ MN 对同版本包会跳过安装；装过 0.2.0 可直接升级本包。下载见 GitHub Release **v0.2.1-beta.1**（流程同主帖「安装」段）。

测试反馈欢迎直接回帖，麻烦带上：iPadOS 版本、MN 版本、复现步骤、截图。`;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: false,
    viewport: null,
    args: ["--start-maximized"],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(TOPIC, { timeout: 60000, waitUntil: "domcontentloaded" });

  const loggedIn = async () => {
    try {
      return await page.evaluate(() => Boolean(document.querySelector(".header-dropdown-toggle img.avatar, #current-user img.avatar, .header-buttons .avatar")));
    } catch {
      return false;
    }
  };
  let ok = await loggedIn();
  if (!ok) {
    log("⚠️ 未登录：请在弹出的浏览器窗口登录社区（脚本自动继续，最长等 5 分钟）");
    for (let i = 0; i < 100 && !ok; i++) {
      await page.waitForTimeout(3000);
      ok = await loggedIn();
    }
  }
  if (!ok) {
    log("❌ 等待登录超时");
    await ctx.close();
    process.exit(1);
  }
  log("✓ 已登录，打开原帖");

  await page.goto(`${TOPIC}/last`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  // 点底部「回复」
  const replyBtn = page.locator("#topic-footer-buttons .btn-primary, .topic-footer-main-buttons .btn-primary").first();
  if (await replyBtn.count()) {
    await replyBtn.click();
    await page.waitForTimeout(2000);
  }
  // 切 Markdown
  const md = page.locator(".d-editor-button-bar .markdown-toggle, button[title*='Markdown']").first();
  if (await md.count()) {
    await md.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  const input = page.locator(".d-editor-input").first();
  await input.waitFor({ timeout: 20000 });
  await input.fill(REPLY);
  log(`✓ 已填跟帖（${REPLY.length} 字符）`);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(root, "shots", "bbs-reply-compose.png") });

  const send = page.locator("#reply-control .save-button, #reply-control .btn-primary").first();
  await send.click();
  log("… 已点发送");
  await page.waitForTimeout(6000);
  await page.screenshot({ path: join(root, "shots", "bbs-reply-sent.png") });
  log("✓ 跟帖完成，当前：", page.url());
  await ctx.close();
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
