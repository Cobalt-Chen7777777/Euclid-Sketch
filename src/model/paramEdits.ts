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

/** 圆弧当前半径（直接取 r） */
export const arcRadius = (s: { r: number }): number => s.r;

/** 圆弧起止角（度，0–360，便于阅读与输入） */
export function arcAngleDeg(range: number): number {
  const deg = (range * 180) / Math.PI;
  return Math.round(((deg % 360) + 360) % 360);
}

/** 把「度」转成弧度补丁：which 指定改起始角或终止角 */
export function arcAnglePatch(which: "startAngle" | "endAngle", deg: number): Partial<{ startAngle: number; endAngle: number }> {
  return { [which]: (deg * Math.PI) / 180 };
}

/** 改半径（最小 0.1） */
export const arcRadiusPatch = (r: number): Partial<{ r: number }> => ({ r: Math.max(0.1, r) });
