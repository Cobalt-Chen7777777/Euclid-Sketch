/**
 * 几何图元统一操作：工厂、控制点、命中测试、拖拽应用。
 * 每个控制点携带 apply 闭包，画布层遍历即可，无需为每种图形写 switch。
 */
import { angleHandles, angleHitTest } from "./angle";
import { orientDeg, orientPatch } from "./rotate";
import { sampleCurve } from "./curve";
import { sampleImplicit } from "./implicit";
import type { ImageShape, ImplicitShape } from "./types";
import { imageHandles, imageHitTest } from "./image";
import { polyHandles, polyHitTest } from "./poly";
import type {
  Point2,
  Shape,
  EllipseShape,
  ArcShape,
  RectShape,
  PolygonShape,
  RayShape,
  LineShape,
  PointShape,
  InkShape,
  AngleShape,
  PolyShape,
} from "./types";


export interface Handle {
  id: string;
  /** 控制点世界坐标 */
  at: Point2;
  /** 把该控制点拖到 world 后返回更新后的图形 */
  apply: (shape: Shape, world: Point2) => Shape;
}

const dist = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y);
const angleOf = (c: Point2, p: Point2) => Math.atan2(p.y - c.y, p.x - c.x);

/** 曲线的控制点：顶点（移点，曲率不变）+ 每点一条切线手柄（拖它单独调该处曲率） */
function curveHandles(ink: InkShape): Handle[] {
  if (!ink.smooth) return [];
  const step = Math.max(1, Math.ceil(ink.points.length / 16));
  const out: Handle[] = [];
  ink.points.forEach((p, i) => {
    if (i % step !== 0 && i !== ink.points.length - 1) return;
    out.push({ id: `k${i}`, at: p, apply: (s, w) => ({ ...(s as InkShape), points: (s as InkShape).points.map((q, j) => (j === i ? w : q)) }) });
    const tg = ink.tangents?.[i];
    if (!tg) return;
    out.push({
      id: `h${i}`, at: { x: p.x + tg.x, y: p.y + tg.y },
      apply: (s, w) => {
        const t = s as InkShape;
        const base = t.tangents ?? t.points.map(() => ({ x: 0, y: 0 }));
        return { ...t, tangents: base.map((v, j) => (j === i ? { x: w.x - p.x, y: w.y - p.y } : v)) };
      },
    });
  });
  return out;
}

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
        handles.push(
          rotHandleAt({ x: e.cx, y: e.cy }, Math.max(e.rx, e.ry) * 1.35, 0),
          {
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
        rotHandleAt(c, Math.max(0.5, a.r) * 1.35, orientDeg(shape)),
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
      const c: Point2 = { x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2 };
      const rad = Math.hypot(r.x2 - r.x1, r.y2 - r.y1) / 2;
      return [
        { id: "p1", at: { x: r.x1, y: r.y1 }, apply: (s, w) => ({ ...(s as RectShape), x1: w.x, y1: w.y }) },
        { id: "p2", at: { x: r.x2, y: r.y2 }, apply: (s, w) => ({ ...(s as RectShape), x2: w.x, y2: w.y }) },
        rotHandleAt(c, rad * 1.2, 0),
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
        {
          // 整体旋转：挂在一个固定偏移上，跟着图形一起转（拖起来光标指哪它指哪）
          id: "rot",
          at: {
            x: p.cx + p.r * 1.3 * Math.cos(p.rotation - Math.PI / 3),
            y: p.cy + p.r * 1.3 * Math.sin(p.rotation - Math.PI / 3),
          },
          apply: (s, w) => {
            const t = s as PolygonShape;
            return { ...t, rotation: Math.atan2(w.y - t.cy, w.x - t.cx) + Math.PI / 3 };
          },
        },
      ];
    }
    case "ray":
    case "line": {
      const l = shape as RayShape | LineShape;
      const mid: Point2 = { x: (l.x1 + l.x2) / 2, y: (l.y1 + l.y2) / 2 };
      const half = Math.hypot(l.x2 - l.x1, l.y2 - l.y1) / 2;
      return [
        { id: "p1", at: { x: l.x1, y: l.y1 }, apply: (s, w) => ({ ...(s as RayShape), x1: w.x, y1: w.y }) },
        { id: "p2", at: { x: l.x2, y: l.y2 }, apply: (s, w) => ({ ...(s as RayShape), x2: w.x, y2: w.y }) },
        rotHandleAt(mid, Math.max(0.6, half) * 1.2, orientDeg(shape)),
      ];
    }
    case "point": {
      const p = shape as PointShape;
      return [{ id: "p", at: { x: p.x, y: p.y }, apply: (s, w) => ({ ...(s as PointShape), x: w.x, y: w.y }) }];
    }
    case "ink":
      // 手绘笔迹不可编辑（橡皮整体删除）；曲线工具生成的点集可拖顶点与切线手柄
      return curveHandles(shape as InkShape);
    case "angle":
      return angleHandles(shape as AngleShape);
    case "poly":
      return polyHandles(shape as PolyShape);
    case "image": return imageHandles(shape as ImageShape);

    default:
      return [];
  }
}

/** 把点绕着中心转回去（用于旋转后的命中判定：屏幕顺时针 = 世界逆时针，符号与渲染一致） */
function unRotate(p: Point2, c: Point2, rot: number): Point2 {
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}


/**
 * 画布上的旋转控制点：挂在「朝向逆时针 60°」的方向上，半径由图形大小定。
 * base 是控制点当前所处的角度（矩形/椭圆传 0，因为它们整组跟着 rotate 一起转）。
 */
function rotHandleAt(center: Point2, r: number, baseDeg: number): Handle {
  const OFF = -60;
  const a = ((baseDeg + OFF) * Math.PI) / 180;
  return {
    id: "rot",
    at: { x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) },
    apply: (s0, w) => {
      // atan2 用的是世界坐标（y 向上），而画布 rotate() 是屏幕顺时针 —— 两者差一个符号，
      // 这里统一换算成「屏幕上顺时针为正」的角度，拖动方向才不会反
      const want = (Math.atan2(w.y - center.y, w.x - center.x) * 180) / Math.PI;
      return orientPatch(s0, (((want + 60) % 360) + 360) % 360);
    },
  };
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
      const w0 = e.rot ? unRotate(world, { x: e.cx, y: e.cy }, e.rot) : world;
      const dx = (w0.x - e.cx) / Math.max(e.rx, 0.01);
      const dy = (w0.y - e.cy) / Math.max(e.ry, 0.01);
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
      const w0 = r.rot ? unRotate(world, c, r.rot) : world;
      if (dist(w0, c) < Math.max(Math.abs(r.x2 - r.x1), Math.abs(r.y2 - r.y1))) return true;
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
      // 曲线按真实曲率采样后判定，否则弯出去的位置点不中
      const pts = ink.smooth && ink.tangents ? sampleCurve(ink.points, ink.tangents) : ink.points;
      if (pts.length === 1) return dist(world, pts[0]!) <= tol;
      return pts.some((p, i) => i > 0 && distToSegment(world, pts[i - 1]!, p) <= tol);
    }
    case "implicit": {
      const segs = sampleImplicit(shape as ImplicitShape);
      return segs.some(([a, b]) => distToSegment(world, a, b) <= tol);
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
