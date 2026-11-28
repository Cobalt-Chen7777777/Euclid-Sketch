/* eslint-disable no-restricted-syntax, no-restricted-globals -- 小窗拖动位置必须动态 style；窗口缩放时要重新测量是否放得下 */
/**
 * 函数面板：科学计算器式界面。
 *
 * 三块：
 *   1. 已绘制的曲线列表（可逐条删除）
 *   2. y = 输入框 + 代入求值行（x = ? → 结果）
 *   3. 函数键位（sin/cos/tan/asin/acos/atan/ln/log/exp/√/abs/π/e/x²/1÷x）
 *      与数字键盘（含 ⌫ / C / 括号 / 乘方 / 变量 x）
 *
 * 求值直接用与绘图同一套求值器（model/expr），所以键位上能按的，
 * 画出来和算出来的结果完全一致。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { compileExpr } from "../model/expr";
import { isFormulaShape } from "../model/formula";
import type { Shape } from "../model/types";
import { CloseIcon, DeleteIcon } from "../icons";

/** 函数键：显示 → 插入文本 */
const FN_KEYS: [string, string][] = [
  ["sin", "sin("], ["cos", "cos("], ["tan", "tan("],
  ["asin", "asin("], ["acos", "acos("], ["atan", "atan("],
  ["ln", "ln("], ["log", "log("], ["exp", "exp("],
  ["√", "sqrt("], ["abs", "abs("], ["|x|", "|x|"], ["x²", "^2"],
  ["π", "π"], ["e", "e"], ["°", "°"],
  ["rad", " rad"], ["1/x", "1/("],
];

/**
 * 主键盘：4 行 × 6 列。
 *
 * 从 5 列重排成 6 列，是为了把画方程要用的 `y` `=` `,` `t` 塞进来——
 * 仍然 4 行，面板高度不变；键位只是变窄一点，没有多占一屏。
 */
const PAD_KEYS: string[] = [
  "7", "8", "9", "÷", "(", ")",
  "4", "5", "6", "×", "⌫", "C",
  "1", "2", "3", "−", "x", "y",
  "0", ".", "=", "+", ",", "t",
];

const SYMBOL_MAP: Record<string, string> = { "÷": "/", "×": "*", "−": "-" };

/** 列表里显示什么：优先用原始公式，旧数据（无 source）退回表达式本身 */
function curveLabel(s: Shape): string {
  if (s.type === "function") return `f(x) = ${s.expr}`;
  if (s.type === "parametric") return `x=${s.xExpr}, y=${s.yExpr}`;
  if (s.type === "implicit") return `方程 ${s.source ?? s.expr}`;
  const src = "source" in s ? s.source : undefined;
  return src || (s.type === "circle" ? "圆（公式）" : "椭圆（公式）");
}

interface Props {
  /** 点「绘制」时调用，返回是否成功（成功才清空草稿） */
  onAdd: (expr: string) => { ok: boolean };
  /** 焦点进入/离开输入框（用于暂停自动高度，避免键盘导致反复 mn.fit） */
  onTypingChange?: (typing: boolean) => void;
  onClose: () => void;
  message: string;
  shapes: Shape[];
  onDeleteShape: (id: string) => void;
  /** 一键清除所有由函数面板绘制的曲线/图形 */
  onClearCurves: () => void;
}

/** 上一次拖动后的位置（相对画布左上角，模块级：跨挂载保留） */
let lastShift: { x: number; y: number } | null = null;

