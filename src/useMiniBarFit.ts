/* eslint-disable no-restricted-globals, no-restricted-syntax -- 需要读 <html data-mode> 与调用 mn.size */
/**
 * 迷你条自适应：按按钮数量把面板改成刚好的长条尺寸。
 * 横向 = 一长条（宽随按钮数增长）；竖向 = 一根立柱（高随按钮数增长）。
 *
 * 注意：不能用 window.innerWidth 当上限——mini 模式下它就是当前那个小面板的宽度（约 90px），
 * 拿它做 clamp 会把目标尺寸压回原样，表现为「怎么调都不变」。
 */
import { useEffect, useState } from "react";

import { logEvent } from "./debug/log";

const BTN = 28; // 与 .mini-btn.icon 一致
const GAP = 8; // 与 .mini-bar 的 gap 一致
const BADGE = 30; // 徽章 22 + 与首个按钮的间距 8
const PAD = 20;
const EDGE = 4;

/** 长条上限：横向最宽 460、竖向最高 460，超出就让按钮换行 */
const MAX_LONG = 460;
const MAX_SHORT = 320;

function readMini(): boolean {
  return document.documentElement.getAttribute("data-mode") === "mini";
}

export function useMiniBarFit(count: number, vertical: boolean, expanded: boolean) {
  const [mini, setMini] = useState(readMini);

  useEffect(() => {
    const obs = new MutationObserver(() => setMini(readMini()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
    return () => obs.disconnect();
  }, []);

  const active = mini || expanded;

  useEffect(() => {
    if (!active) return;
    const api = (window as unknown as { mn?: { size?: (w: number, h: number) => void } }).mn;
    if (!api?.size) {
      logEvent("mini", "mn.size 不可用");
      return;
    }

    const n = Math.max(1, count);
    const long = Math.min(MAX_LONG, n * BTN + (n - 1) * GAP + PAD + EDGE + BADGE);

    // 等宿主切完 mini 标记、DOM 定型后再量真实尺寸——按按钮数估算总会漏掉某些元素
    const timer = setTimeout(() => {
      const bar = document.querySelector(".mini-bar");
      const pad = 10;
      // 竖向高度按按钮数算：若读 scrollHeight，面板变矮会让内容被压缩，下一轮测得更矮，形成自我收缩
      const vH = 26 + 6 + n * 36 + 16;
      const vW = BTN + 26; // 按钮 30 + 两侧留白，太窄会把图标挤没
      if (vertical) {
        api.size?.(vW, Math.min(MAX_LONG, Math.max(80, vH)));
        logEvent("mini", `竖 ${n} 个按钮 → ${vW}×${Math.min(MAX_LONG, vH)}`);
        return;
      }
      if (bar) {
        const rw = Math.round(bar.scrollWidth) + pad;
        const rh = Math.round(bar.scrollHeight) + pad;
        api.size?.(Math.min(MAX_LONG, Math.max(120, rw)), Math.min(MAX_SHORT, Math.max(46, rh)));
        logEvent("mini", `横 实测 ${rw}×${rh} → 长条`);
        return;
      }
      // DOM 还没出来时退回估算
      const rowW = n * BTN + (n - 1) * GAP + PAD;
      api.size?.(vertical ? Math.min(MAX_SHORT, BTN + PAD) : Math.min(MAX_LONG, rowW), vertical ? long : Math.min(MAX_SHORT, BTN + PAD));
      logEvent("mini", `${vertical ? "竖" : "横"} 估算 ${n} 个按钮`);
    }, 320);

    return () => clearTimeout(timer);
  }, [active, count, vertical]);
}
