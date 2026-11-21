/**
 * 多点曲线：点击得到的控制点 → 平滑曲线（smooth ink）。
 * 每个点带一条出向切线 tangents[i]：渲染按三次贝塞尔，拖手柄即可单独调该处曲率。
 */
import type { InkShape, Point2 } from "./types";
import { newId } from "./types";

/** 相邻点距离小于该值视为重复（世界单位） */
const DUP_EPS = 0.08;

/** Catmull-Rom 切线：T_i = (P_{i+1} - P_{i-1}) / 6 —— 与标准 CR→贝塞尔等价 */
function catmullRomTangents(pts: Point2[]): Point2[] {
  return pts.map((_, i) => {
    const prev = pts[Math.max(0, i - 1)]!;
    const next = pts[Math.min(pts.length - 1, i + 1)]!;
    return { x: (next.x - prev.x) / 6, y: (next.y - prev.y) / 6 };
  });
}

export function buildCurve(points: Point2[], color: string, width: number): InkShape | null {
  const pts = [...points];
  while (pts.length >= 2) {
    const a = pts[pts.length - 1]!;
    const b = pts[pts.length - 2]!;
    if (Math.hypot(a.x - b.x, a.y - b.y) < DUP_EPS) pts.pop();
    else break;
  }
  if (pts.length < 2) return null;
  return {
    id: newId("ink"), type: "ink", points: pts, color, width, smooth: true,
    tangents: catmullRomTangents(pts),
  };
}

/**
 * 按切线采样贝塞尔曲线（每段 per 个点）。
 * 命中测试与包围盒需要真实曲率上的点，否则曲线弯出去的地方点不中。
 */
export function sampleCurve(points: Point2[], tangents: Point2[], per = 8): Point2[] {
  if (points.length < 2 || tangents.length !== points.length) return points;
  const out: Point2[] = [points[0]!];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const t1 = tangents[i]!;
    const t2 = tangents[i + 1]!;
    const c1 = { x: p1.x + t1.x, y: p1.y + t1.y };
    const c2 = { x: p2.x - t2.x, y: p2.y - t2.y };
    for (let k = 1; k <= per; k += 1) {
      const s = k / per;
      const u = 1 - s;
      out.push({
        x: u * u * u * p1.x + 3 * u * u * s * c1.x + 3 * u * s * s * c2.x + s * s * s * p2.x,
        y: u * u * u * p1.y + 3 * u * u * s * c1.y + 3 * u * s * s * c2.y + s * s * s * p2.y,
      });
    }
  }
  return out;
}
