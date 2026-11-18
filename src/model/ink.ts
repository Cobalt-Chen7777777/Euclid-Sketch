import type { Point2 } from "./types";

/**
 * 笔迹平滑：三点加权平均（端点固定），去掉手指抖动带来的锯齿。
 * 只在采点完成后调用，不影响绘制时的跟手度。
 */
export function smoothPoints(points: Point2[]): Point2[] {
  if (points.length < 3) return points;
  const first = points[0];
  const tail = points[points.length - 1];
  if (!first || !tail) return points;

  const result: Point2[] = [first];
  for (let i = 1; i < points.length - 1; i += 1) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    if (!prev || !cur || !next) continue;
    result.push({
      x: (prev.x + 2 * cur.x + next.x) / 4,
      y: (prev.y + 2 * cur.y + next.y) / 4,
    });
  }
  result.push(tail);
  return result;
}
