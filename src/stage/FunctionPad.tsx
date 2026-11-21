/* eslint-disable no-restricted-syntax -- 小窗拖动位置必须动态 style */
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
import { useRef, useState } from "react";

import { compileExpr } from "../model/expr";
import { isFormulaShape } from "../model/formula";
import type { Shape } from "../model/types";
import { CloseIcon, DeleteIcon } from "../icons";

/** 函数键：显示 → 插入文本 */
const FN_KEYS: [string, string][] = [
  ["sin", "sin("], ["cos", "cos("], ["tan", "tan("],
  ["asin", "asin("], ["acos", "acos("], ["atan", "atan("],
  ["ln", "ln("], ["log", "log("], ["exp", "exp("],
  ["√", "sqrt("], ["abs", "abs("], ["x²", "^2"],
  ["π", "π"], ["e", "e"], ["1/x", "1/("],
];

/** 主键盘：4 行 × 5 列 */
const PAD_KEYS: string[] = [
  "7", "8", "9", "÷", "⌫",
  "4", "5", "6", "×", "C",
  "1", "2", "3", "−", "(",
  "0", ".", "x", "+", ")",
];

const SYMBOL_MAP: Record<string, string> = { "÷": "/", "×": "*", "−": "-" };

/** 列表里显示什么：优先用原始公式，旧数据（无 source）退回表达式本身 */
function curveLabel(s: Shape): string {
  if (s.type === "function") return `f(x) = ${s.expr}`;
  if (s.type === "parametric") return `x=${s.xExpr}, y=${s.yExpr}`;
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

export function FunctionPad(props: Props) {
  const { onAdd, onTypingChange, onClose, message, shapes, onDeleteShape, onClearCurves } = props;
  // 草稿放在面板内部：每敲一个字只重渲染这个面板，
  // 不再牵动画布整棵树（之前逐字上抛状态，输入法下会明显卡顿）。
  const [expr, setExprState] = useState("");
  // 小窗：可拖动（仅顶部拖动浮条）、两档尺寸、函数 / 算式两种模式
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [compact, setCompact] = useState(false);
  const [mode, setMode] = useState<"fn" | "calc">("fn");
  /** 拖动浮条：按住它才能移动面板（真机验证：整面板任意处拖动会被 MN 宿主手势干扰，不灵敏） */
  const barDrag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  /** 拖动期间挂在浮条上的原生触摸拦截的清理函数 */
  const barDragCleanup = useRef<(() => void) | null>(null);
  /** rAF 节流：最新的指针位置与动画帧句柄 */
  const barLast = useRef<{ x: number; y: number } | null>(null);
  const barRaf = useRef<number | null>(null);
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
    // 起点 = 面板相对定位父级（.stage）的偏移。不能用视口 rect：
    // style.left/top 是相对 .stage 的，用视口坐标会把 header 高度算进去，首次拖动整块跳变
    const panel = (e.currentTarget.closest(".fnpad") as HTMLElement | null) ?? e.currentTarget;
    barDrag.current = { px: e.clientX, py: e.clientY, ox: panel.offsetLeft, oy: panel.offsetTop };
    barLast.current = null;
    if (barRaf.current != null) {
      cancelAnimationFrame(barRaf.current);
      barRaf.current = null;
    }
  };
  const onBarDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = barDrag.current;
    if (!d) return;
    // rAF 节流：拖动帧合并到下一帧渲染，避免高频 setState 拖累整棵树
    if (barRaf.current == null) {
      barRaf.current = requestAnimationFrame(() => {
        barRaf.current = null;
        const cur = barDrag.current;
        if (!cur || barLast.current == null) return;
        setPos({
          x: cur.ox + barLast.current.x - cur.px,
          y: Math.max(4, cur.oy + barLast.current.y - cur.py),
        });
      });
    }
    barLast.current = { x: e.clientX, y: e.clientY };
  };
  const onBarDragEnd = () => {
    barDrag.current = null;
    barLast.current = null;
    if (barRaf.current != null) {
      cancelAnimationFrame(barRaf.current);
      barRaf.current = null;
    }
    barDragCleanup.current?.();
    barDragCleanup.current = null;
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
      style={pos ? { left: pos.x, top: pos.y, bottom: "auto", right: "auto" } : undefined}
    >
      {/* 拖动浮条：按住这里移动面板 */}
      <div
        className="fnpad-dragbar"
        title="按住这里拖动，移动面板"
        onPointerDown={onBarDragStart}
        onPointerMove={onBarDragMove}
        onPointerUp={onBarDragEnd}
        onPointerCancel={onBarDragEnd}
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
        <p className="fnpad-empty">输入表达式后点「绘制」· 三角函数用弧度，写角度加 °（如 tan60°）</p>
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
          placeholder="sin(x)+x/2"
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
          <button type="button" className="fnbar-eq" onClick={evaluate} aria-label="求值">=</button>
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
            className={`fnpad-key${SYMBOL_MAP[key] ? " op" : ""}${key === "x" ? " var" : ""}${key === "C" ? " danger" : ""}`}
            onClick={() => pressPadKey(key)}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
}
