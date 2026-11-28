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
import { useEffect, useRef, useState } from "react";

import { logEvent } from "./debug/log";
import { issuePanelSize } from "./panelSize";

const BTN = 34; // 与 mini 模式 .mini-btn.icon 的 --mini-btn 一致
const GAP = 2; // 与 .mini-bar 的 --mini-gap 一致
// 徽章 26 + 两侧 gap + 分隔线 1 + 两侧各 6px 呼吸位（margin 在 gap 之外叠加，别漏）
const BADGE_BLOCK = 26 + GAP + 6 + 1 + 6 + GAP;
const BAR_PAD = 16; // .mini-bar 的四周边距（8 + 8）
const H_FALLBACK = 50; // 单行高度：8 + 34 + 8

/** 长条上限：横向最宽 460、竖向最高 460 */
const MAX_LONG = 460;
const MAX_SHORT = 320;

/**
 * 迷你条的目标尺寸（纯栅格估算，不读 DOM）。
 * 收起瞬间 DOM 还没定型，只能先按这套常量给宿主一个准确值；
 * 随后 useMiniBarFit 会按 DOM 实测再校正一次（两者一致，不会二次跳动）。
 */
export function estimateMiniSize(count: number, vertical: boolean): { w: number; h: number } {
  const n = Math.max(1, count);
  // 竖排不画分隔线：徽章 26 + 下留白 6 + 与下一个按钮的 gap
  const badgeBlock = vertical ? 26 + 6 + GAP : BADGE_BLOCK;
  const longSide = BAR_PAD + badgeBlock + n * BTN + (n - 1) * GAP;
  const shortSide = BAR_PAD + BTN;
  return vertical
    ? { w: Math.min(MAX_SHORT, shortSide), h: Math.min(MAX_LONG, longSide) }
    : { w: Math.min(MAX_LONG, longSide), h: Math.min(MAX_SHORT, shortSide) };
}

function readMini(): boolean {
  return document.documentElement.getAttribute("data-mode") === "mini";
}

export function useMiniBarFit(count: number, vertical: boolean, collapsed: boolean) {
  const [mini, setMini] = useState(readMini);

  useEffect(() => {
    const obs = new MutationObserver(() => setMini(readMini()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
    return () => obs.disconnect();
  }, []);

  const active = mini || collapsed;

  /**
   * 兜底：并非所有宿主都会在 mn.mode("mini") 后写 <html data-mode>。
   * 真机上出现过「面板缩成了条尺寸，但仍按 workspace 布局渲染」—— 结果是一片空白小面板
   * （body 的 44px 顶部留白把内容全挤掉了）。这里在收起态自己补上标记，展开时再交还。
   */
  const selfSet = useRef(false);
  useEffect(() => {
    const el = document.documentElement;
    const current = el.getAttribute("data-mode");
    if (active && current !== "mini") {
      el.setAttribute("data-mode", "mini");
      selfSet.current = true;
      return;
    }
    if (!active && selfSet.current && current === "mini") {
      el.removeAttribute("data-mode");
      selfSet.current = false;
    }
  }, [active]);

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

    /** 唯一的目标尺寸来源：首次应用与 resize 纠回都走这里，避免两套值互相拉扯 */
    // 统一栅格：BAR_PAD + 徽章块 + n 个按钮 + (n-1) 个间距（横竖同构，只是主轴不同）
    // 竖排不画分隔线，徽章块 = 26 + 6（下留白）
    // 竖排不画分隔线：徽章 26 + 下留白 6 + 与下一个按钮的 gap
  const badgeBlock = vertical ? 26 + 6 + GAP : BADGE_BLOCK;
    const longSide = BAR_PAD + badgeBlock + n * BTN + (n - 1) * GAP;
    const shortSide = BAR_PAD + BTN;

    const target = (): { w: number; h: number } => {
      if (vertical) {
        // 竖向高度按按钮数算：读 scrollHeight 会被当前面板高度反过来压缩，形成自我收缩
        return { w: Math.min(MAX_SHORT, shortSide), h: Math.min(MAX_LONG, longSide) };
      }
      const bar = document.querySelector(".mini-bar");
      // display:none 时 scrollWidth 为 0（非 mini 的展开态），这时量不出宽度，退回栅格值
      if (bar && bar.scrollWidth > 0) {
        // 横排优先 DOM 实测（字体、换行都会影响），四舍五入到整数
        const w = Math.min(MAX_LONG, Math.max(120, Math.round(bar.scrollWidth)));
        const h = Math.min(MAX_SHORT, Math.max(H_FALLBACK, Math.round(bar.scrollHeight)));
        return { w, h };
      }
      return { w: Math.min(MAX_LONG, longSide), h: Math.min(MAX_SHORT, H_FALLBACK) };
    };

    const apply = () => {
      const { w, h } = target();
      // 只有真·mini 面板才调 mn.size。展开态由 useResizablePanel 负责，
      // 这里再改一次会把刚展开的面板弹回长条尺寸（展开动画回弹的根因）。
      if (!readMini()) return;
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
      // 统一出口自带「同值 700ms 内不重复下发」，避免宿主动画被重播
      if (!issuePanelSize(w, h)) return;
      logEvent("mini", `${vertical ? "竖" : "横"} ${n} 个按钮 → ${w}×${h}（当前 ${curW}×${curH}）`);
    };

    // 打开面板时先立刻撑到位：之前等 420ms 才下发，肉眼看到的就是迷你条「一截一截长出来」。
    // 收起那一侧不会重播动画 —— issuePanelSize 自带「同值 700ms 内不重复下发」。
    apply();
    // 宿主拉伸动画结束后再兜一次（动画期间量到的尺寸可能是中间值）
    const timer = setTimeout(apply, 300);
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
