/**
 * 可手输的数值框：编辑中保留草稿，失焦或回车才提交。
 * 立体参数与二维几何参数共用——滑块只能粗调，精确值还是要靠输入。
 */
import { useState } from "react";

interface Props {
  value: number;
  step?: number;
  decimals?: number;
  min?: number;
  max?: number;
  onCommit: (value: number) => void;
  ariaLabel?: string;
}

export function ParamNumber({ value, step = 1, decimals = 1, min, max, onCommit, ariaLabel }: Props) {
  const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(decimals) : "0");
  const [text, setText] = useState(() => fmt(value));
  const [editing, setEditing] = useState(false);

  // 外部值变化（拖滑块）时跟着走，但正在输入时不打断。
  // 用渲染期对比代替 effect，避免「effect 内同步 setState」导致的级联渲染
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (!editing) setText(fmt(value));
  }

  const commit = (raw: string) => {
    const n = Number(raw.trim());
    if (!Number.isFinite(n)) { setText(fmt(value)); return; }
    let v = n;
    if (min !== undefined) v = Math.max(min, v);
    if (max !== undefined) v = Math.min(max, v);
    setText(fmt(v));
    if (Math.abs(v - value) > 1e-9) onCommit(v);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className="param-num"
      aria-label={ariaLabel}
      value={text}
      onFocus={(e) => { setEditing(true); e.currentTarget.select(); }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => { setEditing(false); commit(text); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.currentTarget.blur(); }
        if (e.key === "ArrowUp") { e.preventDefault(); commit(String(Number(text) + step)); }
        if (e.key === "ArrowDown") { e.preventDefault(); commit(String(Number(text) - step)); }
      }}
    />
  );
}
