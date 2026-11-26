/* eslint-disable no-restricted-globals, no-restricted-syntax -- 需要读 <html data-mode> 与调用 mn.size */
/**
 * 迷你条自适应：按按钮数量把面板改成刚好的长条尺寸。
 * 横向 = 一长条（宽随按钮数增长）；竖向 = 一根立柱（高随按钮数增长）。
 *
 * 注意：不能用 window.innerWidth 当上限——mini 模式下它就是当前那个小面板的宽度（约 90px），
 * 拿它做 clamp 会把目标尺寸压回原样，表现为「怎么调都不变」。
 *
 * 关键约束：目标尺寸只能有**一处**计算。此前 420ms 后应用和 resize 纠回各用一套常量
 * （44 / 实测值、+20 / +16），两边来回拉扯，表现就是「切后台回来 UI 自己变大变小」。
 */
import { useEffect, useState } from "react";

import { logEvent } from "./debug/log";

const BTN = 30; // 与 mini 模式 .mini-btn.icon 一致
const GAP = 6; // 与 mini 模式 .mini-bar 的 gap 一致
const BAR_PAD = 20; // body 左右 padding（10 + 10）
const V_TOP = 26 + 6; // 竖排：徽章 26 + 与首个按钮的间距
const V_BOTTOM = 16;
const H_FALLBACK = 64;

/** 长条上限：横向最宽 460、竖向最高 460 */
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
    /** 本轮连续纠正次数：宿主不接受这个尺寸时别硬顶，避免和它打乒乓 */
    let fixes = 0;
    /** 展开态是否已经应用过一次 */
    let applied = false;

    /** 唯一的目标尺寸来源：首次应用与 resize 纠回都走这里，避免两套值互相拉扯 */
    const target = (): { w: number; h: number } => {
      if (vertical) {
        // 竖向高度按按钮数算：读 scrollHeight 会被当前面板高度反过来压缩，形成自我收缩
        const w = Math.min(MAX_SHORT, BTN + 2 * 10 + 6); // 30 + 左右留白 + 余量 = 56
        const h = Math.min(MAX_LONG, V_TOP + n * (BTN + GAP) + V_BOTTOM);
        return { w, h };
      }
      const bar = document.querySelector(".mini-bar");
      // display:none 时 scrollWidth 为 0（非 mini 的展开态），这时量不出宽度，退回估算
      if (bar && bar.scrollWidth > 0) {
        // 横排按 DOM 实测：徽章、换行、字体宽度都会影响，按按钮数估算永远差几十像素
        const w = Math.min(MAX_LONG, Math.max(120, Math.round(bar.scrollWidth) + BAR_PAD));
        const h = Math.min(MAX_SHORT, Math.max(46, Math.round(bar.scrollHeight) + BAR_PAD));
        return { w, h };
      }
      // DOM 还没出来时退回估算（徽章 + n 个按钮）
      const w = Math.min(MAX_LONG, Math.max(120, 26 + GAP + n * BTN + (n - 1) * GAP + BAR_PAD));
      return { w, h: H_FALLBACK };
    };

    const apply = () => {
      const { w, h } = target();
      const isMini = readMini();
      if (!isMini) {
        // 展开态只需要按内容调一次尺寸；反复调会和宿主的窗口动画打架
        if (applied) return;
        applied = true;
        api.size?.(w, h);
        logEvent("mini", `展开态 ${n} 个按钮 → ${w}×${h}`);
        return;
      }
      // 幂等的判据是「面板现状是否已经到位」，不是「目标值是否变过」：
      // 宿主切后台回来会把面板重置成默认小窗，目标值没变但面板已经不对了，
      // 只比目标值就会漏掉这种情况——这正是「切回来 UI 错乱」修不掉的原因。
      // mini 模式下 window.innerWidth/innerHeight 就是面板自身尺寸。
      const curW = window.innerWidth;
      const curH = window.innerHeight;
      if (Math.abs(curW - w) < 8 && Math.abs(curH - h) < 8) {
        fixes = 0;
        return;
      }
      if (fixes >= 3) return;
      fixes += 1;
      api.size?.(w, h);
      logEvent("mini", `${vertical ? "竖" : "横"} ${n} 个按钮 → ${w}×${h}（当前 ${curW}×${curH}）`);
    };

    // 等宿主切完 mini 标记、DOM 定型后再量真实尺寸；420ms 避开 MN 自己的展开动画
    const timer = setTimeout(apply, 420);
    // 宿主会自己重置过面板尺寸（切后台回来、旋转、动画收尾），尺寸一变就纠回来
    const onResize = () => {
      fixes = 0;
      apply();
    };
    window.addEventListener("resize", onResize);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", onResize);
    };
  }, [active, count, vertical]);
}
