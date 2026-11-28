/**
 * 把本地文件传到论坛（图片、.mnaddon / .mntemplate 都走这里），拿回能放进正文的引用。
 *
 *   node scripts/forum-upload.mjs --check            # 只检查连接与登录状态
 *   node scripts/forum-upload.mjs a.png b.mnaddon   # 上传并打印引用
 *
 * 前提：Chrome 带调试端口启动且已登录论坛：
 *   "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 * 端口可用 CDP_PORT 覆盖。
 *
 * 请求用 Playwright 的 ctx.request 发：它直接复用浏览器里的登录 Cookie，不经过页面，
 * 因此不受 CORS / 混合内容 / 本地网络权限的限制，多大的包都能一次传完。
 */
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

import { chromium } from "playwright-core";

const BASE = "https://bbs.marginnote.com.cn";
const PORT_CDP = process.env.CDP_PORT || "9222";
const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".md": "text/markdown",
};

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const paths = args.filter((a) => !a.startsWith("--"));

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT_CDP}`).catch(() => null);
if (!browser) {
  console.error(`连不上 Chrome 的调试端口 ${PORT_CDP}。先用带端口的方式启动 Chrome：\n`);
  console.error(`  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=${PORT_CDP}\n`);
  console.error("启动后在这个窗口里登录论坛，再跑一次。");
  process.exit(1);
}

const ctx = browser.contexts()[0];
if (!ctx) {
  console.error("没拿到浏览器上下文，确认 Chrome 是用 --remote-debugging-port 启动的。");
  process.exit(1);
}
const req = ctx.request;

/** 匿名访问时 /u/current.json 也会返回占位用户，只有 /notifications.json 分得清：匿名 403、登录 200 */
const notif = await req.get(`${BASE}/notifications.json?limit=1`, { headers: { Accept: "application/json" } }).catch(() => null);
if (!notif || notif.status() !== 200) {
  console.error("这个浏览器没有登录论坛（先在其中登录 bbs.marginnote.com.cn）。");
  process.exit(1);
}
let who = "未知用户";
try {
  const j = await (await req.get(`${BASE}/u/current.json`, { headers: { Accept: "application/json" } })).json();
  who = j.user?.username ?? who;
} catch {
  // 名字取不到不影响上传
}

if (checkOnly && paths.length === 0) {
  console.log(`连接正常，已登录：${who}`);
  process.exit(0);
}

const csrf = (
  await (await req.get(`${BASE}/session/csrf.json`, { headers: { Accept: "application/json" } })).json()
).csrf;
if (!csrf) {
  console.error("取不到 CSRF，登录状态可能失效了。");
  process.exit(1);
}

/** 一次传一个文件，返回状态与响应体 */
async function upload(path) {
  const name = basename(path);
  const type = MIME[extname(path).toLowerCase()] ?? "application/octet-stream";
  const buffer = await readFile(path);
  const res = await req.post(`${BASE}/uploads.json?short_url=1`, {
    headers: { "X-CSRF-Token": csrf, "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
    multipart: { upload_type: "composer", "files[]": { name, mimeType: type, buffer } },
    timeout: 120000,
  });
  let body = {};
  try {
    body = await res.json();
  } catch {
    body = {};
  }
  return { status: res.status(), body };
}

const lines = [];
for (const p of paths) {
  const name = basename(p);
  let result = await upload(p);
  for (let attempt = 0; attempt < 3 && result.status === 429; attempt += 1) {
    const msg = (result.body.errors ?? []).join(" ");
    const wait = Number(/(\d+)\s*秒/.exec(msg)?.[1] ?? 30) + 3;
    console.error(`… ${name} 被限流，${wait} 秒后重试`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    result = await upload(p);
  }
  if (result.status === 200 && result.body.short_url) {
    const tail = String(result.body.short_url).replace("upload://", "");
    lines.push(`${name}  →  ${result.body.short_url}\n           ${BASE}/uploads/short-url/${tail}`);
    console.log(`✓ ${name}`);
  } else {
    console.error(`✗ ${name}：${(result.body.errors ?? []).join(" ") || `HTTP ${result.status}`}`);
  }
}

if (lines.length > 0) {
  console.log("\n=== 可直接放进正文 ===");
  for (const l of lines) console.log(l);
}

await browser.close();
