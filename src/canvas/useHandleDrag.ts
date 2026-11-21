/* eslint-disable no-restricted-globals -- 手势必须挂 window 级监听（iOS 上 SVG 的 pointer capture 会丢 move 事件） */
/**
 * 控制点拖动：window 级 pointermove/pointerup 监听。
 * iOS WKWebView 里 SVG 上的 setPointerCapture 并不可靠（move 事件常丢失），
 * 所以拖动手势统一走 window，命中判定仍在 pointerdown 时做一次。
 */
import { useEffect, useRef } from "react";

import type { Handle } from "../model/geometry";
import type { Point2, Shape } from "../model/types";

interface Options {
  svgRef: React.RefObject<SVGSVGElement | null>;
  /** 屏幕点 → 世界坐标（含是否吸附） */
  toWorldAt: (sp: Point2, allowGrid: boolean) => Point2;
  setShapes: (updater: (prev: Shape[]) => Shape[]) => void;
}

export function useHandleDrag({ svgRef, toWorldAt, setShapes }: Options) {
  const active = useRef<{ id: string; handle: Handle } | null>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const st = active.current;
      const svg = svgRef.current;
      if (!st || !svg) return;
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const sp = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      // 切线手柄不吸附（否则被旁边顶点拽住），其余控制点只吸附已有点
      const world = toWorldAt(sp, !st.handle.id.startsWith("h"));
      setShapes((prev) => prev.map((s) => (s.id === st.id ? st.handle.apply(s, world) : s)));
    };
    const end = () => { active.current = null; };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [svgRef, toWorldAt, setShapes]);

  return {
    start: (id: string, handle: Handle) => { active.current = { id, handle }; },
    isActive: () => active.current !== null,
  };
}
