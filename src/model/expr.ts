/**
 * 轻量数学表达式求值器（递归下降）。
 * 只实现绘图所需语法，替代全量 mathjs（后者单是打包就 ~650KB，首屏解析卡顿）。
 *
 * 支持：
 *   - 四则运算 + - * /（含隐式乘法如 2x、3sin(x)）
 *   - 乘方 ^（右结合）
 *   - 一元正负号
 *   - 括号
 *   - 函数 sin cos tan asin acos atan sqrt abs log ln exp floor ceil round sign
 *   - 常量 pi e（以及 π）
 *   - 变量：由调用方在 scope 中提供（如 x、t）
 *
 * 编译一次得到闭包，后续求值只需传 scope，适合曲线采样（数百次重复求值）。
 */

export type EvalFn = (scope: Record<string, number>) => number;

type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "lp" }
  | { t: "rp" }
  | { t: "bar" };

const FUNCTIONS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sqrt: Math.sqrt, abs: Math.abs,
  log: Math.log10, ln: Math.log, exp: Math.exp,
  floor: Math.floor, ceil: Math.ceil, round: Math.round, sign: Math.sign,
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI, "π": Math.PI, e: Math.E,
};

/** 词法分析 */
function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i]!;
    if (c === " " || c === "\t" || c === "\n") { i++; continue; }
    if (c >= "0" && c <= "9" || c === ".") {
      let num = "";
      while (i < src.length && /[\d.]/.test(src[i]!)) num += src[i++];
      const v = Number(num);
      if (!Number.isFinite(v)) throw new Error(`无效数字 ${num}`);
      out.push({ t: "num", v });
      continue;
    }
    if (/[a-zA-Zπ]/.test(c)) {
      let id = "";
      while (i < src.length && /[a-zA-Zπ]/.test(src[i]!)) id += src[i++];
      out.push({ t: "id", v: id });
      continue;
    }
    if (c === "(") { out.push({ t: "lp" }); i++; continue; }
    if (c === ")") { out.push({ t: "rp" }); i++; continue; }
    // 竖线：绝对值，|x+1|；成对解析，嵌套请写 abs(abs(x))
    if (c === "|") { out.push({ t: "bar" }); i++; continue; }
    if ("+-*/^".includes(c)) { out.push({ t: "op", v: c }); i++; continue; }
    throw new Error(`不支持的字符 ${c}`);
  }
  return out;
}

/** 递归下降语法分析，产出 AST（闭包形式） */
function parse(tokens: Token[]): EvalFn {
  let pos = 0;
  // 正在解析 |…| 内部：此时竖线是结束符，不能再当隐式乘法的起点（否则 2|x| 会吃掉右竖线）
  let barDepth = 0;
  const peek = (): Token | undefined => tokens[pos];
  const eat = (): Token | undefined => tokens[pos++];

  // expr := term (('+'|'-') term)*
  function expr(): EvalFn {
    let left = term();
    for (;;) {
      const tk = peek();
      if (tk?.t === "op" && (tk.v === "+" || tk.v === "-")) {
        eat();
        const right = term();
        const l = left, r = right, plus = tk.v === "+";
        left = plus ? (s) => l(s) + r(s) : (s) => l(s) - r(s);
      } else break;
    }
    return left;
  }

  // term := unary (('*'|'/') unary)*
  function term(): EvalFn {
    let left = unary();
    for (;;) {
      const tk = peek();
      if (tk?.t === "op" && (tk.v === "*" || tk.v === "/")) {
        eat();
        const right = unary();
        const l = left, r = right, mul = tk.v === "*";
        left = mul ? (s) => l(s) * r(s) : (s) => l(s) / r(s);
      } else if (tk?.t === "id" || tk?.t === "num" || tk?.t === "lp" || (tk?.t === "bar" && barDepth === 0)) {
        // 隐式乘法：2x、x(y+1)、3sin(x)、2|x|
        const right = unary();
        const l = left, r = right;
        left = (s) => l(s) * r(s);
      } else break;
    }
    return left;
  }

  // unary := ('+'|'-') unary | power
  function unary(): EvalFn {
    const tk = peek();
    if (tk?.t === "op" && (tk.v === "+" || tk.v === "-")) {
      eat();
      const inner = unary();
      return tk.v === "-" ? (s) => -inner(s) : inner;
    }
    return power();
  }

  // power := atom ('^' unary)?   —— 右结合
  function power(): EvalFn {
    const base = atom();
    const tk = peek();
    if (tk?.t === "op" && tk.v === "^") {
      eat();
      const exp = unary();
      return (s) => Math.pow(base(s), exp(s));
    }
    return base;
  }

  // atom := num | id [ '(' expr ')' ] | '(' expr ')'
  function atom(): EvalFn {
    const tk = eat();
    if (!tk) throw new Error("表达式不完整");
    if (tk.t === "num") {
      const v = tk.v;
      return () => v;
    }
    if (tk.t === "lp") {
      const inner = expr();
      const close = eat();
      if (close?.t !== "rp") throw new Error("缺少右括号");
      return inner;
    }
    if (tk.t === "bar") {
      barDepth++;
      const inner = expr();
      barDepth--;
      const close = eat();
      if (close?.t !== "bar") throw new Error("绝对值缺少配对的 |");
      return (s) => Math.abs(inner(s));
    }
    if (tk.t === "id") {
      const fn = FUNCTIONS[tk.v];
      if (fn) {
        if (peek()?.t !== "lp") {
          // 允许省略括号：tan60°、sin pi、sqrt2 —— 取紧随其后的一个原子作参数
          const arg = unary();
          return (s) => fn(arg(s));
        }
        eat();
        const arg = expr();
        const close = eat();
        if (close?.t !== "rp") throw new Error(`函数 ${tk.v} 缺少右括号`);
        return (s) => fn(arg(s));
      }
      const constVal = CONSTANTS[tk.v];
      if (constVal !== undefined) {
        const v = constVal;
        return () => v;
      }
      // 变量
      const name = tk.v;
      return (s) => {
        const val = s[name];
        if (typeof val !== "number") throw new Error(`未知变量 ${name}`);
        return val;
      };
    }
    throw new Error("无法解析的表达式");
  }

  const fn = expr();
  if (pos !== tokens.length) throw new Error("表达式存在多余内容");
  return fn;
}

/**
 * 度数 → 弧度：60° / 60deg / 60 度 都改写成 (60*pi/180)。
 * 三角函数一律用弧度，但写角度更符合做题习惯，这里统一在编译前转换。
 * 兼容 iOS 键盘与 PDF 复制出来的各类度数符号（°、º、˚、度）。
 */
export function normalizeDegrees(source: string): string {
  return source
    .replace(/(\d+(?:\.\d+)?)\s*[°º˚度]/g, "($1*pi/180)")
    .replace(/(\d+(?:\.\d+)?)\s*deg\b/gi, "($1*pi/180)")
    // 弧度高数：60 rad 等于 60，直接去掉单位
    .replace(/\s+rad\b/gi, "");
}

/** 补全未闭合的右括号：键盘敲 tan(60° 时不必再手点 ) */
export function autoCloseParens(source: string): string {
  const open = (source.match(/\(/g) ?? []).length;
  const close = (source.match(/\)/g) ?? []).length;
  return open > close ? source + ")".repeat(open - close) : source;
}

/** 编译表达式为可重复求值的闭包（带调用方缓存更佳） */
export function compileExpr(source: string): EvalFn {
  return parse(tokenize(autoCloseParens(normalizeDegrees(source))));
}
