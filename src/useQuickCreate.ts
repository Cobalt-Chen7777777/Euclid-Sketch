/**
 * 按参数快速创建：长按工具栏图形图标 → 在视野中心放一个默认尺寸的图形并选中，
 * 绘图选项的「几何参数」随即可用（点 = x/y，圆 = 半径，线段 = 长度……）。
 */
import { useCallback } from "react";

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
const R = 2;

export function useQuickCreate({ color, layer, center, setShapes, onSelect, onToast }: Options) {
  return useCallback(
    (kind: string) => {
      const cx = center?.x ?? 0;
      const cy = center?.y ?? 0;
      let shape: Shape | null;
      switch (kind) {
        case "point":
          shape = { id: newId("point"), type: "point", x: cx, y: cy, color };
          break;
        case "circle":
          shape = { id: newId("circle"), type: "circle", cx, cy, r: R, color };
          break;
        case "ellipse":
          shape = { id: newId("ellipse"), type: "ellipse", cx, cy, rx: R, ry: R * 0.6, color };
          break;
        case "rect":
          shape = { id: newId("rect"), type: "rect", x1: cx - R, y1: cy - R * 0.6, x2: cx + R, y2: cy + R * 0.6, color };
          break;
        case "line":
          shape = { id: newId("line"), type: "line", x1: cx - R, y1: cy, x2: cx + R, y2: cy, color };
          break;
        case "polygon":
          shape = { id: newId("polygon"), type: "polygon", cx, cy, r: R, sides: 5, rotation: 0, color };
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
            a1: 0, a2: -Math.PI / 3, r: R * 0.42, len: R, len2: R, color,
          };
          break;
        default:
          return;
      }
      const made = shape;
      if (!made) return;
      setShapes((prev) => [...prev, { ...made, layer }]);
      onSelect(shape.id);
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
