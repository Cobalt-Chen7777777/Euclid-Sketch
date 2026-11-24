/**
 * 通过 CDP 编辑 GitHub Release：更新正文、替换附件、标为 pre-release。
 * 用法：node scripts/github-release.mjs [--dry]
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { chromium } from "playwright-core";

const REPO = "Cobalt-Chen7777777/Euclid-Sketch";
const TAG = "v0.3.0-beta.1";
const DRY = process.argv.includes("--dry");

const body = await readFile("release-body.md", "utf8");
const assets = [
  resolve("release/Euclid Sketch-0.3.0-beta.1.mntemplate"),
  resolve("release/Euclid Sketch-0.3.0-beta.1.mnaddon"),
];

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${process.env.CDP_PORT || "9222"}`);
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
await page.goto(`https://github.com/${REPO}/releases/edit/${TAG}`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const loggedIn = await page.evaluate(() => !!document.querySelector('meta[name=user-login]') || !!document.querySelector('.Header-link .avatar'));
console.log("GitHub 登录:", loggedIn ? "是" : "否");
if (!loggedIn) process.exit(1);

// 现有附件
const old = await page.evaluate(() =>
  [...document.querySelectorAll('.Box-row a[href*="/releases/download/"]')].map((a) => a.getAttribute("href").split("/").pop()),
);
console.log("现有附件:", old.join(", ") || "（无）");

if (DRY) {
  console.log("\n--dry：不写入。");
  await browser.close();
  process.exit(0);
}

// 1) 正文（GitHub 用 CodeMirror 或 textarea，两种都试）
const filled = await page.evaluate((text) => {
  const ta = document.querySelector('textarea[name="release[body]"], #release-body-textarea');
  if (ta) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(ta, text);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    return "textarea";
  }
  const cm = document.querySelector(".CodeMirror");
  if (cm?.CodeMirror) {
    cm.CodeMirror.setValue(text);
    return "codemirror";
  }
  return null;
}, body);
console.log("正文写入方式:", filled ?? "失败");

// 2) 删掉旧附件（每个附件行有删除按钮）
const removed = await page.evaluate(() => {
  const rows = [...document.querySelectorAll(".Box-row")].filter((r) => r.querySelector('a[href*="/releases/download/"]'));
  let n = 0;
  for (const row of rows) {
    const del = row.querySelector('button[aria-label*="Delete"], .js-delete-asset, form[action*="/asset"] button, .octicon-trash');
    if (del instanceof HTMLElement) { del.click(); n += 1; }
  }
  return n;
});
console.log("已点删除的旧附件数:", removed);
await page.waitForTimeout(1500);

// 3) 上传新包
const input = page.locator('input[type="file"]').first();
await input.setInputFiles(assets);
console.log("开始上传新包，等待完成…");
await page.waitForTimeout(12000);

// 4) 勾 pre-release
const pre = page.locator('#release-prerelease, input[name="release[prerelease]"]').first();
if (await pre.count()) {
  const checked = await pre.isChecked();
  if (!checked) await pre.check();
  console.log("pre-release:", true);
}

// 5) 保存
const save = page.locator('button:has-text("Update release"), button:has-text("更新发行版")').first();
await save.click({ timeout: 10000 });
await page.waitForTimeout(5000);
const url = page.url();
console.log("已提交，当前地址:", url);
await browser.close();
