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

    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastHeight = -1;

    // 护栏：高度差小于 8px 不触发（切换开关引起的细微重排不该改面板高度）；且 350ms 内只触发一次。
    // 键盘弹起/收起会让面板高度来回变化，没有护栏时 mn.fit() 会和宿主反复拉锯。
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        const height = element.getBoundingClientRect().height;
        if (Math.abs(height - lastHeight) < 8) return;
        lastHeight = height;
        fitPanelHeight();
      }, 350);
    };

    // 首次开启立刻对齐一次，后续交给尺寸观察
    schedule();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;
    observer?.observe(element);

    return () => {
      observer?.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  return ref;
}