export function FunctionPad(props: Props) {
  const { onAdd, onTypingChange, onClose, message, shapes, onDeleteShape, onClearCurves } = props;
  // 草稿放在面板内部：每敲一个字只重渲染这个面板，
  // 不再牵动画布整棵树（之前逐字上抛状态，输入法下会明显卡顿）。
  const [expr, setExprState] = useState("");
  // 小窗：可拖动（仅顶部拖动浮条）、两档尺寸、函数 / 算式两种模式
  /** 面板位置：相对 CSS 锚点的位移。用 transform 而不是 left/top——
      拖动时只走合成层，不触发重排，才跟手 */
  // 位置存在模块级：面板切走再切回来会重新挂载，只用 state 的话会被重置回初始位置（看着像瞬移）
  const [pos, setPos] = useState<{ x: number; y: number } | null>(lastShift);
  const [compact, setCompact] = useState(false);
  /** 放不下时自动缩成紧凑版：内容高度超过可视高度的 88% 就缩 */
  const autoFit = useCallback(() => {
    const pad = padRef.current;
    const stage = pad?.parentElement;
    if (!pad || !stage) return;
    // 内容真的溢出才缩：scrollHeight > 可视高度
    if (pad.scrollHeight > pad.clientHeight + 2) setCompact(true);
  }, []);
  useEffect(() => {
    autoFit();
    const onResize = () => autoFit();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [autoFit]);
  const [mode, setMode] = useState<"fn" | "calc">("fn");
  const padRef = useRef<HTMLDivElement | null>(null);
  /** 拖动状态：起点、起始位移、允许的位移范围（保证整块始终留在画布内） */
  const barDrag = useRef<{
    px: number; py: number; x0: number; y0: number;
    minX: number; maxX: number; minY: number; maxY: number;
  } | null>(null);
  /** 拖动中最后一帧的位移（松手时用它提交，避免解析 transform 字符串） */
  /** 拖动期间挂在浮条上的原生触摸拦截的清理函数 */
  const barDragCleanup = useRef<(() => void) | null>(null);
  /** 拖动中最后一帧的坐标（松手时提交，避免再去解析样式） */
  const dragAt = useRef<{ x: number; y: number } | null>(null);

  const onBarDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    // 原生触摸拦截（与画布/缩放把手同款）：React 的 preventDefault 拦不住
    // WKWebView 宿主手势，不拦的话拖浮条会被宿主当成「拖动面板窗口」导致乱飘
    const bar = e.currentTarget;
    const stopTouch = (ev: Event) => ev.preventDefault();
    bar.addEventListener("touchstart", stopTouch, { passive: false });
    bar.addEventListener("touchmove", stopTouch, { passive: false });
    barDragCleanup.current = () => {
      bar.removeEventListener("touchstart", stopTouch);
      bar.removeEventListener("touchmove", stopTouch);
    };
    const pad = padRef.current;
    const stage = pad?.parentElement;
    if (!pad || !stage) return;
    const padBox = pad.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    // 用「画布内的绝对坐标」而不是位移差：两种形态（贴底 / 已拖走）起点都能算准，
    // 也不会被 left/right 的固定边距卡出一个拖不到的死区
    const x0 = padBox.left - stageBox.left;
    const y0 = padBox.top - stageBox.top;
    barDrag.current = {
      px: e.clientX, py: e.clientY, x0, y0,
      minX: 0,
      maxX: Math.max(0, stageBox.width - padBox.width),
      minY: 0,
      maxY: Math.max(0, stageBox.height - padBox.height),
    };
    // 立刻切成自由定位，之后全靠 left/top 走
    setPos({ x: x0, y: y0 });
    pad.style.setProperty("right", "auto");
    pad.style.setProperty("bottom", "auto");
    pad.style.setProperty("left", `${x0}px`);
    pad.style.setProperty("top", `${y0}px`);
    pad.style.setProperty("transform", "translate3d(0px, 0px, 0)");
  };

  /**
   * 拖动中直接写 DOM 的 transform，不走 setState：
   * 这个面板有 40 多个按键，每帧重渲染整棵树就是「不跟手」的根源。
   * 松手时才提交一次 state，重新渲染的结果与拖动中的最后一帧一致，不会跳。
   */
  const onBarDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = barDrag.current;
    const pad = padRef.current;
    if (!d || !pad) return;
    const x = Math.min(d.maxX, Math.max(d.minX, d.x0 + (e.clientX - d.px)));
    const y = Math.min(d.maxY, Math.max(d.minY, d.y0 + (e.clientY - d.py)));
    pad.style.setProperty("left", `${x}px`);
    pad.style.setProperty("top", `${y}px`);
    dragAt.current = { x, y };
  };

  const onBarDragEnd = () => {
    const d = barDrag.current;
    const pad = padRef.current;
    barDrag.current = null;
    barDragCleanup.current?.();
    barDragCleanup.current = null;
    if (!d || !pad) return;
    const next = dragAt.current;
    if (next) { lastShift = next; setPos(next); }
  };

  // 公式绘制的四类图形全部列出（含圆/椭圆方程），手画的圆椭圆不会被误收
  const curves = shapes.filter(isFormulaShape);

  // 输入法（尤其是中文/拼音）组字期间，DOM 里的文字不会进 React state。
  // 若此时因为键盘弹起触发一次重渲染，受控输入会把刚打的字抹掉——表现就是「打字没反应」。
  // 所以这里让 DOM 持有文字：只有主动改（按键/清空/绘制后重置）才写回，组字结束再同步。
  const inputRef = useRef<HTMLInputElement>(null);
  const composing = useRef(false);

  // 程序化修改：同时更新 state 与 DOM（DOM 与 state 始终一致，组字期间除外）
  const setExpr = (next: string) => {
    setExprState(next);
    if (inputRef.current) inputRef.current.value = next;
  };

  // 代入求值：x 取一个值，用同一套求值器算结果
  const [xValue, setXValue] = useState("1");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  /** 提交给画布：成功则清空草稿，失败保留以便修改 */
  const draw = () => {
    const res = onAdd(expr);
    if (res.ok) {
      setExpr("");
      setResult(null);
    }
  };

  /** 算式模式：不代入 x，直接求值四则/函数表达式 */
  const calcNow = () => {
    if (!expr.trim()) {
      setResult({ ok: false, text: "先输入算式，如 2+3×4" });
      return;
    }
    try {
      const value = compileExpr(expr)({ x: 0, t: 0, pi: Math.PI, e: Math.E });
      const text = Number.isFinite(value)
        ? `= ${Math.abs(value) >= 1e6 || (Math.abs(value) < 1e-4 && value !== 0) ? value.toExponential(6) : String(Math.round(value * 1e6) / 1e6)}`
        : "无法计算";
      setResult({ ok: Number.isFinite(value), text });
    } catch {
      setResult({ ok: false, text: "算式有误" });
    }
  };

  const evaluate = () => {
    const x = Number(xValue);
    if (!Number.isFinite(x)) {
      setResult({ ok: false, text: "x 需要一个数字" });
      return;
    }
    if (!expr.trim()) {
      setResult({ ok: false, text: "先输入表达式" });
      return;
    }
    try {
      const value = compileExpr(expr)({ x, t: x, pi: Math.PI, e: Math.E });
      if (!Number.isFinite(value)) {
        setResult({ ok: false, text: `f(${x}) 无定义` });
        return;
      }
      const rounded = Math.abs(value) >= 1e6 || (Math.abs(value) < 1e-4 && value !== 0)
        ? value.toExponential(4)
        : String(Math.round(value * 1e6) / 1e6);
      setResult({ ok: true, text: `f(${x}) = ${rounded}` });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : "表达式无法求值" });
    }
  };

  const pressPadKey = (key: string) => {
    if (key === "⌫") {
      setExpr(expr.slice(0, -1));
      return;
    }
    if (key === "C") {
      setExpr("");
      setResult(null);
      return;
    }
    setExpr(expr + (SYMBOL_MAP[key] ?? key));
  };

  return (
    <div
      className={`fnpad${compact ? " fnpad-compact" : ""}`}
      role="dialog"
      aria-label="函数输入"
      ref={padRef}
      style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
    >
      {/* 拖动浮条：按住这里移动面板 */}
      <div
        className="fnpad-dragbar"
        title="按住这里拖动，移动面板"
        onPointerDown={onBarDragStart}
        onPointerMove={onBarDragMove}
        onPointerUp={onBarDragEnd}
        onPointerCancel={onBarDragEnd}
        // iOS 上双击浮条会把整个 webview 放大（看着像「一点就自动缩放」），这里直接吃掉
        onDoubleClick={(e) => e.preventDefault()}
      />
      <div className="fnpad-head" title="面板工具：切换模式 / 缩放 / 退格 / 收起">
        <b>{mode === "fn" ? "函数" : "计算器"}</b>
        <div className="fnpad-head-right">
          <div className="seg small" role="group" aria-label="面板模式" onPointerDown={(e) => e.stopPropagation()}>
            <button className={mode === "fn" ? "on" : ""} onClick={() => setMode("fn")}>函数</button>
            <button className={mode === "calc" ? "on" : ""} onClick={() => setMode("calc")}>算式</button>
          </div>
          <button type="button" className="fnpad-quick-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => setCompact((v) => !v)} aria-label="切换面板大小" title="放大 / 缩小面板">
            ⤢
          </button>
          <button type="button" className="fnpad-quick-btn" onPointerDown={(e) => e.stopPropagation()} onClick={() => setExpr(expr.slice(0, -1))} aria-label="退格">
            <DeleteIcon size={16} />
          </button>
          <button type="button" className="drawer-close" onPointerDown={(e) => e.stopPropagation()} onClick={onClose} aria-label="收起函数面板">
            <CloseIcon size={14} />
          </button>
        </div>
      </div>

      {curves.length > 0 ? (
        <div className="fnpad-curves">
          <div className="fnpad-curves-head">
            <span>已绘制 {curves.length} 条</span>
            <button type="button" className="fnpad-clear" onClick={onClearCurves}>
              清除全部函数
            </button>
          </div>
          <div className="fnpad-list">
            {curves.map((s, i) => (
              <div key={s.id} className="fnpad-item">
                <span className="fnpad-index">{i + 1}</span>
                <code className="fnpad-expr">{curveLabel(s)}</code>
                <button
                  type="button"
                  className="fnpad-del"
                  onClick={() => onDeleteShape(s.id)}
                  aria-label={`删除 ${curveLabel(s)}`}
                  title="删除这条"
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="fnpad-empty">
          函数：sin(x)+x/2 · 方程：x^2+y^2=1、xy=1 · 参数方程：x=cos(t),y=sin(t) · 极坐标：r=1+cos(t)
          <br />三角函数用弧度，写角度加 °（如 tan60°）
        </p>
      )}

      {/* 单行工具条：标签/输入/求值/绘制全部固定高度，永不换行 */}
      <div className="fnbar">
        <span className="fnbar-label">f(x)</span>
        <input
          ref={inputRef}
          className="fnbar-field"
          defaultValue={expr}
          onInput={(e) => setExprState(e.currentTarget.value)}
          onFocus={() => onTypingChange?.(true)}
          onBlur={() => onTypingChange?.(false)}
          onCompositionStart={() => { composing.current = true; }}
          onCompositionEnd={(e) => {
            composing.current = false;
            setExprState(e.currentTarget.value);
          }}
          onKeyDown={(e) => e.key === "Enter" && draw()}
          placeholder="sin(x)+x/2 或 xy=1"
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="done"
        />
        {mode === "calc" ? null : (
          <>
            <span className="fnbar-label">x</span>
        <input
          className="fnbar-x"
          value={xValue}
          onChange={(e) => setXValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && evaluate()}
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="代入的 x 值"
        />
          </>
        )}
        {mode === "calc" ? null : (
          <button type="button" className="fnbar-eq" onClick={evaluate} aria-label="求值" title="代入 x 求值">求值</button>
        )}
        <button
          type="button"
          className="primary fnbar-draw"
          onClick={mode === "calc" ? calcNow : draw}
        >{mode === "calc" ? "=" : "绘制"}</button>
      </div>

      {/* 结果行：高度固定，没有结果时显示占位文字，避免出现时撑高 */}
      <p className={`fnbar-result${result && !result.ok ? " bad" : ""}`}>
        {result ? result.text : mode === "calc" ? "输入算式后按 = 计算" : "代入 x 后按 = 求值"}
      </p>

      {message ? <p className="error fnpad-error">{message}</p> : null}

      <div className="fnpad-fnkeys">
        {FN_KEYS.map(([label, token]) => (
          <button key={label} type="button" className="fnpad-fnkey" onClick={() => setExpr(expr + token)}>
            {label}
          </button>
        ))}
      </div>

      <div className="fnpad-keys">
        {PAD_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            className={`fnpad-key${SYMBOL_MAP[key] ? " op" : ""}${key === "x" || key === "y" || key === "t" ? " var" : ""}${key === "C" ? " danger" : ""}`}
            onClick={() => pressPadKey(key)}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
