/**
 * 角度标注模型：特殊角吸附 + 角度计算 + 命中测试。
 *
 * 「特殊角」指 15° 的整数倍里最常用的那些（30/45/60/90/120/135/150/180），
 * 画角度时第二条边会吸附到最近的特殊角，直角另画方角标记。
 */
import type { Handle } from "./geometry";
import type { AngleShape, Point2 } from "./types";
import { newId } from "./types";

/** 可吸附的特殊角（度） */
export const SPECIAL_ANGLES = [15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180] as const;

/** 吸附阈值（度）：超过这个偏差就不吸，保留手画的任意角 */
const SNAP_TOLERANCE = 2.5;

export const toDeg = (rad: number): number => (rad * 180) / Math.PI;
export const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** 把角度（度）归一化到 [0, 360) */
export function normalizeDeg(deg: number): number {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/** 取 [0,360) 内最小的两角夹角（度） */
export function smallestAngle(a: number, b: number): number {
  const diff = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return Math.min(diff, 360 - diff);
}

/**
 * 相对 base 方向，把 target 吸附到最近的特殊角。
 * 返回吸附后的绝对角度（弧度）与实际角度（度）。
 */
export function snapSpecialAngle(base: number, target: number, enabled = true): { angle: number; deg: number; snapped: boolean } {
  const baseDeg = toDeg(base);
  const rawDeg = toDeg(target);
  const relDeg = normalizeDeg(rawDeg - baseDeg);

  if (!enabled) {
    const span = relDeg > 180 ? 360 - relDeg : relDeg;
    return { angle: target, deg: span, snapped: false };
  }

  let best: number | null = null;
  let bestDiff = SNAP_TOLERANCE;
  for (const candidate of [...SPECIAL_ANGLES, 360 - 360]) {
    const diff = smallestAngle(relDeg, candidate);
    if (diff <= bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  if (best == null) {
    const span = relDeg > 180 ? 360 - relDeg : relDeg;
    return { angle: target, deg: span, snapped: false };
  }
  return { angle: toRad(baseDeg + best), deg: best, snapped: true };
}

/** 两条边之间的夹角（度，0–180） */
export function angleSpanDeg(shape: AngleShape): number {
  return smallestAngle(toDeg(shape.a1), toDeg(shape.a2));
}

/** 取要绘制的那一段（始终 ≤180°，起点在 span 较小的一侧） */
export function drawRange(shape: AngleShape): { start: number; span: number } {
  let d = shape.a2 - shape.a1;
  while (d <= 0) d += Math.PI * 2;
  while (d > Math.PI * 2) d -= Math.PI * 2;
  if (d > Math.PI) return { start: shape.a2, span: Math.PI * 2 - d };
  return { start: shape.a1, span: d };
}

/** 由顶点与两条边上的点创建角度图形（第二边按需吸附特殊角） */
export function createAngle(
  vertex: Point2,
  p1: Point2,
  p2: Point2,
  color: string,
  snapEnabled: boolean,
): { shape: AngleShape; deg: number; snapped: boolean } {
  const a1 = Math.atan2(p1.y - vertex.y, p1.x - vertex.x);
  const raw = Math.atan2(p2.y - vertex.y, p2.x - vertex.x);
  const { angle: a2, deg, snapped } = snapSpecialAngle(a1, raw, snapEnabled);
  const r1 = Math.hypot(p1.x - vertex.x, p1.y - vertex.y);
  const r2 = Math.hypot(p2.x - vertex.x, p2.y - vertex.y);
  // 弧半径与臂长成比例：之前用 min(r1,r2)*0.42，当两次点击距离差很大时弧很小、臂很长，显示bug
  const len = Math.max(0.6, (r1 + r2) / 2);
  const r = Math.max(0.4, len * 0.42);

  return {
    // 两条边等长（教材画法）：取两次点击距离的平均值，视觉上不偏不倚
    shape: { id: newId("angle"), type: "angle", vx: vertex.x, vy: vertex.y, a1, a2, r,
      len: Math.max(0.6, (r1 + r2) / 2), color },
    deg,
    snapped,
  };
}

/** 角度图形命中：靠近标注弧（或直角方角）即算命中 */
export function angleHitTest(shape: AngleShape, world: Point2, tol: number): boolean {
  const d = Math.hypot(world.x - shape.vx, world.y - shape.vy);
  const nearRadius = Math.abs(d - shape.r) <= Math.max(tol, shape.r * 0.18);
  if (!nearRadius) return false;
  const ang = Math.atan2(world.y - shape.vy, world.x - shape.vx);
  const s = toDeg(shape.a1);
  const span = angleSpanDeg(shape);
  // 判断方向是否落在两条边之间（按顺时针或逆时针各试一次）
  const forward = normalizeDeg(toDeg(ang) - s);
  const backward = normalizeDeg(s - toDeg(ang));
  return forward <= span + 6 || backward <= span + 6;
}

/** 角度图形的控制点：顶点 + 两条边的端点（拖边即改角度） */
export function angleHandles(shape: AngleShape): Handle[] {
  const at = (ang: number): Point2 => ({
    x: shape.vx + shape.r * Math.cos(ang),
    y: shape.vy + shape.r * Math.sin(ang),
  });
  const dir = (s0: AngleShape, w: Point2): number => Math.atan2(w.y - s0.vy, w.x - s0.vx);
  return [
    { id: "v", at: { x: shape.vx, y: shape.vy }, apply: (s0, w) => ({ ...(s0 as AngleShape), vx: w.x, vy: w.y }) },
    { id: "a1", at: at(shape.a1), apply: (s0, w) => ({ ...(s0 as AngleShape), a1: dir(s0 as AngleShape, w) }) },
    { id: "a2", at: at(shape.a2), apply: (s0, w) => ({ ...(s0 as AngleShape), a2: dir(s0 as AngleShape, w) }) },
  ];
}
