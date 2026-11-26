/**
 * 卡片图插入（含选区裁剪）：
 * MN 的渲染接口只能出整张长图（参数只有 format / width），
 * 「只插入题目区」只能在拿到图之后本地区域裁剪，所以这里把
 * 「渲染结果 → 选区弹窗 → 裁剪 → 进画布」串成一条。
 */
import { useCallback, useState } from "react";

import { cropImageToDataUrl, imageSrcToShape } from "./model/image";
import type { CropRect } from "./stage/CropDialog";
import type { Shape } from "./model/types";
import type { Viewport } from "./canvas/viewport";
import { zoomToBox } from "./canvas/viewport";

interface Options {
  viewport: Viewport;
  color: string;
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  setSelectedId: (id: string | null) => void;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  showToast: (msg: string) => void;
  /** 插入大小系数（设置里的「插入大小」） */
  insertScale: number;
}

export function useCardCropInsert(o: Options) {
  const { viewport, color, shapes, setShapes, setSelectedId, setViewport, showToast, insertScale } = o;
  /** 待裁剪的卡片图；非空时画布上显示选区弹窗 */
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  /** 把一张卡片图（整张或已裁好的）插进画布 */
  const insertCardImage = useCallback(async (src: string, reuseSrc: boolean) => {
    const shape = await imageSrcToShape(src, viewport, color, reuseSrc, shapes, 0, insertScale);
    setShapes((prev) => [...prev, shape]);
    setSelectedId(shape.id);
    setViewport((vp) => zoomToBox(vp, shape));
    showToast("已插入卡片图；卡片上若残留草图批注文字会一并显示，可在 MN 里删除该批注");
  }, [viewport, color, shapes, setShapes, setSelectedId, setViewport, insertScale, showToast]);

  /** 选区确认：rect 为 null 表示整张插入 */
  const onCropConfirm = useCallback(async (rect: CropRect | null) => {
    const src = cropSrc;
    setCropSrc(null);
    if (!src) return;
    try {
      const final = rect ? await cropImageToDataUrl(src, rect) : src;
      await insertCardImage(final, !rect);
    } catch (e) {
      showToast(`插入失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  }, [cropSrc, insertCardImage, showToast]);

  return { cropSrc, setCropSrc, insertCardImage, onCropConfirm };
}
