/**
 * 套索工具：框选命中的图形集合。
 * 用「图形包围盒与套索多边形包围盒相交」做宽松判定——
 * 框选是粗选择手势，宁可选多不选漏。
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

/** 套索多边形（世界坐标）选中的图形（按 shapes 顺序） */
export function lassoSelect(shapes: Shape[], poly: Point2[]): string[] {
  if (poly.length < 2) return [];
  const xs = poly.map((q) => q.x); const ys = poly.map((q) => q.y);
  const lassoBox: BBox = { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
  return shapes.filter((s) => s.type !== "coord" && bOverlap(shapeBBox(s), lassoBox)).map((s) => s.id);
}

/** 平移一个图形并重新生成 id（复制/粘贴用） */
export function shiftShape(shape: Shape, dx: number, dy: number): Shape {
  const c = { ...shape } as Record<string, unknown>;
  for (const k of ["x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "vx", "vy"]) {
    if (typeof c[k] === "number") c[k] = (c[k] as number) + (k.endsWith("x") ? dx : dy);
  }
  if (Array.isArray(c.points)) {
    c.points = (c.points as Point2[]).map((q) => ({ x: q.x + dx, y: q.y + dy }));
  }
  return { ...(c as unknown as Shape), id: newId(shape.type) };
}
