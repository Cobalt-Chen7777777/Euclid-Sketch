/**
 * 改写主帖（68960 一楼）：正文走 composer（含附件上传），标题走「编辑标题」入口。
 * 用法：node scripts/forum/edit-main-post.mjs
 */
import { chromium } from "playwright-core";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE = join(root, "shots", "bbs-profile");
const TOPIC = "https://bbs.marginnote.com.cn/t/topic/68960";
const VERSION = JSON.parse(readFileSync(join(root, "mnaddon.json"), "utf8")).version;
const TITLE = "【第三方MN插件】Euclid Sketch——数学模型构图：把草稿纸搬进 MarginNote";
const MN = join(root, "release", "Euclid Sketch-" + VERSION + ".mnaddon");
const TPL = join(root, "release", "Euclid Sketch-" + VERSION + ".mntemplate");
/** 历史正式版的包也一并挂到帖子里（GitHub 上每个版本都发布过，社区这边同样保留） */
const HISTORY = ["0.2.0", "0.1.0"]
  .flatMap((v) => [
    join(root, "release", "Euclid Sketch-" + v + ".mnaddon"),
    join(root, "release", "Euclid Sketch-" + v + ".mntemplate"),
  ])
  .filter((p) => existsSync(p));

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const body = readFileSync(join(root, "docs", "community-main-post.md"), "utf8");
  const ctx = await chromium.launchPersistentContext(PROFILE, {
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: false,
    viewport: null,
    args: ["--start-maximized"],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(TOPIC, { timeout: 60000, waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const logged = await page.evaluate(() => Boolean(document.querySelector(".header-dropdown-toggle img.avatar, #current-user img.avatar")));
  if (!logged) {
    log("❌ 未登录");
    await ctx.close();
    process.exit(1);
  }

  // ---------- 1) 正文 ----------
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(1000);
  if (!(await page.locator("#reply-control.open").count())) {
    await page.locator("#post_1 .post-controls .edit").first().click();
  }
  await page.locator("#reply-control").waitFor({ timeout: 20000 });
  await page.waitForTimeout(3000);
  log("✓ composer 就绪");

  await page.locator(".d-editor-input").first().click({ force: true }).catch(() => {});
  const md = page.locator(".d-editor-button-bar .markdown-toggle, button[title*='Markdown']").first();
  if (await md.count()) {
    await md.click().catch(() => {});
    await page.waitForTimeout(600);
  }
  const input = page.locator(".d-editor-input").first();
  await input.waitFor({ timeout: 15000 });

  // 标题字段与正文同在一个 composer：先填标题，避免依赖「编辑标题」弹窗
  const titleField = page.locator("#reply-title, input.d-editor-title").first();
  if ((await titleField.count()) && (await titleField.isEditable().catch(() => false))) {
    await titleField.fill(TITLE);
    log("… 标题已填入");
  } else log("… 标题字段不可用，跳过");
  await input.fill("");
  let filled = false;
  const fileInput = page.locator('#reply-control input[type="file"]').first();
  if (await fileInput.count()) {
    await fileInput.setInputFiles([MN, TPL, ...HISTORY]);
    log("… 上传两个安装包");
    for (let i = 0; i < 20; i += 1) {
      await page.waitForTimeout(2000);
      const draft = await input.inputValue();
      const links = draft.match(/\[[^\]\n]*\]\(upload:\/\/[^)\n]+\)[^\n]*/g) ?? [];
      if (links.length >= 6) {
        log(`✓ 附件链接 ${links.length} 条`);
        // 按文件名挑链接：主推版本 + 历史版本分别填进两个占位符
        const pick = (name) => links.find((l) => l.includes(name)) ?? "";
        const cur = ["0.2.1.mntemplate", "0.2.1.mnaddon"]
          .map(pick).filter(Boolean).map((l) => "- " + l).join("\n");
        const hist = ["0.2.0.mntemplate", "0.2.0.mnaddon", "0.1.0.mntemplate", "0.1.0.mnaddon"]
          .map(pick).filter(Boolean).map((l) => "- " + l).join("\n");
        const injected = body.replace("{{ATTACH_CURRENT}}", cur).replace("{{ATTACH_HISTORY}}", hist);
        await input.fill(injected);
        filled = true;
        break;
      }
    }
    if (!filled) log("⚠️ 未取到两条附件链接");
  } else {
    log("⚠️ 未找到附件上传入口");
  }
  if (!filled) await input.fill(body);
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(root, "shots", "bbs-mainpost-compose.png") });

  const save = page.locator("#reply-control .save-button, #reply-control .btn-primary").first();
  await save.click();
  log("… 保存正文");
  await page.waitForTimeout(9000);
  log("✓ 正文已保存：", page.url());

  // ---------- 2) 标题 ----------
  const editTopic = page.locator("button.edit-topic, .title-wrapper .edit-topic").first();
  if (await editTopic.count()) {
    await editTopic.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
    const titleInput = page.locator("#edit-topic-title-input, .edit-topic-title input").first();
    if (await titleInput.count()) {
      await titleInput.fill(TITLE);
      const okBtn = page.locator(".modal-footer .btn-primary, .dialog-footer .btn-primary, #edit-topic .btn-primary").first();
      if (await okBtn.count()) {
        await okBtn.click();
        await page.waitForTimeout(3500);
        log("✓ 标题已更新");
      } else log("⚠️ 未找到标题保存按钮");
    } else log("⚠️ 未找到标题输入框");
  } else {
    log("⚠️ 未找到「编辑标题」入口");
  }

  await page.screenshot({ path: join(root, "shots", "bbs-mainpost-saved.png") });
  log("✓ 完成");
  await ctx.close();
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
