/**
 * 校验三处版本号是否一致：mnaddon.json / package.json / src/version.ts。
 *
 * 发版时最容易漏的是 src/version.ts —— 应用内「设置 → 关于」显示的就是它，
 * 漏改会出现「包装的是 beta.2、界面写着 beta.7」。
 *
 * 用法：node scripts/check-version.mjs（由 pnpm check 调用）
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(join(root, file), "utf8");

const manifestVersion = JSON.parse(read("mnaddon.json")).version;
const packageVersion = JSON.parse(read("package.json")).version;
const appMatch = read("src/version.ts").match(/APP_VERSION\s*=\s*["']([^"']+)["']/);

if (!appMatch) {
  console.error("src/version.ts 里找不到 APP_VERSION 常量，检查它是否被改名或删掉。");
  process.exit(1);
}

const rows = [
  ["mnaddon.json", manifestVersion],
  ["package.json", packageVersion],
  ["src/version.ts", appMatch[1]],
];

const mismatched = rows.filter(([, version]) => version !== manifestVersion);
if (mismatched.length > 0) {
  console.error("版本号不一致：");
  for (const [file, version] of rows) {
    const bad = version !== manifestVersion;
    console.error(`  ${bad ? "✗" : "✓"} ${file}: ${version}`);
  }
  console.error(`\n三处都应以 mnaddon.json 为准，改成 ${manifestVersion} 后重新运行。`);
  process.exit(1);
}

console.log(`版本一致：${manifestVersion}`);
