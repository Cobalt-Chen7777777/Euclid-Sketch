/**
 * 生成 GitHub Release 说明：从 CHANGELOG.md 提取当前版本段落。
 * 版本号读 mnaddon.json，避免每次发版改脚本。
 * 用法：node scripts/release-body.mjs（输出到 release-body.md）
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(join(root, "mnaddon.json"), "utf8")).version;
const md = readFileSync(join(root, "CHANGELOG.md"), "utf8");

const esc = version.replace(/\./g, "\\.");
const re = new RegExp(`## ${esc}[\\s\\S]*?(?=\\n## |$)`);
const section = md.match(re)?.[0]?.trim() ?? `## ${version}\n\n见 CHANGELOG.md。`;

writeFileSync(join(root, "release-body.md"), `${section}\n\n---\n\n安装包见附件（\`.mnaddon\` + \`.mntemplate\`，建议都装；仅装插件时卡片菜单命令不出现）。\n`);
console.log(`release-body.md 已生成（${version}，${section.length} 字符）`);
