/**
 * 渲染自检：把「有多少图形、多少条曲线、多少条渲染成空路径」打进诊断日志。
 * 曲线消失这类问题光看现象判断不了是「数据没了」还是「画不出来」，这条日志能分开。
 */
import { useEffect, useRef } from "react";

import { logEvent } from "../debug/log";
import type { Shape } from "../model/types";

interface Opts {
  shapes: Shape[];
  /** 视口尺寸：跨度异常时曲线会算成 NaN，一并记录 */
  viewport: { xRange: [number, number]; yRange: [number, number]; width: number };
  /** 已渲染出的 path 数量（由 ShapeLayer 统计） */
  renderedInk?: number;
}

export function useRenderAudit({ shapes, viewport, renderedInk }: Opts) {
  const lastRef = useRef({ total: -1, ink: -1, bad: -1 });

  useEffect(() => {
    const ink = shapes.filter((s) => s.type === "ink").length;
    const bad = renderedInk === undefined ? -1 : Math.max(0, ink - renderedInk);
    const last = lastRef.current;
    // 只在数量或异常数变化时记，避免每帧刷屏
    if (last.total === shapes.length && last.ink === ink && last.bad === bad) return;
    lastRef.current = { total: shapes.length, ink, bad };

    const spanX = +(viewport.xRange[1] - viewport.xRange[0]).toFixed(3);
    const spanY = +(viewport.yRange[1] - viewport.yRange[0]).toFixed(3);
    logEvent(
      bad > 0 ? "render.bad" : "render",
      `shapes=${shapes.length} ink=${ink} drawn=${renderedInk ?? "?"} span=${spanX}×${spanY} w=${Math.round(viewport.width)}`,
    );
  }, [shapes, viewport, renderedInk]);
}
