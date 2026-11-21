/** 只改帖子标题（#reply-title 在编辑态是 readonly，需先解除再派发输入事件） */
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PROFILE = join(root, "shots", "bbs-profile");
const TOPIC = "https://bbs.marginnote.com.cn/t/topic/68960";
const VERSION = JSON.parse(readFileSync(join(root, "mnaddon.json"), "utf8")).version;
const TITLE = `【第三方MN插件】Euclid Sketch (${VERSION})——数学模型构图：把草稿纸搬进 MarginNote`;

const ctx = await chromium.launchPersistentContext(PROFILE, {
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: false, viewport: null, args: ["--start-maximized"],
});
const page = ctx.pages()[0] ?? (await ctx.newPage());
await page.goto(TOPIC, { timeout: 60000, waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.keyboard.press("Escape").catch(() => {});
await page.waitForTimeout(600);
await page.locator("#post_1 .post-controls .edit").first().click();
await page.waitForTimeout(3000);
await page.locator("#reply-title").evaluate((el) => { el.removeAttribute("readonly"); el.removeAttribute("disabled"); });
await page.locator("#reply-title").click();
await page.keyboard.press("Control+A");
await page.keyboard.type(TITLE, { delay: 8 });
await page.locator("#reply-title").evaluate((el) => el.blur());
await page.waitForTimeout(400);
const applied = (await page.locator("#reply-title").inputValue()) === TITLE;
console.log("标题写入:", applied);
await page.waitForTimeout(600);
await page.locator("#reply-control .save-button, #reply-control .btn-primary").first().click();
console.log("… 保存");
await page.waitForTimeout(9000);
const now = await page.title();
console.log("页面标题:", now);
await page.screenshot({ path: join(root, "shots", "bbs-title-fixed.png") });
await ctx.close();
