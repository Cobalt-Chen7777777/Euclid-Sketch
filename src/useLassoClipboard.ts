/**
 * 套索多选与剪贴板：框选 → 复制 / 剪切 / 粘贴 / 删除。
 * 剪贴板保存在面板会话内（切换 2D/3D 页不丢，刷新后清空）。
 */
import { useCallback, useState } from "react";

import { shiftShape } from "./model/lasso";
import type { Shape } from "./model/types";

export function useLassoClipboard(
  shapes: Shape[],
  setShapes: (updater: (prev: Shape[]) => Shape[]) => void,
  showToast: (msg: string) => void,
) {
  const [selectionIds, setSelectionIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<Shape[]>([]);

  const copy = useCallback(() => {
    const picked = shapes.filter((s) => selectionIds.includes(s.id));
    if (picked.length === 0) return;
    setClipboard(picked);
    showToast(`已复制 ${picked.length} 个图形`);
  }, [shapes, selectionIds, showToast]);

  const erasePicked = useCallback(() => {
    const ids = new Set(selectionIds);
    if (ids.size === 0) return;
    setShapes((prev) => prev.filter((s) => !ids.has(s.id)));
    setSelectionIds([]);
    showToast(`已删除 ${ids.size} 个图形`);
  }, [selectionIds, setShapes, showToast]);

  const cut = useCallback(() => {
    copy();
    erasePicked();
  }, [copy, erasePicked]);

  const paste = useCallback(() => {
    if (clipboard.length === 0) {
      showToast("剪贴板是空的，先框选并复制");
      return;
    }
    const cloned = clipboard.map((s, i) => shiftShape(s, 0.8 + i * 0.25, 0.8));
    setShapes((prev) => [...prev, ...cloned]);
    setSelectionIds(cloned.map((s) => s.id));
    showToast(`已粘贴 ${cloned.length} 个图形`);
  }, [clipboard, setShapes, showToast]);

  const clear = useCallback(() => setSelectionIds([]), []);

  return { selectionIds, setSelectionIds, clipboard, copy, cut, paste, erasePicked, clear };
}
