/**
 * 图形清单浮层：开关状态 + 「隐藏 / 显示某个图形」。
 * 从 App 里抽出来，免得主入口被浮层细节撑长。
 */
import { useCallback, useState } from "react";

import type { Shape } from "./model/types";

export function useShapesPanel(
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>,
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>,
) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const openAt = useCallback((rect: DOMRect) => {
    setAnchor(rect);
    setOpen(true);
  }, []);

  /** 隐藏 / 显示某个图形：不删除，只是不渲染、不可选、不导出 */
  const onToggleHidden = useCallback((id: string) => {
    setShapes((prev) => prev.map((x) => (x.id === id ? ({ ...x, hidden: !x.hidden } as typeof x) : x)));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, [setShapes, setSelectedId]);

  return { shapesOpen: open, shapesAnchor: anchor, openShapes: openAt, closeShapes: () => setOpen(false), onToggleHidden };
}
