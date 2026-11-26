/**
 * 公式解析：把用户输入的数学表达式解析为可渲染的图形数据。
 * 支持四类：
 *   1. 圆的方程：x^2 + y^2 = r^2、(x-a)^2 + (y-b)^2 = r^2
 *   2. 椭圆方程：x^2/a^2 + y^2/b^2 = 1
 *   3. 函数：y = f(x) 或直接写 f(x)，如 sin(x)、x^2
 *   4. 参数方程：x = f(t), y = g(t)，如 x=cos(t), y=sin(t)
 *
 * 用轻量自研求值器 expr.ts 做编译与求值（替代 mathjs 以大幅减小包体积）。
 */
import { compileExpr, type EvalFn } from "./expr";

import type { CircleShape, EllipseShape, FunctionShape, ImplicitShape, ParametricShape, Point2, Shape } from "./types";
import { newId, PALETTE } from "./types";

export type ParseResult =
  | { kind: "circle"; shape: CircleShape }
  | { kind: "ellipse"; shape: EllipseShape }
  | { kind: "function"; shape: FunctionShape }
  | { kind: "parametric"; shape: ParametricShape }
  | { kind: "implicit"; shape: ImplicitShape }
  | { kind: "error"; message: string };

/** 将常见数学写法规范化为可解析形式 */
function normalize(input: string): string {
  return input
    .replace(/[×·]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/[−–—]/g, "-")
    // 上标：从微信/网页复制来的 x²+y²=1 也要认
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/\s+/g, "")
    // xy 这类连写按隐式乘法拆开（expx 里的 x 后面不是字母，不会误伤）
    .replace(/([xy])(?=[xy])/g, "$1*")
    .replace(/\^/g, "^");
}

/** 编译缓存：表达式字符串 → 编译结果。避免每次渲染重复编译。 */
const compileCache = new Map<string, EvalFn>();

/** 安全编译表达式，返回求值函数（带缓存） */
function safeCompile(expr: string): EvalFn {
  const cached = compileCache.get(expr);
  if (cached) return cached;
  const compiled = compileExpr(expr);
  compileCache.set(expr, compiled);
  return compiled;
}

function evalNumber(fn: EvalFn, scope: Record<string, number>): number {
  const value = fn(scope);
  if (!Number.isFinite(value)) throw new Error("表达式结果不是有限数字");
  return value;
}

/** 尝试解析圆的方程。返回 null 表示不是圆方程。 */
function tryCircle(raw: string, color: string): CircleShape | null {
  const s = normalize(raw);
  // 归一化 π
  if (!s.includes("=")) return null;
  const eqIndex = s.indexOf("=");
  const left = s.slice(0, eqIndex);
  const right = s.slice(eqIndex + 1);

  // 标准式：(x-a)^2+(y-b)^2=r^2  或  x^2+y^2=r^2
  const std =
    /^\(?x([+-]\d+(?:\.\d+)?)?\)?\^2\+?\(?y([+-]\d+(?:\.\d+)?)?\)?\^2$/i;
  const m = left.match(std);
  if (!m) return null;

  // left 中 x 的偏移：x+3 表示 a=-3；x-3 表示 a=3
  const parseOffset = (token?: string): number => {
    if (!token) return 0;
    const n = Number(token);
    return Number.isFinite(n) ? -n : 0;
  };
  const cx = parseOffset(m[1]);
  const cy = parseOffset(m[2]);

  // 右侧应为 r^2 或数字
  let r: number;
  if (/^[\d.]+(?:\^2)?$/.test(right)) {
    const base = right.replace(/\^2$/, "");
    const squared = right.endsWith("^2");
    const n = Number(base);
    r = squared ? Math.sqrt(n) : Math.sqrt(n);
  } else {
    try {
      const fn = safeCompile(right);
      const val = evalNumber(fn, { pi: Math.PI });
      r = Math.sqrt(Math.abs(val));
    } catch {
      return null;
    }
  }
  if (!Number.isFinite(r) || r <= 0) return null;

  return {
    id: newId("circle"),
    type: "circle",
    cx,
    cy,
    r,
    source: raw.trim(),
    color,
  };
}

/** 解析椭圆方程：x^2/a^2 + y^2/b^2 = 1（可带平移） */
function tryEllipse(raw: string, color: string): EllipseShape | null {
  const s = normalize(raw);
  if (!s.includes("=")) return null;
  const eq = s.indexOf("=");
  const left = s.slice(0, eq);
  const right = s.slice(eq + 1);
  if (right !== "1" && right !== "1.0") return null;

  // (x-a)^2 / A + (y-b)^2 / B，A/B 为 a^2 / b^2
  const re = /^\(?x([+-][\d.]+)?\)?\^2\/([\d.]+(?:\^2)?)\+?\(?y([+-][\d.]+)?\)?\^2\/([\d.]+(?:\^2)?)$/i;
  const m = left.match(re);
  if (!m) return null;

  const denom = (token: string): number => {
    const squared = token.endsWith("^2");
    const base = Number(token.replace(/\^2$/, ""));
    if (!Number.isFinite(base) || base <= 0) return NaN;
    return squared ? base * base : base;
  };
  const a2 = denom(m[2] ?? "");
  const b2 = denom(m[4] ?? "");
  if (!Number.isFinite(a2) || !Number.isFinite(b2)) return null;

  const offset = (token?: string): number => (token ? -Number(token) : 0);
  return {
    id: newId("ellipse"),
    type: "ellipse",
    cx: offset(m[1]),
    cy: offset(m[3]),
    rx: Math.sqrt(a2),
    ry: Math.sqrt(b2),
    source: raw.trim(),
    color,
  };
}

