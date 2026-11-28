/**
 * 隐函数采样：把 F(x,y)=0 变成一堆短线段（marching squares）。
 *
 * 为什么不做符号变形：解不出 y 的方程（xy=1、x^3+y^3-3xy=0）本来就没有显式解，
 * 直接按网格判定符号变化再线性插值，能覆盖任意可求值的 F，且实现只有几十行。
 *
 * 代价是分辨率固定：采样范围默认 [-10,10]²，网格 96×96。
 * 放大到极限时折线会显出棱角，这一点和函数曲线的 320 点采样是同一取舍。
 */
import { normalize } from "./formula";
import { compileExpr } from "./expr";

import type { ImplicitShape, Point2 } from "./types";

/** 返回若干短线段（世界坐标），渲染时拼成一条 path */
export type Segment = [Point2, Point2];

// 网格越细曲线越顺：96 时 x^3+y^3=y^2 这种曲线明显是一段段折线，提到 200 后基本光滑
const GRID = 200;
const CACHE_LIMIT = 48;
const cache = new Map<string, Segment[]>();

function interp(p1: Point2, v1: number, p2: Point2, v2: number): Point2 {
  const t = v1 / (v1 - v2);
  return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
}

/**
 * 采样一条隐函数曲线（带缓存）。
 *
 * 采用 Desmos 那套「自适应细分」而不是固定网格：先把画面切成粗格，
 * 只在跨零点的格子（以及数值波动大的格子）里四分成更小的格子，一路细分到约 1px。
 * 好处是曲线附近点密、空白处不浪费，相切处也不会因为格子太粗而整段消失。
 */
export function sampleImplicit(shape: ImplicitShape, grid = GRID): Segment[] {
  const [x0, x1] = shape.xRange;
  const [y0, y1] = shape.yRange;
  const key = `i|${shape.expr}|${x0},${x1}|${y0},${y1}|${grid}`;
  const hit = cache.get(key);
  if (hit) return hit;

  // expr 理论上已在创建时归一（xy → x*y），但旧文档 / 手改数据可能没归一，这里兜一次
  const fn = compileExpr(normalize(shape.expr));
  // 顶点求值缓存：细分时同一顶点会被重复问到
  const seen = new Map<string, number>();
  const V = (x: number, y: number): number => {
    const k = `${x.toFixed(7)},${y.toFixed(7)}`;
    const old = seen.get(k);
    if (old !== undefined) return old;
    let v: number;
    try {
      v = fn({ x, y, pi: Math.PI, e: Math.E });
    } catch {
      v = NaN;
    }
    const out = Number.isFinite(v) ? v : NaN;
    seen.set(k, out);
    return out;
  };

  const base = Math.max(8, Math.round(grid / 12)); // 起始粗格：16 左右
  const spanX = x1 - x0;
  const spanY = y1 - y0;
  const finest = Math.max(spanX, spanY) / (grid * 2); // 最细约半格，够平滑
  const maxDepth = 7;
  const out: Segment[] = [];

  /** 一个格子：要么出一段零线，要么继续细分 */
  const walk = (ax: number, ay: number, bx: number, by: number, depth: number) => {
    const v00 = V(ax, ay);
    const v10 = V(bx, ay);
    const v11 = V(bx, by);
    const v01 = V(ax, by);
    if (!Number.isFinite(v00) || !Number.isFinite(v10) || !Number.isFinite(v11) || !Number.isFinite(v01)) return;

    const pos = (v00 > 0 ? 1 : 0) + (v10 > 0 ? 1 : 0) + (v11 > 0 ? 1 : 0) + (v01 > 0 ? 1 : 0);
    const sameSide = pos === 0 || pos === 4;
    // 同号也可能藏着相切的曲线：四角数值差得很大就继续细分
    const spread = Math.max(Math.abs(v00 - v10), Math.abs(v10 - v11), Math.abs(v11 - v01), Math.abs(v01 - v00));
    const magnitude = Math.abs(v00) + Math.abs(v10) + Math.abs(v11) + Math.abs(v01);
    const bumpy = spread > Math.max(1e-9, magnitude * 0.6);

    const size = Math.max(bx - ax, by - ay);
    const canSplit = depth < maxDepth && size > finest;
    if (sameSide && !(bumpy && canSplit)) return;
    if (canSplit) {
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      walk(ax, ay, mx, my, depth + 1);
      walk(mx, ay, bx, my, depth + 1);
      walk(mx, my, bx, by, depth + 1);
      walk(ax, my, mx, by, depth + 1);
      return;
    }
    if (sameSide) return;

    // 细到约 1px：按四角符号取交点，两两成段
    const p00 = { x: ax, y: ay };
    const p10 = { x: bx, y: ay };
    const p11 = { x: bx, y: by };
    const p01 = { x: ax, y: by };
    const pts: Point2[] = [];
    if ((v00 > 0) !== (v10 > 0)) pts.push(interp(p00, v00, p10, v10));
    if ((v10 > 0) !== (v11 > 0)) pts.push(interp(p10, v10, p11, v11));
    if ((v11 > 0) !== (v01 > 0)) pts.push(interp(p11, v11, p01, v01));
    if ((v01 > 0) !== (v00 > 0)) pts.push(interp(p01, v01, p00, v00));
    for (let k = 0; k + 1 < pts.length; k += 2) out.push([pts[k]!, pts[k + 1]!]);
  };

  for (let j = 0; j < base; j += 1) {
    for (let i = 0; i < base; i += 1) {
      walk(
        x0 + (spanX * i) / base, y0 + (spanY * j) / base,
        x0 + (spanX * (i + 1)) / base, y0 + (spanY * (j + 1)) / base,
        0,
      );
    }
  }

  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, out);
  return out;
}

/**
 * 把零散的小线段串成折线：marching squares 每个格子各出一条线段，
 * 直接一段段画出来会在接缝处发虚、拐角发棱，串成整条折线后描边是连续的。
 */
export function chainSegments(segs: Segment[], tol = 1e-4): Point2[][] {
  const key = (p: Point2) => `${Math.round(p.x / tol)}:${Math.round(p.y / tol)}`;
  const used = new Array<boolean>(segs.length).fill(false);
  // 端点 → 线段下标，串线时用来找下一段
  const at = new Map<string, number[]>();
  segs.forEach(([a, b], i) => {
    for (const k of [key(a), key(b)]) {
      const list = at.get(k);
      if (list) list.push(i);
      else at.set(k, [i]);
    }
  });
  const same = (p: Point2, q: Point2) => key(p) === key(q);
  const lines: Point2[][] = [];
  for (let i = 0; i < segs.length; i += 1) {
    if (used[i]) continue;
    used[i] = true;
    const [a, b] = segs[i]!;
    const line: Point2[] = [a, b];
    // 往后接
    let tail = b;
    for (;;) {
      const next = (at.get(key(tail)) ?? []).find((j) => !used[j]);
      if (next === undefined) break;
      used[next] = true;
      const [c, d] = segs[next]!;
      tail = same(c, tail) ? d : c;
      line.push(tail);
    }
    // 往前接
    let head = a;
    for (;;) {
      const prev = (at.get(key(head)) ?? []).find((j) => !used[j]);
      if (prev === undefined) break;
      used[prev] = true;
      const [c, d] = segs[prev]!;
      head = same(c, head) ? d : c;
      line.unshift(head);
    }
    lines.push(line);
  }
  return lines;
}
