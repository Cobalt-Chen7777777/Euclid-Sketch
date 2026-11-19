/**
 * 几何图元统一操作：工厂、控制点、命中测试、拖拽应用。
 * 每个控制点携带 apply 闭包，画布层遍历即可，无需为每种图形写 switch。
 */
import { angleHandles, angleHitTest } from "./angle";
import type { ImageShape } from "./types";
import { imageHandles, imageHitTest } from "./image";
import { createPoly, isPolyKind, polyHandles, polyHitTest } from "./poly";
import type {
  Point2,
  PrimitiveType,
  Shape,
  EllipseShape,
  ArcShape,
  RectShape,
  PolygonShape,
  RayShape,
  CircleShape,
  LineShape,
  PointShape,
  InkShape,
  AngleShape,
  PolyShape,
} from "./types";
import { newId } from "./types";

const DEFAULT_R = 2;

/** 在指定世界坐标创建一个默认大小的图元 */
export function createPrimitive(
  type: PrimitiveType,
  at: Point2,
  color: string,
  sides = 5,
): Shape | null {
  switch (type) {
    case "circle":
      return { id: newId("circle"), type: "circle", cx: at.x, cy: at.y, r: DEFAULT_R, color } satisfies CircleShape;
    case "ellipse":
      return { id: newId("ellipse"), type: "ellipse", cx: at.x, cy: at.y, rx: DEFAULT_R, ry: DEFAULT_R * 0.6, color } satisfies EllipseShape;
    case "arc":
      return { id: newId("arc"), type: "arc", cx: at.x, cy: at.y, r: DEFAULT_R, startAngle: 0, endAngle: Math.PI, color } satisfies ArcShape;
    case "rect":
      return { id: newId("rect"), type: "rect", x1: at.x, y1: at.y, x2: at.x + DEFAULT_R, y2: at.y + DEFAULT_R, color } satisfies RectShape;
    case "polygon":
      return { id: newId("polygon"), type: "polygon", cx: at.x, cy: at.y, r: DEFAULT_R, sides, rotation: -Math.PI / 2, color } satisfies PolygonShape;
    case "ray":
      return { id: newId("ray"), type: "ray", x1: at.x, y1: at.y, x2: at.x + DEFAULT_R, y2: at.y, color } satisfies RayShape;
    case "line":
      return { id: newId("line"), type: "line", x1: at.x - DEFAULT_R, y1: at.y, x2: at.x + DEFAULT_R, y2: at.y, color } satisfies LineShape;
    case "point":
      return { id: newId("point"), type: "point", x: at.x, y: at.y, color } satisfies PointShape;
    default:
      return null;
  }
}

/** 拖动绘制：由按下点 start 与松开点 end 决定图元尺寸 */
export function createPrimitiveByDrag(
  type: PrimitiveType,
  start: Point2,
  end: Point2,
  color: string,
  sides = 5,
): Shape | null {
  // 星形 / 菱形 / 梯形 / 箭头走点集工厂，避免 switch 继续膨胀
  if (isPolyKind(type)) return createPoly(type, start, end, color);

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const r = Math.hypot(dx, dy);
  switch (type) {
    case "circle":
      return r > 0.15
        ? { id: newId("circle"), type: "circle", cx: start.x, cy: start.y, r, color } satisfies CircleShape
        : null;
    case "ellipse":
      return Math.abs(dx) > 0.1 && Math.abs(dy) > 0.1
        ? { id: newId("ellipse"), type: "ellipse", cx: start.x, cy: start.y,
            rx: Math.abs(dx), ry: Math.abs(dy), color } satisfies EllipseShape
        : null;
    case "arc":
      return r > 0.15
        ? { id: newId("arc"), type: "arc", cx: start.x, cy: start.y, r,
            startAngle: 0, endAngle: Math.PI, color } satisfies ArcShape
        : null;
    case "rect":
      return Math.abs(dx) > 0.1 && Math.abs(dy) > 0.1
        ? { id: newId("rect"), type: "rect", x1: start.x, y1: start.y,
            x2: end.x, y2: end.y, color } satisfies RectShape
        : null;
    case "polygon":
      return r > 0.15
        ? { id: newId("polygon"), type: "polygon", cx: start.x, cy: start.y,
            r, sides, rotation: -Math.PI / 2, color } satisfies PolygonShape
        : null;
    case "ray":
      return r > 0.15
        ? { id: newId("ray"), type: "ray", x1: start.x, y1: start.y,
            x2: end.x, y2: end.y, color } satisfies RayShape
        : null;
    case "line":
      return r > 0.15
        ? { id: newId("line"), type: "line", x1: start.x, y1: start.y,
            x2: end.x, y2: end.y, color } satisfies LineShape
        : null;
    case "point":
      return { id: newId("point"), type: "point", x: end.x, y: end.y, color } satisfies PointShape;
    default:
      return null;
  }
}

