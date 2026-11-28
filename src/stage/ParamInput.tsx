/**
 * 参数输入框：文本型输入 + 失焦 / 回车提交，空串与非法值回填原值。
 *
 * 旧实现是 type=number + 逐字提交：想把数字删掉重输时，每按一次退格都会把中间值
 * 写进图形（图形跟着跳变），iOS 的 number 键盘还常常吞掉退格。现在允许清空，
 * 空串 / 非法值直接回填原值，不会误改图形。
 */
import { useState } from "react";

export function ParamInput({ value, step, onCommit, positive = true }: {
  value: number;
  step: string;
  onCommit: (n: number) => void;
  /** 尺寸类参数必须为正；坐标可以负 */
  positive?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    setDraft(null);
    const n = Number(raw.trim());
    if (raw.trim() === "" || !Number.isFinite(n) || (positive && n <= 0)) return;
    // 与显示精度一致（两位小数），避免「输入 3.333 看到 3.33 实际存 3.333」
    onCommit(Math.round(n * 100) / 100);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft ?? value.toFixed(2)}
      onFocus={(e) => { setDraft(e.currentTarget.value); e.currentTarget.select(); }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.currentTarget.blur(); return; }
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const base = Number((draft ?? value.toFixed(2)).trim());
        if (!Number.isFinite(base)) return;
        const delta = Number(step) || 1;
        const next = base + (e.key === "ArrowUp" ? delta : -delta);
        if (positive && next <= 0) return;
        setDraft(next.toFixed(2));
        onCommit(Math.round(next * 100) / 100);
      }}
    />
  );
}
