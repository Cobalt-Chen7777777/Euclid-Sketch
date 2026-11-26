/**
 * 隐函数采样：把 F(x,y)=0 变成一堆短线段（marching squares）。
 *
 * 为什么不做符号变形：解不出 y 的方程（xy=1、x^3+y^3-3xy=0）本来就没有显式解，
 * 直接按网格判定符号变化再线性插值，能覆盖任意可求值的 F，且实现只有几十行。
 *
 * 代价是分辨率固定：采样范围默认 [-10,10]²，网格 96×96。
 * 放大到极限时折线会显出棱角，这一点和函数曲线的 320 点采样是同一取舍。
 */
import { compileExpr } from "./expr";

import type { ImplicitShape, Point2 } from "./types";

/** 返回若干短线段（世界坐标），渲染时拼成一条 path */
export type Segment = [Point2, Point2];

const GRID = 96;
const CACHE_LIMIT = 48;
const cache = new Map<string, Segment[]>();

function interp(p1: Point2, v1: number, p2: Point2, v2: number): Point2 {
  const t = v1 / (v1 - v2);
  return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
}

/** 采样一条隐函数曲线（带缓存） */
export function sampleImplicit(shape: ImplicitShape, grid = GRID): Segment[] {
  const [x0, x1] = shape.xRange;
  const [y0, y1] = shape.yRange;
  const key = `i|${shape.expr}|${x0},${x1}|${y0},${y1}|${grid}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const fn = compileExpr(shape.expr);
  const nx = grid;
  const ny = grid;
  const dx = (x1 - x0) / nx;
  const dy = (y1 - y0) / ny;

  // 先在网格顶点求值，NaN / Infinity 记为 NaN（该格跳过）
  const vals: number[][] = [];
  for (let j = 0; j <= ny; j++) {
    const row: number[] = [];
    const y = y0 + dy * j;
    for (let i = 0; i <= nx; i++) {
      const x = x0 + dx * i;
      let v: number;
      try {
        v = fn({ x, y, pi: Math.PI, e: Math.E });
      } catch {
        v = NaN;
      }
      row.push(Number.isFinite(v) ? v : NaN);
    }
    vals.push(row);
  }

  const out: Segment[] = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v00 = vals[j]![i]!;
      const v10 = vals[j]![i + 1]!;
      const v11 = vals[j + 1]![i + 1]!;
      const v01 = vals[j + 1]![i]!;
      if (!Number.isFinite(v00) || !Number.isFinite(v10) || !Number.isFinite(v11) || !Number.isFinite(v01)) continue;
      // 四角同号：这一格没有零线
      const pos = (v00 > 0 ? 1 : 0) + (v10 > 0 ? 1 : 0) + (v11 > 0 ? 1 : 0) + (v01 > 0 ? 1 : 0);
      if (pos === 0 || pos === 4) continue;

      const bx = x0 + dx * i;
      const by = y0 + dy * j;
      const p00 = { x: bx, y: by };
      const p10 = { x: bx + dx, y: by };
      const p11 = { x: bx + dx, y: by + dy };
      const p01 = { x: bx, y: by + dy };

      const pts: Point2[] = [];
      if ((v00 > 0) !== (v10 > 0)) pts.push(interp(p00, v00, p10, v10));
      if ((v10 > 0) !== (v11 > 0)) pts.push(interp(p10, v10, p11, v11));
      if ((v11 > 0) !== (v01 > 0)) pts.push(interp(p11, v11, p01, v01));
      if ((v01 > 0) !== (v00 > 0)) pts.push(interp(p01, v01, p00, v00));

      // 正常两交点；四交点（鞍点）按顺序两两成段，视觉上仍是连续折线
      for (let k = 0; k + 1 < pts.length; k += 2) {
        out.push([pts[k]!, pts[k + 1]!]);
      }
    }
  }

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, out);
  return out;
}
