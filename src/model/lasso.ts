/**
 * 套索工具：框选命中的图形集合。
 *
 * 判定规则（v0.2.1 收紧，用户反馈「容易都框选上」）：
 * bbox 相交只做第一层粗筛；真正选中要求满足下列之一——
 *   1. 图形包围盒中心落在套索多边形内（主体被圈住）；
 *   2. 包围盒至少两个角点落在多边形内（大半被圈住）；
 *   3. 套索路径本身穿过包围盒（起笔/拐点直接压在图形上）。
 * 点类图形（bbox 极小）只需条件 1 或 3。
 */
import { newId, type Point2, type Shape } from "./types";

export interface BBox { x1: number; y1: number; x2: number; y2: number }

/** 图形包围盒（世界坐标） */
export function shapeBBox(shape: Shape): BBox {
  const pts: Point2[] = [];
  const push = (x: number, y: number) => pts.push({ x, y });
  switch (shape.type) {
    case "circle": push(shape.cx - shape.r, shape.cy - shape.r); push(shape.cx + shape.r, shape.cy + shape.r); break;
    case "ellipse": push(shape.cx - shape.rx, shape.cy - shape.ry); push(shape.cx + shape.rx, shape.cy + shape.ry); break;
    case "rect": push(shape.x1, shape.y1); push(shape.x2, shape.y2); break;
    case "line": case "ray": push(shape.x1, shape.y1); push(shape.x2, shape.y2); break;
    case "point": push(shape.x, shape.y); break;
    case "image": push(shape.x, shape.y); push(shape.x + shape.w, shape.y + shape.h); break;
    case "ink": case "poly":
      for (const q of shape.points) { push(q.x, q.y); }
      break;
    case "function": {
      const [a, b] = shape.xRange;
      push(a, -8); push(b, 8);
      break;
    }
    case "parametric": {
      const [a, b] = shape.tRange;
      push(Math.min(a, b) - 1, -4); push(Math.max(a, b) + 1, 4);
      break;
    }
    case "angle": {
      const reach = 2 * shape.r;
      for (const a of [shape.a1, shape.a2]) {
        push(shape.vx + reach * Math.cos(a), shape.vy + reach * Math.sin(a));
      }
      push(shape.vx, shape.vy);
      break;
    }
    case "arc": {
      push(shape.cx - shape.r, shape.cy - shape.r);
      push(shape.cx + shape.r, shape.cy + shape.r);
      break;
    }
    case "solid": push(-3, -3); push(3, 4); break;
    default: push(0, 0); break;
  }
  const xs = pts.map((q) => q.x); const ys = pts.map((q) => q.y);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

const bOverlap = (a: BBox, b: BBox): boolean =>
  a.x1 <= b.x2 && b.x1 <= a.x2 && a.y1 <= b.y2 && b.y1 <= a.y2;

/** 射线法：点是否在多边形内 */
export function pointInPoly(p: Point2, poly: Point2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    const intersect =
      (a.y > p.y) !== (b.y > p.y) &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** 套索路径是否有任何采样点落进包围盒（起笔/拐点压在图形上） */
function polyTouchesBBox(poly: Point2[], box: BBox): boolean {
  return poly.some((q) => q.x >= box.x1 && q.x <= box.x2 && q.y >= box.y1 && q.y <= box.y2);
}

/** 鞋带公式：多边形有向面积（共线/零面积时套索退化为矩形框选） */
function polyArea(poly: Point2[]): number {
  let area = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!;
    const b = poly[j]!;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

/** 包围盒与套索的实质交集判定（收紧版） */
function bboxCaughtByLasso(box: BBox, poly: Point2[], lassoBox: BBox): boolean {
  const corners: Point2[] = [
    { x: box.x1, y: box.y1 }, { x: box.x2, y: box.y1 },
    { x: box.x1, y: box.y2 }, { x: box.x2, y: box.y2 },
  ];
  const inCorners = corners.filter((c) => pointInPoly(c, poly)).length;
  const center: Point2 = { x: (box.x1 + box.x2) / 2, y: (box.y1 + box.y2) / 2 };
  const tiny = (box.x2 - box.x1) * (box.y2 - box.y1) < 0.05;
  if (inCorners >= 2 || pointInPoly(center, poly) || (tiny && polyTouchesBBox(poly, box))) return true;
  // 套索拖成一条直线（零面积多边形）时射线法失效：退化为矩形框选——中心落在套索 bbox 内即选中
  if (Math.abs(polyArea(poly)) < 1e-6) {
    return center.x >= lassoBox.x1 && center.x <= lassoBox.x2 && center.y >= lassoBox.y1 && center.y <= lassoBox.y2;
  }
  return false;
}

/** 套索多边形（世界坐标）选中的图形（按 shapes 顺序） */
export function lassoSelect(shapes: Shape[], poly: Point2[]): string[] {
  if (poly.length < 2) return [];
  const xs = poly.map((q) => q.x); const ys = poly.map((q) => q.y);
  const lassoBox: BBox = { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  return shapes
    .filter((s) => {
      if (s.type === "coord") return false;
      const box = shapeBBox(s);
      return bOverlap(box, lassoBox) && bboxCaughtByLasso(box, poly, lassoBox);
    })
    .map((s) => s.id);
}

/** 平移一个图形，不换 id（框选整组拖动用） */
export function translateShape(shape: Shape, dx: number, dy: number): Shape {
  const c = { ...shape } as Record<string, unknown>;
  // 显式区分 x/y 字段：早期用 k.endsWith("x") 判断，x1/x2 落到 else 分支加 dy，
  // 线段就只能在竖直方向移动（水平拖不动）
  const XS = new Set(["x", "x1", "x2", "cx", "vx"]);
  const YS = new Set(["y", "y1", "y2", "cy", "vy"]);
  for (const k of [...XS, ...YS]) {
    if (typeof c[k] === "number") c[k] = (c[k] as number) + (XS.has(k) ? dx : dy);
  }
  if (Array.isArray(c.points)) {
    c.points = (c.points as Point2[]).map((q) => ({ x: q.x + dx, y: q.y + dy }));
  }
  return c as unknown as Shape;
}

/** 平移一个图形并重新生成 id（复制/粘贴用） */
export function shiftShape(shape: Shape, dx: number, dy: number): Shape {
  return { ...translateShape(shape, dx, dy), id: newId(shape.type) };
}
