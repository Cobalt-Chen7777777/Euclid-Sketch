/**
 * 几何参数的数值编辑：线段长度、圆半径。
 * 均保持图形其余属性不变——线段按起点+方向缩放终点，圆只改半径。
 */
import { translateShape } from "./lasso";
import type { CircleShape, LineShape, Shape } from "./types";

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

/** 角度两条边的长度（等长），最小 0.6 格 */
export const angleLenPatch = (len: number): Partial<{ len: number }> => ({ len: Math.max(0.6, len) });

/** 角度的标注弧半径（与边长联动：约 0.42 倍，与创建时一致） */
export const angleRadiusFor = (len: number): number => Math.max(0.4, len * 0.42);


/** 点的世界坐标（格子单位） */
export const pointPatch = (axis: "x" | "y", value: number) => ({ [axis]: value });

/** 图形的锚点（坐标输入用）：线段取起点，圆/椭圆/多边形/圆弧取圆心，角度取顶点 */
export function anchorOf(s: Shape): { x: number; y: number } | null {
  switch (s.type) {
    case "point": return { x: s.x, y: s.y };
    case "line":
    case "ray": return { x: s.x1, y: s.y1 };
    case "rect": return { x: s.x1, y: s.y1 };
    case "circle":
    case "ellipse":
    case "polygon":
    case "arc": return { x: s.cx, y: s.cy };
    case "angle": return { x: s.vx, y: s.vy };
    case "poly": {
      if (s.points.length === 0) return null;
      const sum = s.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
      return { x: sum.x / s.points.length, y: sum.y / s.points.length };
    }
    default: return null;
  }
}

/** 改锚点坐标 = 整体平移，形状与尺寸不变 */
export function anchorPatch(s: Shape, axis: "x" | "y", value: number): Shape {
  const a = anchorOf(s);
  if (!a) return s;
  const d = value - (axis === "x" ? a.x : a.y);
  return translateShape(s, axis === "x" ? d : 0, axis === "y" ? d : 0);
}

/** 椭圆两轴半径 */
export const ellipseRadiiPatch = (rx: number, ry: number): Partial<{ rx: number; ry: number }> => ({
  rx: Math.max(0.05, rx), ry: Math.max(0.05, ry),
});

/** 矩形宽高（保持左上角 x1/y1 不动） */
export function rectSizePatch(s: { x1: number; y1: number }, w: number, h: number) {
  return { x2: s.x1 + Math.max(0.05, w), y2: s.y1 + Math.max(0.05, h) };
}

/** 多边形边数与半径 */
export const polygonSidesPatch = (n: number) => ({ sides: Math.min(24, Math.max(3, Math.round(n))) });
export const polygonRadiusPatch = (r: number) => ({ r: Math.max(0.1, r) });

/**
 * 把角度设成指定度数：保持第一条边不动，第二条边按原来的旋转方向摆到该角度。
 * deg 取 1~179（0/180 无法构成夹角）。
 */
export function angleSpanPatch(s: { a1: number; a2: number }, deg: number): Partial<{ a2: number }> {
  const span = Math.min(179, Math.max(1, deg));
  const d = ((s.a2 - s.a1) * 180) / Math.PI;
  const norm = ((d % 360) + 360) % 360;
  const sign = norm <= 180 ? 1 : -1;
  return { a2: s.a1 + (sign * span * Math.PI) / 180 };
}
