/**
 * 3D 舞台：模型库 + 参数滑块 + Three.js 画布。
 * 与 2D 画布共用同一块「舞台」区域，切换时不改变窗口布局。
 */
import { useState } from "react";

import type { SolidKind, SolidShape } from "../model/types";
import { SolidView, type SolidMode } from "../solid/SolidView";
import { ParamNumber } from "./ParamNumber";
import { SOLID_LIBRARY } from "../solid/solids";

interface Props {
  solid: SolidShape | null;
  dark?: boolean;
  onPick: (kind: SolidKind) => void;
  onParam: (key: string, value: number) => void;
  onReady: (capture: () => string) => void;
  /** 导出当前 3D 视图为 PNG */
  onExportPng?: () => void;
}

export function SolidStage({ solid, onPick, onParam, onReady, dark = false, onExportPng }: Props) {
  const meta = solid ? SOLID_LIBRARY.find((m) => m.kind === solid.kind) : null;
  // 半透明（默认，能看见背面结构）/ 实体（隐藏棱用虚线）
  const [mode, setMode] = useState<SolidMode>("ghost");
  const [resetSignal, setResetSignal] = useState(0);

  return (
    <div className="stage-scroll">
      <div className="solid-models">
        {SOLID_LIBRARY.map((m) => (
          <button
            key={m.kind}
            type="button"
            className={`solid-card${solid?.kind === m.kind ? " active" : ""}`}
            onClick={() => onPick(m.kind)}
          >
            <span className="solid-icon">{m.icon}</span>
            <span>{m.name}</span>
          </button>
        ))}
      </div>

      {solid && meta ? (
        <>
          <div className="solid-toolbar">
            <div className="seg small" role="group" aria-label="显示方式">
              <button className={mode === "ghost" ? "on" : ""} onClick={() => setMode("ghost")}>透明</button>
              <button className={mode === "solid" ? "on" : ""} onClick={() => setMode("solid")}>实体</button>
            </div>
            <button type="button" className="chip" onClick={() => setResetSignal((n) => n + 1)}>复位视角</button>
            {onExportPng ? (
              <button type="button" className="chip" onClick={onExportPng}>导出 PNG</button>
            ) : null}
          </div>
          <SolidView
            solid={solid}
            height="auto"
            editable
            onParam={(key, value) => onParam(key, value)}
            onReady={onReady}
            mode={mode}
            resetSignal={resetSignal}
            dark={dark}
          />
          <div className="params">
            {meta.params.map((p) => (
              <label key={p.key} className="param-row">
                <span>{p.label}</span>
                <input
                  type="range" min={p.min} max={p.max} step={p.step}
                  value={solid.params[p.key] ?? p.default}
                  onChange={(e) => onParam(p.key, Number(e.target.value))}
                />
                <ParamNumber
                  value={solid.params[p.key] ?? p.default}
                  step={p.step}
                  decimals={p.step < 1 ? 2 : 1}
                  min={p.min}
                  max={p.max}
                  ariaLabel={p.label}
                  onCommit={(v) => onParam(p.key, v)}
                />
              </label>
            ))}
          </div>
          <p className="hint">单指拖动旋转 · 双指缩放/平移</p>
        </>
      ) : (
        <p className="empty">选择一个立体模型开始构图</p>
      )}
    </div>
  );
}
