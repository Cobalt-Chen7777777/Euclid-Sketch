/**
 * 几何参数的数值编辑：线段长度、圆半径。
 * 均保持图形其余属性不变——线段按起点+方向缩放终点，圆只改半径。
 */
import type { CircleShape, LineShape } from "./types";

/** 线段当前长度 */
export const lineLength = (s: LineShape): number => Math.hypot(s.x2 - s.x1, s.y2 - s.y1);

/** 改线段长度：锚定起点 (x1,y1)，方向不变 */
export function lineLengthPatch(s: LineShape, len: number): Partial<LineShape> {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const cur = Math.hypot(dx, dy);
  if (cur < 1e-6) return {};
  const k = Math.max(0.05, len) / cur;
  return { x2: s.x1 + dx * k, y2: s.y1 + dy * k };
}

/** 改圆半径（最小 0.05 世界单位） */
export const circleRadiusPatch = (r: number): Partial<CircleShape> => ({ r: Math.max(0.05, r) });
