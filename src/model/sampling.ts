/**
 * 曲线采样：显函数按「弦中点偏差」自适应加密，参数方程等距取点，都带一层缓存。
 * 从 formula.ts 拆出来，那边只管解析，这边只管采样。
 */
import { evalNumber, safeCompile } from "./formula";
import type { FunctionShape, ParametricShape, Point2, PolarShape } from "./types";



/**
 * 参数型曲线（参数方程 / 极坐标）的自适应加密：
 * 先等距取点估出包围盒，再把「中点明显偏离弦」的段二分，最多 3 层。
 * 这是 GeoGebra / Desmos 处理参数曲线的基本做法：弯处加密、直处不浪费。
 */
function adaptiveOverParam(
  t0: number,
  t1: number,
  baseCount: number,
  f: (t: number) => Point2 | null,
): Point2[] {
  const base: Point2[] = [];
  for (let i = 0; i <= baseCount; i += 1) {
    const q = f(t0 + ((t1 - t0) * i) / baseCount);
    if (q) base.push(q);
  }
  if (base.length < 2) return base;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const q of base) {
    minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x);
    minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y);
  }
  // 容差按包围盒对角线定：约等于屏幕上 1px 的量级
  const tol = Math.max(1e-9, Math.hypot(maxX - minX, maxY - minY) / 1200);
  const out: Point2[] = [base[0]!];
  const refine = (ta: number, a: Point2, tb: number, b: Point2, depth: number) => {
    if (depth < 3) {
      const tm = (ta + tb) / 2;
      const m = f(tm);
      if (m) {
        const dev = Math.hypot(m.x - (a.x + b.x) / 2, m.y - (a.y + b.y) / 2);
        if (dev > tol) {
          refine(ta, a, tm, m, depth + 1);
          refine(tm, m, tb, b, depth + 1);
          return;
        }
      }
    }
    out.push(b);
  };
  for (let i = 0; i < base.length - 1; i += 1) {
    refine(t0 + ((t1 - t0) * i) / baseCount, base[i]!, t0 + ((t1 - t0) * (i + 1)) / baseCount, base[i + 1]!, 0);
  }
  return out;
}

/** 采样点缓存：表达式 + 范围 + 采样数 → 点序列。上限防止内存增长。 */
const SAMPLE_CACHE_LIMIT = 64;
const sampleCache = new Map<string, Point2[]>();
function cachedSamples(key: string, compute: () => Point2[]): Point2[] {
  const hit = sampleCache.get(key);
  if (hit) return hit;
  const pts = compute();
  if (sampleCache.size >= SAMPLE_CACHE_LIMIT) {
    const oldest = sampleCache.keys().next().value;
    if (oldest !== undefined) sampleCache.delete(oldest);
  }
  sampleCache.set(key, pts);
  return pts;
}

/** 采样函数曲线为点序列（带缓存） */
export function sampleFunction(
  shape: FunctionShape,
  samples = 400,
): Point2[] {
  const [x0, x1] = shape.xRange;
  return cachedSamples(`f|${shape.expr}|${x0}|${x1}|${samples}`, () => {
    const fn = safeCompile(shape.expr);
    const f = (x: number): number | null => {
      try {
        const y = evalNumber(fn, { x, pi: Math.PI, e: Math.E });
        return Number.isFinite(y) ? y : null;
      } catch {
        return null;
      }
    };
    // 自适应加密（GeoGebra / Desmos 的做法）：先等距取点估出纵向范围，
    // 再在「弦中点偏离超过容差」的段上二分——弯得厉害处点密，接近直线处不浪费
    const base: Point2[] = [];
    for (let i = 0; i <= samples; i += 1) {
      const x = x0 + ((x1 - x0) * i) / samples;
      const y = f(x);
      if (y !== null) base.push({ x, y });
    }
    if (base.length < 2) return base;
    let lo = Number.POSITIVE_INFINITY;
    let hi = Number.NEGATIVE_INFINITY;
    for (const q of base) { lo = Math.min(lo, q.y); hi = Math.max(hi, q.y); }
    const tol = Math.max(1e-9, ((hi - lo) / samples) * 0.25);
    const pts: Point2[] = [base[0]!];
    const deep = 4;
    const refine = (a: Point2, b: Point2, depth: number) => {
      if (depth < deep) {
        const mx = (a.x + b.x) / 2;
        const my = f(mx);
        if (my !== null && Math.abs(my - (a.y + b.y) / 2) > tol) {
          refine(a, { x: mx, y: my }, depth + 1);
          refine({ x: mx, y: my }, b, depth + 1);
          return;
        }
      }
      pts.push(b);
    };
    for (let i = 1; i < base.length; i += 1) refine(base[i - 1]!, base[i]!, 0);
    // 定义域不连续（中间有跳变）时把断点补齐，渲染层再按跳变断开
    for (let i = 1; i < base.length; i += 1) {
      if (base[i]!.x - base[i - 1]!.x > (x1 - x0) / samples * 1.5) pts.push(base[i]!);
    }
    return pts;
  });
}

/** 采样参数方程为点序列（带缓存） */
export function sampleParametric(
  shape: ParametricShape,
  samples = 400,
): Point2[] {
  const [t0, t1] = shape.tRange;
  return cachedSamples(`p|${shape.xExpr}|${shape.yExpr}|${t0}|${t1}|${samples}`, () => {
    const fx = safeCompile(shape.xExpr);
    const fy = safeCompile(shape.yExpr);
    return adaptiveOverParam(t0, t1, Math.max(120, Math.round(samples / 2)), (t) => {
      try {
        const x = evalNumber(fx, { t, pi: Math.PI });
        const y = evalNumber(fy, { t, pi: Math.PI });
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
      } catch {
        return null;
      }
    });
  });
}

/** 极坐标曲线 r = f(θ)：θ 均匀取点，再换成直角坐标 */
export function samplePolar(shape: PolarShape, samples = 1200): Point2[] {
  const [t0, t1] = shape.tRange;
  return cachedSamples(`r|${shape.expr}|${t0}|${t1}|${samples}`, () => {
    const fn = safeCompile(shape.expr);
    return adaptiveOverParam(t0, t1, Math.max(120, Math.round(samples / 2)), (t) => {
      try {
        const r = evalNumber(fn, { t, pi: Math.PI, e: Math.E });
        return Number.isFinite(r) ? { x: r * Math.cos(t), y: r * Math.sin(t) } : null;
      } catch {
        return null;
      }
    });
  });
}
