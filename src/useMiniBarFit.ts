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
    const short = Math.min(MAX_SHORT, BTN + PAD + EDGE);

    // 等宿主切完 mini 标记再改尺寸，避免和它的布局动画打架
    const timer = setTimeout(() => {
      if (vertical) api.size?.(short, long);
      else api.size?.(long, short);
      logEvent("mini", `${vertical ? "竖" : "横"} ${n} 个按钮 → ${vertical ? `${short}×${long}` : `${long}×${short}`}`);
    }, 320);

    return () => clearTimeout(timer);
  }, [active, count, vertical]);
}
