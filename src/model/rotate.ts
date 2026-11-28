/**
 * 旋转相关的通用小工具：哪些图形带旋转、绕哪一点转。
 * 图片、矩形、椭圆用同一个 `rot` 字段（弧度，屏幕顺时针），其余图形没有旋转概念。
 */
import type { Handle } from "./geometry";
import type { Point2, Shape } from "./types";

/** 图形的旋转角（弧度）；不支持旋转的返回 0 */
export function shapeRot(s: Shape | null | undefined): number {
  if (!s) return 0;
  if (s.type === "image" || s.type === "rect" || s.type === "ellipse") return s.rot ?? 0;
  return 0;
}

/** 旋转中心（世界坐标）：图片取框中心、矩形取对角中点、椭圆取圆心 */
export function shapeCenter(s: Shape): Point2 | null {
  if (s.type === "image") return { x: s.x + s.w / 2, y: s.y + s.h / 2 };
  if (s.type === "rect") return { x: (s.x1 + s.x2) / 2, y: (s.y1 + s.y2) / 2 };
  if (s.type === "ellipse") return { x: s.cx, y: s.cy };
  return null;
}

/** 把图形整体转 delta（弧度，屏幕顺时针）：矩形/椭圆改 rot，线/射线转端点，圆弧转起止角 */
export function rotateShapeBy(s: Shape, delta: number): Shape {
  if (s.type === "rect" || s.type === "ellipse") return { ...s, rot: (s.rot ?? 0) + delta };
  if (s.type === "line" || s.type === "ray") {
    const cx = (s.x1 + s.x2) / 2;
    const cy = (s.y1 + s.y2) / 2;
    const cos = Math.cos(delta);
    const sin = Math.sin(delta);
    const rot = (x: number, y: number) => ({
      x: cx + (x - cx) * cos - (y - cy) * sin,
      y: cy + (x - cx) * sin + (y - cy) * cos,
    });
    const a = rot(s.x1, s.y1);
    const b = rot(s.x2, s.y2);
    return { ...s, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
  }
  if (s.type === "arc") return { ...s, startAngle: s.startAngle + delta, endAngle: s.endAngle + delta };
  return s;
}

/** 当前朝向（度，0–360）：矩形/椭圆看 rot，线段看指向，圆弧看起始角 */
export function orientDeg(s: Shape): number {
  let rad = 0;
  if (s.type === "rect" || s.type === "ellipse") rad = s.rot ?? 0;
  else if (s.type === "line" || s.type === "ray") rad = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
  else if (s.type === "arc") rad = s.startAngle;
  const deg = (rad * 180) / Math.PI;
  return ((Math.round(deg) % 360) + 360) % 360;
}

/** 把朝向设成指定角度：矩形/椭圆直接写 rot，线段和圆弧按差值整体转 */
export function orientPatch(s: Shape, deg: number): Shape {
  if (s.type === "rect" || s.type === "ellipse") return { ...s, rot: (deg * Math.PI) / 180 };
  const cur = (orientDeg(s) * Math.PI) / 180;
  return rotateShapeBy(s, (deg * Math.PI) / 180 - cur);
}


/**
 * 画布上的旋转控制点：位置和拖动都按「屏幕角度」算（画布 rotate() 是屏幕顺时针），
 * 两边同一套角度才跟手、方向不反。base 是图形当前朝向（度），矩形 / 椭圆传 0。
 */
export function rotHandleAt(center: Point2, r: number, baseDeg: number): Handle {
  const OFF = 60; // 控制点相对图形朝向的屏幕夹角
  const a = -((baseDeg + OFF) * Math.PI) / 180; // 世界坐标 y 向上，屏幕角取反
  return {
    id: "rot",
    at: { x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) },
    apply: (s0, w) => {
      const screenDeg = (-Math.atan2(w.y - center.y, w.x - center.x) * 180) / Math.PI;
      return orientPatch(s0, ((screenDeg - OFF) % 360 + 360) % 360);
    },
  };
}
