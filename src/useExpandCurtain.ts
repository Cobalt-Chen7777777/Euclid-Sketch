/* eslint-disable no-restricted-globals, no-restricted-syntax -- 展开动画期间要直接改 <html data-curtain>（宿主动画结束后再还回去），这个属性不在组件树里 */
/**
 * 展开时的「幕布」：宿主是把面板窗口从小条尺寸**渐变拉伸**到面板尺寸的，
 * 这期间 DOM 已经按展开后的布局渲染，却被塞在一个 50px 宽的窗口里 ——
 * 竖向迷你条展开时看到的画面被挤扁，就是这个。
 *
 * 做法：展开的这几百毫秒里只给 <html> 挂一个 data-curtain 属性，
 * 样式表让迷你条的布局也吃这个属性（见 app.css），于是窗口长大过程中显示的还是迷你条本身；
 * 等窗口尺寸稳定下来再摘掉，面板布局才出现。
 *
 * 注意：**不要去改 data-mode**。之前为了让迷你布局生效去借用 data-mode="mini"，
 * 结果 useMiniBarFit 以为还在收起态，反过来又把尺寸压回小条 —— 竖排迷你条展开不了就是这么坏的。
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** 尺寸停止变化多久算动画结束 */
const SETTLE_MS = 180;
/** 兜底：宿主不上报 resize 时也要在这么久之后揭开 */
const MAX_MS = 900;

export function useExpandCurtain() {
  const active = useRef(false);
  const [round, setRound] = useState(0);

  const reveal = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    document.documentElement.removeAttribute("data-curtain");
  }, []);

  const expandWithCurtain = useCallback((start: () => void) => {
    document.documentElement.setAttribute("data-curtain", "1");
    active.current = true;
    setRound((n) => n + 1);
    start();
  }, []);

  useEffect(() => {
    if (round === 0 || !active.current) return;
    let settle = 0;
    let hard = 0;
    const finish = () => {
      window.clearTimeout(settle);
      window.clearTimeout(hard);
      reveal();
    };
    const onResize = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(finish, SETTLE_MS);
    };
    window.addEventListener("resize", onResize);
    hard = window.setTimeout(finish, MAX_MS);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(settle);
      window.clearTimeout(hard);
    };
  }, [round, reveal]);

  return { expandWithCurtain };
}
