/**
 * 图元创建：点击放默认大小 / 拖动决定尺寸。
 * 从 geometry.ts 拆出——那里只保留控制点与命中测试。
 */
import type {
  ArcShape, CircleShape, EllipseShape, LineShape, Point2, PointShape,
  PolygonShape, PrimitiveType, RayShape, RectShape, Shape,
} from "./types";
import { createPoly, isPolyKind } from "./poly";
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
