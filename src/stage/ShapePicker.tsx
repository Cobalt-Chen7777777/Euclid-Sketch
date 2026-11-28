/* eslint-disable no-restricted-syntax -- 浮层位置是运行时算出来的，只能用内联 style */
/**
 * 图形选择器：点工具栏「全部图形」弹出的小窗，只负责挑一个图形类型。
 * 之前是打开整个「绘图选项」抽屉，参数、图层、颜色全跟着出来，挑个图形很费劲。
 */
import type { CSSProperties } from "react";
import type { PrimitiveType } from "../model/types";

import { CloseIcon } from "../icons";
import { popoverStyle } from "./popoverStyle";
import { PRIMITIVES } from "./primitives";

interface Props {
  anchor: { left: number; top: number; width: number; height: number } | null;
  current: PrimitiveType;
  onPick: (t: PrimitiveType) => void;
  onClose: () => void;
}

export function ShapePicker({ anchor, current, onPick, onClose }: Props) {
  if (!anchor) return null;
  const style = popoverStyle(anchor, { width: 300, maxHeight: 480 }) as CSSProperties | undefined;
  return (
    <aside className="drawer shape-picker" aria-label="选择图形" style={style}>
      <div className="drawer-head">
        <b>选择图形</b>
        <button type="button" className="drawer-close" onClick={onClose} aria-label="关闭图形选择">
          <CloseIcon size={14} />
        </button>
      </div>
      <div className="drawer-body">
        <div className="chips">
          {PRIMITIVES.map(([t, label]) => (
            <button
              key={t}
              type="button"
              className={`chip${current === t ? " on" : ""}`}
              onClick={() => { onPick(t); onClose(); }}
            >{label}</button>
          ))}
        </div>
        <p className="drawer-hint">选好直接在画布上拖动即可画出；也可以点图形图标再打开「绘图选项」按参数创建</p>
      </div>
    </aside>
  );
}
