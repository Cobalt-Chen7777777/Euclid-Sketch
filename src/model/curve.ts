/**
 * 多点曲线：把点击得到的控制点去重后转成平滑笔迹（smooth ink）。
 * 双击结束时会重复记录末点，这里统一清理。
 */
import type { InkShape, Point2 } from "./types";
import { newId } from "./types";

/** 相邻点距离小于该值视为重复（世界单位） */
const DUP_EPS = 0.08;

export function buildCurve(points: Point2[], color: string, width: number): InkShape | null {
  const pts = [...points];
  while (pts.length >= 2) {
    const a = pts[pts.length - 1]!;
    const b = pts[pts.length - 2]!;
    if (Math.hypot(a.x - b.x, a.y - b.y) < DUP_EPS) pts.pop();
    else break;
  }
  if (pts.length < 2) return null;
  return { id: newId("ink"), type: "ink", points: pts, color, width, smooth: true };
}
