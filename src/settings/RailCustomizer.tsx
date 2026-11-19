/* eslint-disable no-restricted-globals, no-restricted-syntax -- 拖动排序需要命中检测与临时定位，不触碰页面样式规则 */
/**
 * 工具栏自定义器：
 *   1. 方案：一键切换整组按钮组合，可把当前组合保存为新方案、可删除
 *   2. 显示/隐藏：点选按钮池（「选择」始终显示）
 *   3. 排序：长按已选按钮 300ms 进入拖动，移动到目标位置交换，松手落位
 */
import { useRef, useState } from "react";

import { RAIL_CATALOG } from "./model";

interface Preset { name: string; tools: string[] }

interface Props {
  railTools: string[];
  railPresets: Preset[];
  onChange: (patch: { railTools?: string[]; railPresets?: { name: string; tools: string[] }[] }) => void;
}

const LABELS = new Map(RAIL_CATALOG.map((c) => [c.id, c.label]));
const labelOf = (id: string): string => LABELS.get(id) ?? id;
const MAX_PRESETS = 6;

export function RailCustomizer({ railTools, railPresets, onChange }: Props) {
  // 拖动状态：拖动中的工具 id
  const [dragging, setDragging] = useState<string | null>(null);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startHold = (id: string, e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    holdTimer.current = setTimeout(() => setDragging(id), 300);
  };
  const cancelHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    setDragging(null);
  };

  /** 拖动中：指针命中的 chip 与拖动 chip 交换位置 */
  const onDragMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest("button[data-tool]");
    const target = el?.getAttribute("data-tool");
    if (!target || target === dragging || !railTools.includes(target)) return;
    const from = railTools.indexOf(dragging);
    const to = railTools.indexOf(target);
    if (from < 0 || to < 0) return;
    const next = [...railTools];
    next.splice(from, 1);
    next.splice(to, 0, dragging);
    onChange({ railTools: next });
  };

  const toggleTool = (id: string) => {
    if (id === "select") return;
    const next = railTools.includes(id)
      ? railTools.filter((x) => x !== id)
      : [...railTools, id];
    onChange({ railTools: next.length > 0 ? next : ["select"] });
  };

  const savePreset = () => {
    if (railPresets.length >= MAX_PRESETS) return;
    onChange({ railPresets: [...railPresets, { name: `方案 ${railPresets.length + 1}`, tools: railTools }] });
  };
  const removePreset = (name: string) => {
    onChange({ railPresets: railPresets.filter((p) => p.name !== name) });
  };
  const isPresetActive = (p: Preset): boolean =>
    p.tools.length === railTools.length && p.tools.every((t, i) => railTools[i] === t);

  const pool = RAIL_CATALOG.filter((c) => c.id === "select" || !railTools.includes(c.id));

  return (
    <div className="rail-customizer">
      {/* 方案 */}
      <span className="rail-pick-label">方案 · 点选切换，当前组合可保存</span>
      <div className="chips">
        {railPresets.map((p) => (
          <span key={p.name} className="preset-wrap">
            <button
              type="button"
              className={`chip${isPresetActive(p) ? " on" : ""}`}
              onClick={() => onChange({ railTools: p.tools })}
            >
              {p.name}
            </button>
            <button
              type="button"
              className="preset-del"
              aria-label={`删除方案 ${p.name}`}
              title="删除该方案"
              onClick={() => removePreset(p.name)}
            >×</button>
          </span>
        ))}
        {railPresets.length < MAX_PRESETS ? (
          <button type="button" className="chip preset-save" onClick={savePreset}>保存当前</button>
        ) : null}
      </div>

      {/* 显示 / 隐藏 / 排序 */}
      <span className="rail-pick-label">
        已选按钮 · 长按拖动排序，点选移除（「选择」始终显示）
      </span>
      <div className="chips">
        {railTools.map((id) => (
          <button
            key={id}
            type="button"
            data-tool={id}
            className={`chip${dragging === id ? " dragging" : ""}`}
            aria-label={labelOf(id)}
            onPointerDown={(e) => { if (id !== "select") startHold(id, e); }}
            onPointerMove={onDragMove}
            onPointerUp={cancelHold}
            onPointerCancel={cancelHold}
            onClick={() => { if (!dragging) toggleTool(id); }}
          >
            {labelOf(id)}
          </button>
        ))}
      </div>
      {pool.length > 0 ? (
        <>
          <span className="rail-pick-label">可添加</span>
          <div className="chips">
            {pool.map((c) => (
              <button key={c.id} type="button" className="chip ghost" onClick={() => toggleTool(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
