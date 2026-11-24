/**
 * 借已登录的 Chrome 会话，把本地文件上传到论坛，拿回可放进正文的短链接。
 * 用法：node scripts/forum-upload.mjs <文件1> [文件2 ...]
 * 前提：Chrome 用 --remote-debugging-port=9222 启动且已登录。
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

import { chromium } from "playwright-core";

const BASE = "https://bbs.marginnote.com.cn";
const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (files.length === 0) {
  console.error("用法：node scripts/forum-upload.mjs <文件...>");
  process.exit(1);
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${process.env.CDP_PORT || "9222"}`);
const ctx = browser.contexts()[0];
const page = ctx.pages().find((p) => p.url().includes("marginnote.com.cn"));
if (!page) {
  console.error("浏览器里没有打开论坛页面，请先打开 bbs.marginnote.com.cn 并登录");
  process.exit(1);
}

// CSRF 与 cookie 从浏览器会话里取
const csrf = await page.evaluate(async () => {
  const r = await fetch("/session/csrf.json", { headers: { "X-Requested-With": "XMLHttpRequest" } });
  return (await r.json()).csrf;
});
const cookies = await ctx.cookies(BASE);
const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

const MIME = {
  ".mnaddon": "application/octet-stream",
  ".mntemplate": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

async function upload(path) {
  const buf = await readFile(path);
  const name = basename(path);
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  const form = new FormData();
  form.append("file", new Blob([buf], { type: MIME[ext] ?? "application/octet-stream" }), name);
  form.append("type", "composer");
  form.append("synchronous", "true");

  const res = await fetch(`${BASE}/uploads.json`, {
    method: "POST",
    headers: {
      "X-CSRF-Token": csrf,
      "X-Requested-With": "XMLHttpRequest",
      Cookie: cookieHeader,
    },
    body: form,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name} 上传失败 HTTP ${res.status}: ${text.slice(0, 200)}`);
  const data = JSON.parse(text);
  const rel = data.short_path || "";
  const url = rel.startsWith("/") ? BASE + rel : data.url;
  return { name, url };
}

const results = [];
for (const f of files) {
  try {
    const r = await upload(f);
    results.push(r);
    console.log(`✓ ${r.name}\n  ${r.url}`);
  } catch (e) {
    console.error(`✗ ${basename(f)}：${e.message}`);
  }
}

console.log("\n=== 可直接放进正文 ===\n");
for (const r of results) console.log(`${r.url}`);
await browser.close();
