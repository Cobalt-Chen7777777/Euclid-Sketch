/**
 * 图片调整动作：放大/缩小、默认大小、按真实比例校正。
 * 集中在这里，App 只负责传入状态与 toast。
 */
import { useCallback } from "react";

import type { Viewport } from "./canvas/viewport";
import { fitImageInList, normalizeImageById, resizeImageInList } from "./canvas/imageOps";
import type { Shape } from "./model/types";

export function useImageActions(
  shapes: Shape[],
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>,
  viewport: Viewport,
  showToast: (msg: string) => void,
) {
  const onResizeImage = useCallback((id: string, factor: number) => {
    setShapes((prev) => resizeImageInList(prev, id, factor));
  }, [setShapes]);

  const onFitImage = useCallback((id: string) => {
    const targetW = Math.min((viewport.xRange[1] - viewport.xRange[0]) / 2, 6);
    setShapes((prev) => fitImageInList(prev, id, targetW));
  }, [setShapes, viewport]);

  const onNormalizeImage = useCallback(async (id: string) => {
    setShapes(await normalizeImageById(shapes, id));
    showToast("已按图片真实比例校正");
  }, [shapes, setShapes, showToast]);

  return { onResizeImage, onFitImage, onNormalizeImage };
}
