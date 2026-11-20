/**
 * 图层操作：从 shapes 聚合图层、整层隐藏/锁定、新建图层、把选中图形移到某层。
 * 图层元数据不单独存：全部落在各图形的 layer / hidden / locked 字段上。
 */
import { useCallback, useMemo } from "react";

import { layerIds, layerStats, moveToLayer, nextLayer, setLayerFlag } from "./model/layers";
import type { Shape } from "./model/types";

export interface LayerRow {
  id: number;
  count: number;
  hidden: boolean;
  locked: boolean;
}

export function useLayers(
  shapes: Shape[],
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>,
  currentLayer: number,
  setCurrentLayer: (layer: number) => void,
) {
  const rows: LayerRow[] = useMemo(
    () => layerIds(shapes).map((id) => ({ id, ...layerStats(shapes, id) })),
    [shapes],
  );

  const toggleHidden = useCallback((layer: number) => {
    setShapes((prev) => {
      const stats = layerStats(prev, layer);
      return setLayerFlag(prev, layer, { hidden: !stats.hidden });
    });
  }, [setShapes]);

  const toggleLocked = useCallback((layer: number) => {
    setShapes((prev) => {
      const stats = layerStats(prev, layer);
      return setLayerFlag(prev, layer, { locked: !stats.locked });
    });
  }, [setShapes]);

  /** 新建图层并切为当前绘制层 */
  const addLayer = useCallback(() => {
    setShapes((prev) => {
      const id = nextLayer(prev);
      setCurrentLayer(id);
      return prev;
    });
  }, [setShapes, setCurrentLayer]);

  /** 把选中图形移到指定图层 */
  const moveSelected = useCallback((ids: string[], layer: number) => {
    if (ids.length === 0) return;
    setShapes((prev) => moveToLayer(prev, ids, layer));
    setCurrentLayer(layer);
  }, [setShapes, setCurrentLayer]);

  return { rows, toggleHidden, toggleLocked, addLayer, moveSelected };
}
