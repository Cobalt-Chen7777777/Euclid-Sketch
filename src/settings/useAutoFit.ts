/**
 * 面板高度跟随内容（官方 mn.fit()）。
 *
 * 官方说明：mn.fit() 把面板高度调整为 <html> 的高度，页面加载完成后 MN 会自动调用一次，
 * 内容变化时建议再次调用。本 Hook 用 ResizeObserver 监听根容器，内容变高变矮就重算一次，
 * 并用 rAF 合并连续抖动，避免频繁调用原生桥。
 */
import { useEffect, useRef } from "react";

const isMnAvailable = (): boolean => typeof mn !== "undefined";

/** 一次性把面板高度调整为内容高度 */
export function fitPanelHeight(): void {
  if (isMnAvailable()) mn.fit();
}

export function useAutoFitHeight(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!enabled || !element) return;

    let frame = 0;
    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        fitPanelHeight();
      });
    };

    // 首次开启立刻对齐一次，后续交给尺寸观察
    schedule();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    observer?.observe(element);

    return () => {
      observer?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [enabled]);

  return ref;
}
