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
import { useState } from "react";

import { compileExpr } from "../model/expr";
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

interface Props {
  expr: string;
  onExpr: (value: string) => void;
  onAppend: (token: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onAdd: () => void;
  onClose: () => void;
  message: string;
  shapes: Shape[];
  onDeleteShape: (id: string) => void;
}

export function FunctionPad(props: Props) {
  const { expr, onExpr, onAppend, onBackspace, onClear, onAdd, onClose, message, shapes, onDeleteShape } = props;
  const curves = shapes.filter((s) => s.type === "function" || s.type === "parametric");

  // 代入求值：x 取一个值，用同一套求值器算结果
  const [xValue, setXValue] = useState("1");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

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
      onBackspace();
      return;
    }
    if (key === "C") {
      onClear();
      setResult(null);
      return;
    }
    onAppend(SYMBOL_MAP[key] ?? key);
  };

  return (
    <div className="fnpad" role="dialog" aria-label="函数输入">
      <div className="fnpad-head">
        <b>函数</b>
        <div className="fnpad-head-right">
          <button type="button" className="fnpad-quick-btn" onClick={onBackspace} aria-label="退格">
            <DeleteIcon size={16} />
          </button>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="收起函数面板">
            <CloseIcon size={14} />
          </button>
        </div>
      </div>

      {curves.length > 0 ? (
        <div className="fnpad-list">
          {curves.map((s, i) => (
            <div key={s.id} className="fnpad-item">
              <span className="fnpad-index">{i + 1}</span>
              <code className="fnpad-expr">
                {s.type === "function" ? `y = ${s.expr}` : s.type === "parametric" ? `x=${s.xExpr}, y=${s.yExpr}` : ""}
              </code>
              <button type="button" onClick={() => onDeleteShape(s.id)} aria-label="删除曲线">✕</button>
            </div>
          ))}
        </div>
      ) : (
        <p className="fnpad-empty">还没有曲线。输入表达式后点「绘制」，例如 <code>sin(x)</code>。</p>
      )}

      <div className="fnpad-input">
        <span className="fnpad-eq">y =</span>
        <input
          className="fnpad-field"
          value={expr}
          onChange={(e) => onExpr(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="sin(x) + x/2"
          inputMode="text"
          spellCheck={false}
        />
        <button type="button" className="primary fnpad-draw" onClick={onAdd}>绘制</button>
      </div>

      {/* 代入求值 */}
      <div className="fnpad-eval">
        <span className="fnpad-eval-label">x =</span>
        <input
          className="fnpad-eval-field"
          value={xValue}
          onChange={(e) => setXValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && evaluate()}
          inputMode="decimal"
          aria-label="代入的 x 值"
        />
        <button type="button" className="fnpad-eq-btn" onClick={evaluate} aria-label="求值">=</button>
        <output className={`fnpad-result${result && !result.ok ? " bad" : ""}`}>
          {result ? result.text : "代入后按 = 求值"}
        </output>
      </div>

      {message ? <p className="error fnpad-error">{message}</p> : null}

      <div className="fnpad-fnkeys">
        {FN_KEYS.map(([label, token]) => (
          <button key={label} type="button" className="fnpad-fnkey" onClick={() => onAppend(token)}>
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
