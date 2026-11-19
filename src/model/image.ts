/* eslint-disable no-restricted-globals, no-restricted-syntax -- 图片压缩用离屏 canvas，不触碰页面 DOM 与样式 */
/**
 * 图片导入：读取文件 → 压缩（最长边 1200，JPEG/PNG 0.85）→ 生成画布图形。
 * dataURL 随 shapes 存 localStorage，因此必须压缩，避免超出存储配额。
 */
import type { Handle } from "./geometry";
import type { Viewport } from "../canvas/viewport";
import type { ImageShape, Point2, Shape } from "./types";
import { newId } from "./types";

const MAX_SIDE = 1200;

/** 从文件导入（读为 dataURL 后走同一压缩管线） */
export async function fileToImageShape(file: File, viewport: Viewport, color: string): Promise<ImageShape> {
  const src = await readAsDataURL(file);
  return imageSrcToShape(src, viewport, color);
}

/** 把一张图片 dataURL 压缩并生成画布图形（卡片渲染图 / 文件导入共用） */
export async function imageSrcToShape(
  rawSrc: string,
  viewport: Viewport,
  color: string,
  /** 非空时沿用原图（已是压缩好的 PNG，如卡片渲染图） */
  reuseSrc = false,
): Promise<ImageShape> {
  const img = await loadImage(rawSrc);

  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
  const mime = reuseSrc ? "image/png" : "image/jpeg";
  const src = reuseSrc ? rawSrc : canvas.toDataURL(mime, 0.85);

  // 世界尺寸：宽约占可视宽度一半，保持图片宽高比
  const spanX = viewport.xRange[1] - viewport.xRange[0];
  const wWorld = Math.min(spanX * 0.5, 6);
  const hWorld = wWorld * (h / w);
  const cx = (viewport.xRange[0] + viewport.xRange[1]) / 2;
  const cy = (viewport.yRange[0] + viewport.yRange[1]) / 2;
  return {
    id: newId("image"),
    type: "image",
    x: cx - wWorld / 2,
    y: cy - hWorld / 2,
    w: wWorld,
    h: hWorld,
    src,
    color,
    // 导入即锁定：题目底图不会被橡皮误擦（左上角徽标可解锁）
    locked: true,
  };
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片解析失败"));
    img.src = src;
  });
}

/** 图片命中：矩形范围（含少量容差） */
export function imageHitTest(shape: ImageShape, world: Point2, tol: number): boolean {
  return world.x >= shape.x - tol && world.x <= shape.x + shape.w + tol
    && world.y >= shape.y - tol && world.y <= shape.y + shape.h + tol;
}

/** 图片控制点：中心整体移动 + 右下角缩放 */
export function imageHandles(shape: ImageShape): Handle[] {
  return [
    {
      id: "pos",
      at: { x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 },
      apply: (s0, w) => ({
        ...(s0 as ImageShape),
        x: w.x - (s0 as ImageShape).w / 2,
        y: w.y - (s0 as ImageShape).h / 2,
      }),
    },
    {
      id: "resize",
      at: { x: shape.x + shape.w, y: shape.y + shape.h },
      apply: (s0, w) => ({
        ...(s0 as ImageShape),
        w: Math.max(0.5, w.x - (s0 as ImageShape).x),
        h: Math.max(0.5, w.y - (s0 as ImageShape).y),
      }),
    },
  ];
}

export type { Shape };