export interface Handle {
  id: string;
  /** 控制点世界坐标 */
  at: Point2;
  /** 把该控制点拖到 world 后返回更新后的图形 */
  apply: (shape: Shape, world: Point2) => Shape;
}

const dist = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y);
const angleOf = (c: Point2, p: Point2) => Math.atan2(p.y - c.y, p.x - c.x);

/** 返回图形的可拖拽控制点 */
export function getHandles(shape: Shape): Handle[] {
  switch (shape.type) {
    case "circle":
    case "ellipse": {
      const c = shape.type === "circle"
        ? { x: shape.cx, y: shape.cy }
        : { x: (shape as EllipseShape).cx, y: (shape as EllipseShape).cy };
      const handles: Handle[] = [{
        id: "center",
        at: c,
        apply: (s, w) => s.type === "circle"
          ? { ...s, cx: w.x, cy: w.y }
          : { ...(s as EllipseShape), cx: w.x, cy: w.y },
      }];
      if (shape.type === "circle") {
        handles.push({
          id: "radius",
          at: { x: shape.cx + shape.r, y: shape.cy },
          apply: (s, w) => s.type === "circle"
            ? { ...s, r: Math.max(0.1, dist({ x: s.cx, y: s.cy }, w)) }
            : s,
        });
      } else {
        const e = shape as EllipseShape;
        handles.push({
          id: "rx",
          at: { x: e.cx + e.rx, y: e.cy },
          apply: (s, w) => ({ ...(s as EllipseShape), rx: Math.max(0.1, Math.abs(w.x - (s as EllipseShape).cx)) }),
        });
        handles.push({
          id: "ry",
          at: { x: e.cx, y: e.cy + e.ry },
          apply: (s, w) => ({ ...(s as EllipseShape), ry: Math.max(0.1, Math.abs(w.y - (s as EllipseShape).cy)) }),
        });
      }
      return handles;
    }
    case "arc": {
      const a = shape as ArcShape;
      const c = { x: a.cx, y: a.cy };
      return [
        { id: "center", at: c, apply: (s, w) => ({ ...(s as ArcShape), cx: w.x, cy: w.y }) },
        {
          id: "radius",
          at: { x: a.cx + a.r * Math.cos(a.endAngle), y: a.cy + a.r * Math.sin(a.endAngle) },
          apply: (s, w) => {
            const t = s as ArcShape;
            return { ...t, r: Math.max(0.1, dist({ x: t.cx, y: t.cy }, w)) };
          },
        },
        {
          id: "start",
          at: { x: a.cx + a.r * Math.cos(a.startAngle), y: a.cy + a.r * Math.sin(a.startAngle) },
          apply: (s, w) => {
            const t = s as ArcShape;
            return { ...t, startAngle: angleOf({ x: t.cx, y: t.cy }, w) };
          },
        },
        {
          id: "end",
          at: { x: a.cx + a.r * Math.cos(a.endAngle), y: a.cy + a.r * Math.sin(a.endAngle) },
          apply: (s, w) => {
            const t = s as ArcShape;
            return { ...t, endAngle: angleOf({ x: t.cx, y: t.cy }, w) };
          },
        },
      ];
    }
    case "rect": {
      const r = shape as RectShape;
      return [
        { id: "p1", at: { x: r.x1, y: r.y1 }, apply: (s, w) => ({ ...(s as RectShape), x1: w.x, y1: w.y }) },
        { id: "p2", at: { x: r.x2, y: r.y2 }, apply: (s, w) => ({ ...(s as RectShape), x2: w.x, y2: w.y }) },
      ];
    }
    case "polygon": {
      const p = shape as PolygonShape;
      return [
        { id: "center", at: { x: p.cx, y: p.cy }, apply: (s, w) => ({ ...(s as PolygonShape), cx: w.x, cy: w.y }) },
        {
          id: "radius",
          at: { x: p.cx + p.r * Math.cos(p.rotation), y: p.cy + p.r * Math.sin(p.rotation) },
          apply: (s, w) => {
            const t = s as PolygonShape;
            return { ...t, r: Math.max(0.1, dist({ x: t.cx, y: t.cy }, w)) };
          },
        },
      ];
    }
    case "ray":
    case "line": {
      const l = shape as RayShape | LineShape;
      return [
        { id: "p1", at: { x: l.x1, y: l.y1 }, apply: (s, w) => ({ ...(s as RayShape), x1: w.x, y1: w.y }) },
        { id: "p2", at: { x: l.x2, y: l.y2 }, apply: (s, w) => ({ ...(s as RayShape), x2: w.x, y2: w.y }) },
      ];
    }
    case "point": {
      const p = shape as PointShape;
      return [{ id: "p", at: { x: p.x, y: p.y }, apply: (s, w) => ({ ...(s as PointShape), x: w.x, y: w.y }) }];
    }
    case "ink":
      // 笔迹作为自由墨迹，不提供控制点（用橡皮擦整体删除）
      return [];
    case "angle":
      return angleHandles(shape as AngleShape);
    case "poly":
      return polyHandles(shape as PolyShape);
    case "image": return imageHandles(shape as ImageShape);

    default:
      return [];
  }
}

