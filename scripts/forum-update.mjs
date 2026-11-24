/**
 * 用 Discourse API 把帖子 68960 的正文更新到 0.3.0-beta.1。
 *
 * 用法：
 *   MN_API_KEY=xxx node scripts/forum-update.mjs --dry   # 只比对，不写入
 *   MN_API_KEY=xxx node scripts/forum-update.mjs         # 真正提交
 *
 * 为什么必须先 GET raw：帖子里的图片是上传后的 upload:// 引用，
 * 用我自己拼的文本覆盖会把图全弄丢。所以流程是「抓真实 raw → 局部替换 → 原样写回」。
 */
import { EDITS as EDITS_MODULE } from "./forum-edits.mjs";

const BASE = "https://bbs.marginnote.com.cn";
const POST_ID = 151151;
const KEY = process.env.MN_API_KEY;
const USER = process.env.MN_API_USER || "Cobalt";
const DRY = process.argv.includes("--dry");

if (!KEY) {
  console.error("缺少 MN_API_KEY。请到 论坛 → 偏好设置 → 应用 → 新增 API 密钥 生成。");
  process.exit(1);
}

const headers = { "Api-Key": KEY, "Api-Username": USER, "Content-Type": "application/json" };

/** 每处改动：[名称, 原文匹配（字符串或正则）, 替换内容]；任一处未命中即中止 */
// 改动清单见 scripts/forum-edits.mjs（与浏览器脚本共用）
const EDITS = EDITS_MODULE;
for (const [name, pattern, replacement] of EDITS) {
  const before = out;
  out = out.replace(pattern, replacement);
  if (out === before) missed.push(name);
}

if (missed.length > 0) {
  console.error("\n以下改动未命中（原文可能已被改动，脚本不会写入任何内容）：");
  for (const m of missed) console.error("  ✗ " + m);
  process.exit(2);
}

console.log(`全部 ${EDITS.length} 处替换命中，新正文 ${out.length} 字符（+${out.length - raw.length}）`);

if (DRY) {
  console.log("\n--dry 模式：未提交。加 --write 才真正写入。");
  process.exit(0);
}
if (!process.argv.includes("--write")) {
  console.log("\n需要显式加 --write 才会提交。");
  process.exit(0);
}

const put = await fetch(`${BASE}/posts/${POST_ID}.json`, {
  method: "PUT",
  headers,
  body: JSON.stringify({ post: { raw: out } }),
});
if (!put.ok) {
  console.error(`写入失败 HTTP ${put.status}：${(await put.text()).slice(0, 400)}`);
  process.exit(1);
}
console.log("已提交，帖子 68960 更新完成。");
