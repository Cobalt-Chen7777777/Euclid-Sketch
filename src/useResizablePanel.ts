/**
 * 面板尺寸调整 Hook。
 *
 * 实现方式参考 CardLink 插件（同为 MN5 场景面板插件，机制在真机验证过）：
 *   1. 右下角固定 44×44 抓手，pointerdown 时 preventDefault + stopPropagation，
 *      否则这次拖拽会被宿主当成「拖动面板窗口」；
 *   2. 用 screenX / screenY 计算位移（不是 clientX / clientY）——面板一边拖一边改尺寸，
 *      视口坐标系会跟着漂移，用 client 坐标会自激抖动；
 *   3. 拖动期间**rAF 节流实时调用 mn.size**（每帧最多一次）：尺寸全程跟手。
 *      之前卡顿的三个副因已修复——宿主手势抢夺（原生 touch 拦截）、autoFit
 *      与缩放拉锯（拖动期间暂停）、画布全量重绘（frozen 冻结视口）；
 *      剩下的 mn.size 过渡动画被逐帧重设时表现为阻尼跟随，视觉平滑；
 *   4. 位移小于 4px 视为点击，恢复默认尺寸。
 *
 * 官方接口约束（dev.marginnote.com.cn）：
 *   - mn.size(w, h) 是唯一能改宽度的接口，带过渡动画
 *   - mn.height(h) 只改高度、无动画
 *   - mn.mode('mini' | 'workspace') 只改模式标记，不改尺寸，必须自己配 size
 */
import { useCallback, useEffect, useRef, useState } from "react";

/** 面板尺寸（CSS 逻辑像素，≈ pt） */
export interface PanelSize {
  width: number;
  height: number;
}

const STORAGE_KEY = "math-sketch-addon.panel-size.v1";

/** 与 mnaddon.json 的 panelWidth / panelMaxHeight 对齐 */
export const PANEL_LIMITS = {
  minWidth: 300,
  maxWidth: 900,
  minHeight: 200,
  maxHeight: 900,
  defaultWidth: 420,
  defaultHeight: 620,
  /** 收起后的迷你尺寸 */
  miniWidth: 300,
  miniHeight: 54,
} as const;

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.round(value)));

const isMnAvailable = (): boolean => typeof mn !== "undefined";

/**
 * 通知 native 层（混合插件才有 main.js 处理这些消息）。
 * 纯面板模式下 mn.call 会 reject，这里吞掉即可，不影响面板内行为。
 */
function notifyNative(name: string): Promise<unknown> {
  if (!isMnAvailable()) return Promise.reject(new Error("no mn"));
  try {
    const res = mn.call(name);
    return res.catch ? res.catch(() => null) : Promise.resolve(res);
  } catch {
    return Promise.reject(new Error("no native"));
  }
}

function readStoredSize(): PanelSize {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PanelSize>;
      if (typeof parsed.width === "number" && typeof parsed.height === "number") {
        return {
          width: clamp(parsed.width, PANEL_LIMITS.minWidth, PANEL_LIMITS.maxWidth),
          height: clamp(parsed.height, PANEL_LIMITS.minHeight, PANEL_LIMITS.maxHeight),
        };
      }
    }
  } catch {
    // 缓存不可用时回退默认尺寸
  }
  return { width: PANEL_LIMITS.defaultWidth, height: PANEL_LIMITS.defaultHeight };
}

function persistSize(size: PanelSize): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(size));
  } catch {
    // 存储不可用时仅本次会话有效
  }
}

/**
 * 面板窗口控制：拖动缩放 + 收起 / 展开 / 关闭。
 *
 * @param options.remember 是否记忆尺寸（设置项「记住窗口尺寸」），默认 true
 */
