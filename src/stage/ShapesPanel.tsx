/* eslint-disable no-restricted-syntax -- 浮层位置是运行时算出来的，只能用内联 style */
/**
 * 图形清单浮层：从顶栏的「图形」按钮弹出。
 * 与「历史记录」分开——历史是按步骤回退，这里是管理画布上已有的图形（选中 / 隐藏 / 删除）。
 */
import type { Shape } from "../model/types";
import type { CSSProperties } from "react";

import { CloseIcon } from "../icons";
import { ShapeList } from "./ShapeList";
import { popoverStyle } from "./popoverStyle";

interface Props {
  anchor: { left: number; top: number; width: number; height: number } | null;
  shapes: Shape[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeleteShape: (id: string) => void;
  onToggleDashed: (id: string) => void;
  onToggleImageLock: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onClose: () => void;
}

export function ShapesPanel(p: Props) {
  // 尽量一次多显示几条：高度按面板可用空间给足，超出的在列表里上下滚
  const style = popoverStyle(p.anchor, { width: 360, maxHeight: 9999, minHeight: 320 }) as CSSProperties | undefined;
  const visible = p.shapes.filter((s) => !("hidden" in s) || !s.hidden).length;
  return (
    <aside className="drawer shapes-panel" aria-label="图形清单" style={style}>
      <div className="drawer-head">
        <b>图形 {p.shapes.length > 0 ? <em>{visible}/{p.shapes.length}</em> : null}</b>
        <button type="button" className="drawer-close" onClick={p.onClose} aria-label="关闭图形清单">
          <CloseIcon size={14} />
        </button>
      </div>
      <div className="drawer-body">
        <ShapeList
          shapes={p.shapes}
          selectedId={p.selectedId}
          onSelect={p.onSelect}
          onDeleteShape={p.onDeleteShape}
          onToggleDashed={p.onToggleDashed}
          onToggleImageLock={p.onToggleImageLock}
          onToggleHidden={p.onToggleHidden}
        />
        <p className="drawer-hint">眼睛＝隐藏（不显示、不可选、不导出）；虚线按钮切换线型</p>
      </div>
    </aside>
  );
}