/** 解析参数方程：x=..., y=...（用逗号或分号分隔） */
function tryParametric(raw: string, color: string): ParametricShape | null {
  const s = normalize(raw);
  // 形如 x=cos(t),y=sin(t)
  const re = /^x=([^,;]+)[,;]y=([^,;]+)$/i;
  const m = s.match(re);
  if (!m || !m[1] || !m[2]) return null;
  try {
    safeCompile(m[1]);
    safeCompile(m[2]);
  } catch {
    return null;
  }
  return {
    id: newId("param"),
    type: "parametric",
    xExpr: m[1],
    yExpr: m[2],
    tRange: [0, Math.PI * 2],
    source: raw.trim(),
    color,
  };
}

/**
 * 解析隐函数：任意 F(x,y)=0。
 * 圆的方程与椭圆方程在上面已经单独认出来了（它们还能给出圆心半径等参数），
 * 走到这里的都是没有显式解的方程：xy=1、x^3+y^3-3xy=0、x^2=4（两条竖直线）。
 */
function tryImplicit(raw: string, color: string): ImplicitShape | null {
  const s = normalize(raw);
  const eq = s.indexOf("=");
  if (eq <= 0) return null;
  const lhs = s.slice(0, eq);
  const rhs = s.slice(eq + 1);
  if (!lhs || !rhs) return null;
  // y=f(x) 与 f(x)=... 交给 tryFunction
  if (lhs === "y" || /^f\(/.test(lhs)) return null;
  const expr = `(${lhs})-(${rhs})`;
  if (!/[xy]/.test(expr)) return null;
  try {
    safeCompile(expr);
  } catch {
    return null;
  }
  return {
    id: newId("implicit"),
    type: "implicit",
    expr,
    xRange: [-10, 10],
    yRange: [-10, 10],
    source: raw.trim(),
    color,
  };
}

/** 解析函数 y=f(x) */
function tryFunction(raw: string, color: string): FunctionShape | null {
  const s = normalize(raw).replace(/^y=/i, "");
  if (!s) return null;
  // 去掉外层方括号已被 normalize 处理
  try {
    safeCompile(s);
  } catch {
    return null;
  }
  return {
    id: newId("fn"),
    type: "function",
    expr: s,
    xRange: [-10, 10],
    source: raw.trim(),
    color,
  };
}

export function parseFormula(input: string, color: string = PALETTE[0] ?? "#2563eb"): ParseResult {
  const raw = input.trim();
  if (!raw) return { kind: "error", message: "请输入公式" };

  // 顺序很重要：参数方程 > 圆方程 > 椭圆方程 > 函数
  const param = tryParametric(raw, color);
  if (param) return { kind: "parametric", shape: param };

  const circle = tryCircle(raw, color);
  if (circle) return { kind: "circle", shape: circle };

  const ellipse = tryEllipse(raw, color);
  if (ellipse) return { kind: "ellipse", shape: ellipse };

  const implicit = tryImplicit(raw, color);
  if (implicit) return { kind: "implicit", shape: implicit };

  const fn = tryFunction(raw, color);
  if (fn) return { kind: "function", shape: fn };

  return { kind: "error", message: "无法识别的公式，请检查语法" };
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
    const pts: Point2[] = [];
    for (let i = 0; i <= samples; i++) {
      const x = x0 + ((x1 - x0) * i) / samples;
      try {
        const y = evalNumber(fn, { x, pi: Math.PI, e: Math.E });
        if (Number.isFinite(y)) pts.push({ x, y });
      } catch {
        // 定义域外跳过
      }
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
    const pts: Point2[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = t0 + ((t1 - t0) * i) / samples;
      try {
        const x = evalNumber(fx, { t, pi: Math.PI });
        const y = evalNumber(fy, { t, pi: Math.PI });
        if (Number.isFinite(x) && Number.isFinite(y)) pts.push({ x, y });
      } catch {
        // 跳过
      }
    }
    return pts;
  });
}

/** 圆上的采样点（用于统一导出与吸附） */
export function sampleCircle(shape: CircleShape, samples = 120): Point2[] {
  const pts: Point2[] = [];
  for (let i = 0; i <= samples; i++) {
    const a = (Math.PI * 2 * i) / samples;
    pts.push({
      x: shape.cx + shape.r * Math.cos(a),
      y: shape.cy + shape.r * Math.sin(a),
    });
  }
  return pts;
}

/**
 * 是否由「函数面板」绘制出来的图形。
 * 函数 / 参数方程恒为公式图形；圆与椭圆只有带 source 才算
 * （手动拖出的圆、椭圆不带 source，清除函数时不能误删）。
 */
export function isFormulaShape(shape: Shape): boolean {
  if (shape.type === "function" || shape.type === "parametric" || shape.type === "implicit") return true;
  if (shape.type === "circle" || shape.type === "ellipse") {
    return typeof shape.source === "string" && shape.source.length > 0;
  }
  return false;
}