/** 点到线段的最短距离 */
function distToSegment(p: Point2, a: Point2, b: Point2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** 命中测试：world 点是否点中了图形（tol 为世界坐标容差） */
export function hitTest(shape: Shape, world: Point2, tol: number): boolean {
  switch (shape.type) {
    case "circle":
      return Math.abs(dist(world, { x: shape.cx, y: shape.cy }) - shape.r) <= tol;
    case "ellipse": {
      const e = shape as EllipseShape;
      const dx = (world.x - e.cx) / Math.max(e.rx, 0.01);
      const dy = (world.y - e.cy) / Math.max(e.ry, 0.01);
      const v = Math.sqrt(dx * dx + dy * dy);
      return Math.abs(v - 1) * Math.min(e.rx, e.ry) <= tol;
    }
    case "arc": {
      const a = shape as ArcShape;
      const d = dist(world, { x: a.cx, y: a.cy });
      if (Math.abs(d - a.r) > tol) return false;
      let ang = angleOf({ x: a.cx, y: a.cy }, world);
      const s = a.startAngle;
      let e = a.endAngle;
      while (e < s) e += Math.PI * 2;
      while (ang < s) ang += Math.PI * 2;
      return ang >= s && ang <= e;
    }
    case "rect": {
      const r = shape as RectShape;
      const c: Point2 = { x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2 };
      if (dist(world, c) < Math.max(Math.abs(r.x2 - r.x1), Math.abs(r.y2 - r.y1))) return true;
      return false;
    }
    case "polygon": {
      const p = shape as PolygonShape;
      const pts = polygonPoints(p);
      for (let i = 0; i < pts.length; i++) {
        if (distToSegment(world, pts[i]!, pts[(i + 1) % pts.length]!) <= tol) return true;
      }
      return false;
    }
    case "ray": {
      const l = shape as RayShape;
      const ang = Math.atan2(l.y2 - l.y1, l.x2 - l.x1);
      const far = { x: l.x1 + 1000 * Math.cos(ang), y: l.y1 + 1000 * Math.sin(ang) };
      return distToSegment(world, { x: l.x1, y: l.y1 }, far) <= tol;
    }
    case "point":
      return dist(world, { x: shape.x, y: shape.y }) <= tol;
    case "line":
      return distToSegment(world, { x: shape.x1, y: shape.y1 }, { x: shape.x2, y: shape.y2 }) <= tol;
    case "angle":
      return angleHitTest(shape as AngleShape, world, tol);
    case "poly":
      return polyHitTest(shape as PolyShape, world, tol);
    case "image": return imageHitTest(shape as ImageShape, world, tol);
    case "ink": {
      const ink = shape as InkShape;
      if (ink.points.length === 1) return dist(world, ink.points[0]!) <= tol;
      for (let i = 1; i < ink.points.length; i++) {
        if (distToSegment(world, ink.points[i - 1]!, ink.points[i]!) <= tol) return true;
      }
      return false;
    }
    default:
      return false;
  }
}

/** 正多边形顶点（世界坐标） */
export function polygonPoints(p: PolygonShape): Point2[] {
  const pts: Point2[] = [];
  for (let i = 0; i < p.sides; i++) {
    const a = p.rotation + (Math.PI * 2 * i) / p.sides;
    pts.push({ x: p.cx + p.r * Math.cos(a), y: p.cy + p.r * Math.sin(a) });
  }
  return pts;
}
