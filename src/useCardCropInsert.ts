/**
 * 卡片图插入（含选区裁剪）：
 * MN 的渲染接口只能出整张长图（参数只有 format / width），
 * 「只插入题目区」只能在拿到图之后本地区域裁剪，所以这里把
 * 「渲染结果 → 选区弹窗 → 裁剪 → 进画布」串成一条。
 */
import { useCallback, useState } from "react";

import { blobToImageShape, cropImageToBlob, fileToImageShape, imageSrcToShape } from "./model/image";
import { renderCardImage } from "./bridge";
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
  /** 卡片渲染流程需要的回调 */
  targetCard: string;
  refreshContext: () => Promise<string | null>;
  lockTarget: (noteid: string) => void;
  /** 插入卡片图时是否弹选区 */
  askCardCrop: boolean;
}

export function useCardCropInsert(o: Options) {
  const { viewport, color, shapes, setShapes, setSelectedId, setViewport, showToast, insertScale,
    targetCard, refreshContext, lockTarget, askCardCrop } = o;
  /** 待裁剪的卡片图；非空时画布上显示选区弹窗 */
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  /** 把一张卡片图（整张或已裁好的）插进画布 */
  const insertCardImage = useCallback(async (src: string) => {
    const shape = await imageSrcToShape(src, viewport, color, shapes, 0, insertScale);
    setShapes((prev) => [...prev, shape]);
    setSelectedId(shape.id);
    setViewport((vp) => zoomToBox(vp, shape));
    showToast("已插入卡片图；卡片上若残留草图批注文字会一并显示，可在 MN 里删除该批注");
  }, [viewport, color, shapes, setShapes, setSelectedId, setViewport, insertScale, showToast]);

  /** 从文件导入图片 */
  const onImportImage = useCallback(async (file: File, index = 0) => {
    try {
      const shape = await fileToImageShape(file, viewport, color, shapes, index, insertScale);
      setShapes((prev) => [...prev, shape]);
      setSelectedId(shape.id);
      setViewport((vp) => zoomToBox(vp, shape));
      showToast(`已插入图片（约 ${Math.round(shape.src.length / 1024)}KB）`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "图片导入失败");
    }
  }, [viewport, color, shapes, setShapes, setSelectedId, setViewport, insertScale, showToast]);

  /** 从目标卡渲染长图插入画布 */
  const onImportCardImage = useCallback(async (noteidArg?: string) => {
    const fresh = noteidArg ? (lockTarget(noteidArg), null) : await refreshContext();
    const nid = noteidArg ?? fresh ?? targetCard;
    if (!nid) {
      showToast("请先在 MN 里点选卡片（或在卡片菜单点「设为草图目标卡」）");
      return;
    }
    if (!noteidArg && !fresh) showToast("未取到当前选中卡，沿用上次目标卡");
    try {
      // 先按接口上限 1200 要图（更清晰），失败再退回 880——长卡可能撞上像素上限
      const rendered = (await renderCardImage(nid, 1200)) ?? (await renderCardImage(nid, 880));
      if (!rendered) {
        showToast("卡片渲染失败：卡片可能没有内容，或长图超过像素上限");
        return;
      }
      if (askCardCrop) { setCropSrc(rendered.src); return; }
      await insertCardImage(rendered.src);
    } catch (e) {
      showToast(`插入卡片图失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  }, [targetCard, refreshContext, lockTarget, showToast, askCardCrop, insertCardImage]);

  /** 选区确认：rect 为 null 表示整张插入 */
  const onCropConfirm = useCallback(async (rect: CropRect | null) => {
    const src = cropSrc;
    setCropSrc(null);
    if (!src) return;
    try {
      if (rect) {
        // 裁出来的那块同样进图片库（不压缩）
        const blob = await cropImageToBlob(src, rect);
        const shape = await blobToImageShape(blob, viewport, color, shapes, 0, insertScale);
        setShapes((prev) => [...prev, shape]);
        setSelectedId(shape.id);
        setViewport((vp) => zoomToBox(vp, shape));
        showToast("已插入选区");
        return;
      }
      await insertCardImage(src);
    } catch (e) {
      showToast(`插入失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  }, [cropSrc, insertCardImage, showToast, viewport, color, shapes, insertScale, setShapes, setSelectedId, setViewport]);

  return { cropSrc, setCropSrc, insertCardImage, onCropConfirm, onImportImage, onImportCardImage };
}
