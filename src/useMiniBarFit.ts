/* eslint-disable no-restricted-globals, no-restricted-syntax -- 需要读视口尺寸与 <html data-mode> 判断迷你模式 */
/**
 * 迷你条自适应：按按钮数量把面板调成合适的长条尺寸。
 * 横向 = 一长条（宽随按钮数增长）；竖向 = 一根立柱（高随按钮数增长）。
 * MN 的 mini 面板尺寸固定，按钮多了只能滑动——这里主动把面板改成内容尺寸。
 */
import { useEffect, useState } from "react";

const BTN = 30;
const GAP = 4;
const BADGE = 22;
const PAD = 20;
const EDGE = 2;

const clamp = (v: number, max: number) => Math.max(BTN + PAD, Math.min(v, Math.floor(max * 0.92)));

/** 迷你模式由宿主写 <html data-mode="mini">，自己点收起时只是改了 CSS，所以要监听属性 */
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
    if (!active || count <= 0) return;
    const api = (window as unknown as { mn?: { size?: (w: number, h: number) => void } }).mn;
    if (!api?.size) return;

    const timer = setTimeout(() => {
      const viewW = window.innerWidth || 420;
      const viewH = window.innerHeight || 800;
      const span = count * BTN + (count - 1) * GAP + PAD + EDGE;
      if (vertical) api.size?.(clamp(BTN + BADGE + PAD, viewW), clamp(span + BADGE, viewH));
      else api.size?.(clamp(span + BADGE, viewW), clamp(BTN + PAD, viewH));
    }, 300);

    return () => clearTimeout(timer);
  }, [active, count, vertical]);
}
