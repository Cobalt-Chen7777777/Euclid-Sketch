/**
 * 通用多边形图形：星形 / 菱形 / 梯形 / 箭头。
 *
 * 统一用「点集 + 是否闭合」表达，渲染、命中、控制点都只走一套逻辑，
 * 新增图形只需写一个生成点集的工厂。
 */
import type { Handle } from "./geometry";
import type { Point2, PolygonShape, PolyShape, Shape } from "./types";
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

/** 顶点质心 */
export function polyCentroid(points: Point2[]): Point2 {
  const n = Math.max(1, points.length);
  return points.reduce((acc, p) => ({ x: acc.x + p.x / n, y: acc.y + p.y / n }), { x: 0, y: 0 });
}

/** 整体绕质心旋转 */
export function rotatePoly(shape: PolyShape, delta: number): PolyShape {
  const c = polyCentroid(shape.points);
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  return {
    ...shape,
    points: shape.points.map((p) => ({
      x: c.x + (p.x - c.x) * cos - (p.y - c.y) * sin,
      y: c.y + (p.x - c.x) * sin + (p.y - c.y) * cos,
    })),
  };
}

/** 点集图形的控制点：每个顶点都可拖 + 一个整体旋转点 */
export function polyHandles(shape: PolyShape): Handle[] {
  const c = polyCentroid(shape.points);
  const first = shape.points[0];
  const maxR = shape.points.reduce((m, p) => Math.max(m, Math.hypot(p.x - c.x, p.y - c.y)), 0.1);
  // 旋转点挂在「第一个顶点方向再逆时针 60°」：跟着图形一起转，
  // 拖动时才能保持「光标指哪、这一点指哪」，不会越拖越跑
  const OFFSET = -Math.PI / 3;
  const ref = first ? Math.atan2(first.y - c.y, first.x - c.x) : 0;
  const rotHandle: Handle[] = [{
    id: "rot",
    at: { x: c.x + maxR * 1.2 * Math.cos(ref + OFFSET), y: c.y + maxR * 1.2 * Math.sin(ref + OFFSET) },
    apply: (s0, w) => {
      const s = s0 as PolyShape;
      const cc = polyCentroid(s.points);
      const f = s.points[0];
      const curRef = f ? Math.atan2(f.y - cc.y, f.x - cc.x) : 0;
      const want = Math.atan2(w.y - cc.y, w.x - cc.x);
      return rotatePoly(s, want - (curRef + OFFSET));
    },
  }];
  const vertexHandles: Handle[] = shape.points.map((p, i) => ({
    id: `p${i}`,
    at: p,
    apply: (s: Shape, w: Point2) => {
      const target = s as PolyShape;
      const next = target.points.map((cur, idx) => (idx === i ? w : cur));
      return { ...target, points: next };
    },
  }));
  return [...vertexHandles, ...rotHandle];
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

/**
 * 正多边形 → 自由多边形：顶点位置不变，改成点集表示。
 * 之后每个顶点都能单独拖、每条边都能单独给长度，用来画不规则多边形。
 */
export function polygonToIrregular(p: PolygonShape & { id: string; layer?: number }): PolyShape {
  const points: Point2[] = [];
  for (let i = 0; i < p.sides; i += 1) {
    const ang = p.rotation + (i * Math.PI * 2) / p.sides;
    points.push({ x: p.cx + p.r * Math.cos(ang), y: p.cy + p.r * Math.sin(ang) });
  }
  return {
    id: p.id,
    type: "poly",
    kind: "irregular",
    points,
    closed: true,
    ...(p.dashed ? { dashed: true } : {}),
    color: p.color,
    ...(p.layer != null ? { layer: p.layer } : {}),
  };
}

/** 第 i 条边的长度（闭合多边形，最后一条边回到第 0 个顶点） */
export function polySideLen(s: PolyShape, i: number): number {
  const n = s.points.length;
  const a = s.points[i];
  const b = s.points[(i + 1) % n];
  if (!a || !b) return 0;
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * 把第 i 条边改成指定长度：沿这条边的方向移动它的后一个顶点。
 * 闭合多边形没法只改一条边——下一条边的长度会跟着变，这是几何上的必然，
 * 所以顺序调一遍就能凑出想要的一组边长。
 */
export function polySideLenPatch(s: PolyShape, i: number, len: number): PolyShape | null {
  const n = s.points.length;
  const a = s.points[i];
  const b = s.points[(i + 1) % n];
  if (n < 3 || !a || !b) return null;
  const cur = Math.hypot(b.x - a.x, b.y - a.y);
  const want = Math.max(0.1, len);
  if (cur < 1e-6) return null;
  const k = want / cur;
  const moved = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
  const points = s.points.map((p, idx) => (idx === (i + 1) % n ? moved : p));
  return { ...s, points };
}

/**
 * 改自由多边形的边数：
 * 加边时在最长的边上插中点（轮廓完全不变，之后把这个新顶点拖出去就是多出来的一角），
 * 减边时从末尾依次去掉顶点。3 ~ 24 边。
 */
export function polySideCountPatch(s: PolyShape, count: number): PolyShape | null {
  const target = Math.min(24, Math.max(3, Math.round(count)));
  const points = [...s.points];
  if (target === points.length) return null;
  if (target < points.length) {
    // 每次去掉「最小的一只耳朵」（自己和相邻两点围出的三角形最小），轮廓基本不变；
    // 之前是从末尾直接 pop，多边形会被切掉一大块
    while (points.length > target) {
      let worst = 0;
      let worstArea = Number.POSITIVE_INFINITY;
      for (let i = 0; i < points.length; i += 1) {
        const prev = points[(i - 1 + points.length) % points.length]!;
        const cur = points[i]!;
        const next = points[(i + 1) % points.length]!;
        const area = Math.abs((cur.x - prev.x) * (next.y - prev.y) - (next.x - prev.x) * (cur.y - prev.y)) / 2;
        if (area < worstArea) {
          worstArea = area;
          worst = i;
        }
      }
      points.splice(worst, 1);
    }
    return { ...s, points };
  }
  while (points.length < target) {
    let best = 0;
    let bestLen = -1;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i]!;
      const b = points[(i + 1) % points.length]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > bestLen) {
        bestLen = len;
        best = i;
      }
    }
    const a = points[best]!;
    const b = points[(best + 1) % points.length]!;
    points.splice(best + 1, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return { ...s, points };
}
