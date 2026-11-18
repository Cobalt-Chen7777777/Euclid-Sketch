/**
 * 通用多边形图形：星形 / 菱形 / 梯形 / 箭头。
 *
 * 统一用「点集 + 是否闭合」表达，渲染、命中、控制点都只走一套逻辑，
 * 新增图形只需写一个生成点集的工厂。
 */
import type { Handle } from "./geometry";
import type { Point2, PolyShape } from "./types";
import { newId } from "./types";

/** 可用「点集」表达的可插入图形 */
export type PolyKind = "star" | "rhombus" | "trapezoid" | "arrow";

export const POLY_KINDS: PolyKind[] = ["star", "rhombus", "trapezoid", "arrow"];

export function isPolyKind(type: string): type is PolyKind {
  return (POLY_KINDS as string[]).includes(type);
}

/** 菱形：以按下点为中心，拖到对角点决定半宽/半高 */
function rhombusPoints(start: Point2, end: Point2): Point2[] {
  const rx = Math.abs(end.x - start.x);
  const ry = Math.abs(end.y - start.y);
  return [
    { x: start.x, y: start.y + ry },
    { x: start.x + rx, y: start.y },
    { x: start.x, y: start.y - ry },
    { x: start.x - rx, y: start.y },
  ];
}

/** 梯形：下底 = 2×半宽，上底 = 1.2×半宽，高 = 2×半高 */
function trapezoidPoints(start: Point2, end: Point2): Point2[] {
  const hw = Math.abs(end.x - start.x);
  const hh = Math.abs(end.y - start.y);
  const top = hw * 0.6;
  return [
    { x: start.x - hw, y: start.y - hh },
    { x: start.x + hw, y: start.y - hh },
    { x: start.x + top, y: start.y + hh },
    { x: start.x - top, y: start.y + hh },
  ];
}

/** 星形：5 角星，外接半径 = 拖动距离 */
function starPoints(start: Point2, r: number, spikes = 5): Point2[] {
  const inner = r * 0.42;
  const pts: Point2[] = [];
  const step = Math.PI / spikes;
  for (let i = 0; i < spikes * 2; i += 1) {
    const radius = i % 2 === 0 ? r : inner;
    const ang = Math.PI / 2 + i * step;
    pts.push({ x: start.x + radius * Math.cos(ang), y: start.y + radius * Math.sin(ang) });
  }
  return pts;
}

/** 箭头：起点 → 终点，头部按长度比例生成 */
function arrowPoints(start: Point2, end: Point2): Point2[] {
  const ang = Math.atan2(end.y - start.y, end.x - start.x);
  const len = Math.hypot(end.x - start.x, end.y - start.y);
  const head = Math.min(len * 0.32, len * 0.5);
  const half = head * 0.52;
  const back = { x: end.x - head * Math.cos(ang), y: end.y - head * Math.sin(ang) };
  const nx = Math.cos(ang + Math.PI / 2);
  const ny = Math.sin(ang + Math.PI / 2);
  return [
    start,
    back,
    { x: back.x + nx * half, y: back.y + ny * half },
    end,
    { x: back.x - nx * half, y: back.y - ny * half },
    back,
  ];
}

/** 由拖拽的起止点生成点集图形 */
export function createPoly(kind: PolyKind, start: Point2, end: Point2, color: string): PolyShape | null {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  const r = Math.hypot(end.x - start.x, end.y - start.y);
  if (r < 0.2) return null;

  const points =
    kind === "star" ? starPoints(start, r)
      : kind === "rhombus" ? rhombusPoints(start, end)
        : kind === "trapezoid" ? trapezoidPoints(start, end)
          : arrowPoints(start, end);

  // 菱形/梯形需要两个方向都有尺寸，退化成线就不生成
  if ((kind === "rhombus" || kind === "trapezoid") && (dx < 0.1 || dy < 0.1)) return null;

  return {
    id: newId(kind),
    type: "poly",
    kind,
    points,
    closed: kind !== "arrow",
    color,
  };
}

/** 点集图形的控制点：每个顶点都可拖 */
export function polyHandles(shape: PolyShape): Handle[] {
  return shape.points.map((p, i) => ({
    id: `p${i}`,
    at: p,
    apply: (s, w) => {
      const target = s as PolyShape;
      const next = target.points.map((cur, idx) => (idx === i ? w : cur));
      return { ...target, points: next };
    },
  }));
}

/** 命中：任意一条边（箭头也算闭合）靠近即命中 */
export function polyHitTest(shape: PolyShape, world: Point2, tol: number): boolean {
  const seg = (a: Point2, b: Point2): number => {
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const wx = world.x - a.x;
    const wy = world.y - a.y;
    const len2 = vx * vx + vy * vy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
    return Math.hypot(world.x - (a.x + t * vx), world.y - (a.y + t * vy));
  };
  for (let i = 1; i < shape.points.length; i += 1) {
    const a = shape.points[i - 1];
    const b = shape.points[i];
    if (a && b && seg(a, b) <= tol) return true;
  }
  if (shape.closed && shape.points.length > 2) {
    const first = shape.points[0];
    const last = shape.points[shape.points.length - 1];
    if (first && last && seg(last, first) <= tol) return true;
  }
  return false;
}
