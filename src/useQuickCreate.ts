/**
 * 按参数快速创建：长按工具栏图形图标 → 在视野中心放一个默认尺寸的图形并选中，
 * 绘图选项的「几何参数」随即可用（点 = x/y，圆 = 半径，线段 = 长度……）。
 */
import { useCallback } from "react";

import { createPoly, isPolyKind } from "./model/poly";
import type { Shape } from "./model/types";
import { newId } from "./model/types";

interface Options {
  color: string;
  layer: number;
  /** 视野中心（世界坐标），没有时用原点 */
  center?: { x: number; y: number };
  setShapes: (updater: (prev: Shape[]) => Shape[]) => void;
  onSelect: (id: string | null) => void;
  onToast?: (msg: string) => void;
}

/** 默认半径 / 半长（格） */
const DEFAULT_R = 2;

export function useQuickCreate({ color, layer, center, setShapes, onSelect, onToast }: Options) {
  return useCallback(
    (kind: string, opts?: { sides?: number; r?: number; w?: number; h?: number; len?: number; deg?: number }) => {
      const cx = center?.x ?? 0;
      const cy = center?.y ?? 0;
      const sides = opts?.sides;
      const R = Math.max(0.3, opts?.r ?? DEFAULT_R);
      const W = Math.max(0.3, opts?.w ?? DEFAULT_R * 2);
      const Hh = Math.max(0.3, opts?.h ?? DEFAULT_R * 1.2);
      const LEN = Math.max(0.3, opts?.len ?? DEFAULT_R * 2);
      const DEG = Math.min(179, Math.max(1, opts?.deg ?? 60));
      let shape: Shape | null;
      switch (kind) {
        case "point":
          shape = { id: newId("point"), type: "point", x: cx, y: cy, color };
          break;
        case "circle":
          shape = { id: newId("circle"), type: "circle", cx, cy, r: R, color };
          break;
        case "ellipse":
          shape = { id: newId("ellipse"), type: "ellipse", cx, cy, rx: W / 2, ry: Hh / 2, color };
          break;
        case "rect":
          shape = { id: newId("rect"), type: "rect", x1: cx - W / 2, y1: cy - Hh / 2, x2: cx + W / 2, y2: cy + Hh / 2, color };
          break;
        case "line":
          shape = { id: newId("line"), type: "line", x1: cx - LEN / 2, y1: cy, x2: cx + LEN / 2, y2: cy, color };
          break;
        case "polygon":
          // 用「按参数创建」面板里滑杆选定的边数（此前写死 5，滑杆等于摆设）
          shape = { id: newId("polygon"), type: "polygon", cx, cy, r: R, sides: Math.min(24, Math.max(3, sides ?? 5)), rotation: 0, color };
          break;
        case "arc":
          shape = {
            id: newId("arc"), type: "arc", cx, cy, r: R,
            startAngle: 0, endAngle: Math.PI / 2, color,
          };
          break;
        case "angle":
          shape = {
            id: newId("angle"), type: "angle", vx: cx, vy: cy,
            a1: 0, a2: -(DEG * Math.PI) / 180, r: Math.max(0.4, LEN * 0.42), len: LEN, len2: LEN, color,
          };
          break;
        case "star": case "rhombus": case "trapezoid": case "arrow": {
          // 星形 / 菱形 / 梯形 / 箭头：按默认尺寸放一个（此前这几种「按参数创建」是空的）
          const start = { x: cx - R * 0.75, y: cy + R * 0.75 };
          const end = { x: cx + R * 0.75, y: cy - R * 0.75 };
          const made2 = isPolyKind(kind) ? createPoly(kind, start, end, color) : null;
          shape = made2 ? ({ ...made2 } as Shape) : null;
          break;
        }
        default:
          return;
      }
      const made = shape;
      if (!made) return;
      setShapes((prev) => [...prev, { ...made, layer }]);
      onSelect(made.id);
      onToast?.("已按参数创建，可在「几何参数」里精确修改");
    },
    [color, layer, center, setShapes, onSelect, onToast],
  );
}

/** App 侧的薄封装：自动取视野中心，省去调用处拼参数 */
export function useAppQuickCreate(args: {
  viewport: { xRange: [number, number]; yRange: [number, number] };
  color: string;
  layer: number;
  setShapes: (updater: (prev: Shape[]) => Shape[]) => void;
  onSelect: (id: string | null) => void;
  onToast?: (msg: string) => void;
}) {
  const { viewport, ...rest } = args;
  return useQuickCreate({
    ...rest,
    center: {
      x: (viewport.xRange[0] + viewport.xRange[1]) / 2,
      y: (viewport.yRange[0] + viewport.yRange[1]) / 2,
    },
  });
}