export function useResizablePanel(options?: { remember?: boolean }) {
  const remember = options?.remember !== false;
  const rememberRef = useRef(remember);
  useEffect(() => {
    rememberRef.current = remember;
  }, [remember]);

  const sizeRef = useRef<PanelSize>(
    remember
      ? readStoredSize()
      : { width: PANEL_LIMITS.defaultWidth, height: PANEL_LIMITS.defaultHeight },
  );

  /** 正在拖动把手：App 据此暂停 autoFit，避免 mn.fit() 与缩放拉锯 */
  const [isResizing, setResizing] = useState(false);
  /** 拖动中的尺寸预览（HUD 展示用；拖动期间不调宿主接口，松手才生效） */
  const [previewSize, setPreviewSize] = useState<PanelSize | null>(null);

  const appliedRef = useRef<PanelSize | null>(null);
  const applySize = useCallback((size: PanelSize) => {
    const last = appliedRef.current;
    if (last && last.width === size.width && last.height === size.height) return;
    appliedRef.current = size;
    if (isMnAvailable()) mn.size(size.width, size.height);
  }, []);

  const commit = useCallback((size: PanelSize) => {
    sizeRef.current = size;
    applySize(size);
    if (rememberRef.current) persistSize(size);
  }, [applySize]);

  // 挂载时恢复持久化尺寸；但若宿主以 mini 形态打开（native 浮条），不要撑开。
  // 同时补一次 mn.mode("mini")，确保 <html data-mode> 与 host 一致（样式靠它切换迷你布局）。
  useEffect(() => {
    if (isMnAvailable() && mn.currentMode === "mini") {
      mn.mode("mini");
      return;
    }
    applySize(sizeRef.current);
  }, [applySize]);

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!event.isPrimary || event.button !== 0) return;
      // 关键：不拦这两下，宿主会把这次拖动当成「拖动面板窗口」
      event.preventDefault();
      event.stopPropagation();

      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      setResizing(true);

      // 原生触摸拦截（与画布同款模式）：React 的 preventDefault 拦不住
      // WKWebView 宿主手势，不拦的话拖把手会同时被宿主当成「拖动窗口」导致乱动
      const stopTouch = (ev: Event) => ev.preventDefault();
      handle.addEventListener("touchstart", stopTouch, { passive: false });
      handle.addEventListener("touchmove", stopTouch, { passive: false });

      const origin = {
        pointerId: event.pointerId,
        x: event.screenX,
        y: event.screenY,
        width: sizeRef.current.width,
        height: sizeRef.current.height,
      };
      let moved = false;
      let latest: PanelSize = { width: origin.width, height: origin.height };
      let raf: number | null = null;

      // 实时跟手：rAF 每帧节流调 mn.size（过渡动画被逐帧重设 = 阻尼跟随）。
      // 卡顿副因已分别处理：宿主手势拦截 / autoFit 暂停 / 画布冻结重绘。
      const onMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== origin.pointerId) return;
        const dx = moveEvent.screenX - origin.x;
        const dy = moveEvent.screenY - origin.y;
        if (!moved && Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        latest = {
          width: clamp(origin.width + dx, PANEL_LIMITS.minWidth, PANEL_LIMITS.maxWidth),
          height: clamp(origin.height + dy, PANEL_LIMITS.minHeight, PANEL_LIMITS.maxHeight),
        };
        if (raf == null) {
          raf = requestAnimationFrame(() => {
            raf = null;
            if (isMnAvailable()) mn.size(latest.width, latest.height);
            appliedRef.current = latest;
            setPreviewSize(latest);
          });
        }
      };

      const cleanup = () => {
        if (raf != null) {
          cancelAnimationFrame(raf);
          raf = null;
        }
        setPreviewSize(null);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onCancel);
        handle.removeEventListener("lostpointercapture", onCancel);
        handle.removeEventListener("touchstart", stopTouch);
        handle.removeEventListener("touchmove", stopTouch);
        if (handle.hasPointerCapture(origin.pointerId)) {
          handle.releasePointerCapture(origin.pointerId);
        }
        setResizing(false);
      };

      const onUp = (upEvent: PointerEvent) => {
        if (upEvent.pointerId !== origin.pointerId) return;
        cleanup();
        // 没移动过 = 点击：恢复默认尺寸；否则 mn.size 一次提交最终宽高（宽度在此生效）
        if (!moved) {
          commit({ width: PANEL_LIMITS.defaultWidth, height: PANEL_LIMITS.defaultHeight });
          return;
        }
        commit(latest);
      };
      const onCancel = () => cleanup();

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onCancel);
      handle.addEventListener("lostpointercapture", onCancel);
    },
    [commit],
  );

  const resetSize = useCallback(() => {
    commit({ width: PANEL_LIMITS.defaultWidth, height: PANEL_LIMITS.defaultHeight });
  }, [commit]);

  /**
   * 收起为迷你条：只切模式标记，尺寸交给 useMiniBarFit 按 DOM 实测来定。
   * 以前这里写死 300×54，紧接着 useMiniBarFit 又改成实测的 273×50，
   * 一次收起要动两次尺寸 —— 动画上就是「先缩成一个尺寸，再跳一下」。
   */
  const collapse = useCallback(() => {
    if (!isMnAvailable()) return;
    mn.mode("mini");
    void notifyNative("collapse");
    // 记录迷你尺寸，避免展开时被「去重」拦掉
    appliedRef.current = { width: PANEL_LIMITS.miniWidth, height: PANEL_LIMITS.miniHeight };
  }, []);

  /** 从迷你条展开，恢复收起前的尺寸 */
  const expand = useCallback(() => {
    if (!isMnAvailable()) return;
    mn.mode("workspace");
    appliedRef.current = null;
    applySize(sizeRef.current);
    void notifyNative("expand");
  }, [applySize]);

  const close = useCallback(() => {
    if (!isMnAvailable()) return;
    // 混合插件里交给 native 收浮层（保留插件本体）；纯面板模式退回 mn.close()
    notifyNative("closePanel").then((res) => {
      const ok = res && typeof res === "object" && (res as { ok?: boolean }).ok;
      if (!ok) mn.close();
    }).catch(() => mn.close());
  }, []);

  /** 重载面板（会丢内存数据，用于异常恢复） */
  const reload = useCallback(() => {
    if (isMnAvailable()) mn.reload();
  }, []);

  return { onResizePointerDown, isResizing, previewSize, resetSize, collapse, expand, close, reload };
}
