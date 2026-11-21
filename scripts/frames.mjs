/** 从 mp4 抽帧（H.265 需有头 Chrome 真实播放）：node scripts/frames.mjs in.mp4 outdir n */
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [file, outDir, nArg] = process.argv.slice(2);
const n = Number(nArg ?? 10);
mkdirSync(outDir, { recursive: true });
const buf = readFileSync(file);

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: false,
  args: ["--autoplay-policy=no-user-gesture-required"],
});
const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
await page.route("**/*", async (route) => {
  const u = route.request().url();
  if (u.endsWith("/clip.mp4")) return route.fulfill({ status: 200, contentType: "video/mp4", body: buf });
  return route.fulfill({
    status: 200,
    contentType: "text/html",
    body: '<video id=v src="/clip.mp4" muted playsinline style="width:100%"></video>',
  });
});
await page.goto("http://vid.local/");
const meta = await page.evaluate(async () => {
  const v = document.getElementById("v");
  await new Promise((r) => { v.onloadeddata = r; setTimeout(r, 8000); });
  await v.play().catch(() => {});
  return { dur: v.duration, w: v.videoWidth, h: v.videoHeight };
});
console.log("video", JSON.stringify(meta));
const step = Math.max(300, (meta.dur * 1000) / n);
for (let i = 0; i < n; i += 1) {
  await page.waitForTimeout(step);
  const t = await page.evaluate(() => document.getElementById("v").currentTime);
  const data = await page.evaluate(() => {
    const v = document.getElementById("v");
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d").drawImage(v, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.88);
  });
  writeFileSync(join(outDir, `f${String(i).padStart(2, "0")}.jpg`), Buffer.from(data.split(",")[1], "base64"));
  console.log(i, "t=", t.toFixed(1));
}
await browser.close();
