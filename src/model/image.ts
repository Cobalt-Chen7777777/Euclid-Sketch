/* eslint-disable no-restricted-globals, no-restricted-syntax -- 图片裁剪与 objectURL 要用 document / URL / canvas，这是命令式图片处理，不碰页面结构 */
/**
 * 图片导入：原样存进图片库（IndexedDB，见 io/imageStore），画布上只记 imgId。
 * 早先是压成 dataURL 塞进图形数据，为了不撑爆 localStorage 只能压到 1200px，
 * 插入后和原图差很多；现在不缩放也不重编码，清晰度和原图一致。
 */
import type { Handle } from "./geometry";
import type { Viewport } from "../canvas/viewport";
import type { ImageShape, Point2, Shape } from "./types";
import { putImage } from "../io/imageStore";
import { newId } from "./types";

/** 按图片自然像素裁出一块，返回 Blob（原样存进图片库，不再压缩） */
export async function cropImageToBlob(
  src: string,
  rect: { x: number; y: number; w: number; h: number },
): Promise<Blob> {
  const img = await loadImage(src);
  const w = Math.max(1, Math.round(rect.w));
  const h = Math.max(1, Math.round(rect.h));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")?.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("裁剪失败"))), "image/png");
  });
}

/** 从文件导入：原图原样存进图片库（不缩放、不重编码），清晰度和原图一致 */
export async function fileToImageShape(
  file: File,
  viewport: Viewport,
  color: string,
  existing: Shape[] = [],
  offsetIndex = 0,
  insertScale = 1,
): Promise<ImageShape> {
  return blobToImageShape(file, viewport, color, existing, offsetIndex, insertScale);
}

/** dataURL（卡片渲染图）→ 图片库 → 画布图形 */
export async function imageSrcToShape(
  rawSrc: string,
  viewport: Viewport,
  color: string,
  existing: Shape[] = [],
  offsetIndex = 0,
  insertScale = 1,
): Promise<ImageShape> {
  const blob = await (await fetch(rawSrc)).blob();
  return blobToImageShape(blob, viewport, color, existing, offsetIndex, insertScale);
}

/** 以 Blob 生成画布图形：Blob 直接进 IndexedDB，画布只记 id */
export async function blobToImageShape(
  blob: Blob,
  viewport: Viewport,
  color: string,
  /** 画布已有图形：按其中图片数量错开位置，避免叠在一起 */
  existing: Shape[] = [],
  /** 本次批量导入中的序号（0 起），同批多图错位用 */
  offsetIndex = 0,
  /** 插入大小系数（1 = 视口 80%），设置里的「插入大小」 */
  insertScale = 1,
): Promise<ImageShape> {
  const probeUrl = URL.createObjectURL(blob);
  let img: HTMLImageElement;
  try {
    img = await loadImage(probeUrl);
  } finally {
    // 只是用来量尺寸，存库时会另建一个给渲染用的 URL
    setTimeout(() => URL.revokeObjectURL(probeUrl), 0);
  }
  const imgId = await putImage(blob);

  // 世界尺寸：宽约占可视宽度一半，保持图片真实宽高比；超高的长图（题目截图）
  // 优先铺满画布高度的 85%，宽度按比例缩——避免长图被压扁变形
  const spanX = viewport.xRange[1] - viewport.xRange[0];
  const spanY = viewport.yRange[1] - viewport.yRange[0];
  const iw = img.naturalWidth || img.width || 1;
  const ih = img.naturalHeight || img.height || 1;
  // 初始尺寸：宽度先按视口 80%（不再限制 6 个单位——那会让题目图小到看不清），
  // 若因此过高（长图），改为按高度 90% 适配，宽度按真实比例缩
  let wWorld = spanX * 0.8;
  let hWorld = wWorld * (ih / iw);
  const maxH = spanY * 0.9;
  if (hWorld > maxH) {
    hWorld = maxH;
    wWorld = hWorld * (iw / ih);
  }
  // 用户在设置里选的插入大小（大 / 中 / 小）
  wWorld *= insertScale;
  hWorld *= insertScale;
  const cx = (viewport.xRange[0] + viewport.xRange[1]) / 2;
  const cy = (viewport.yRange[0] + viewport.yRange[1]) / 2;
  // 位置：以视口中心为基准，按「已有图片数 + 本次导入序号」阶梯错开。
  // 之前所有图片都插在正中心，连续导入会完全叠在一起，看起来像「导入乱了」。
  const imageCount = existing.filter((it) => it.type === "image").length + offsetIndex;
  // 每张错开 0.6 个图宽 / 0.6 个图高：像把纸斜着一层层叠放，一眼能看出是几张图
  const stepX = wWorld * 0.6;
  const stepY = hWorld * 0.6;
  const x = cx - wWorld / 2 + imageCount * stepX;
  const y = cy - hWorld / 2 - imageCount * stepY;

  return {
    id: newId("image"),
    type: "image",
    x,
    y,
    w: wWorld,
    h: hWorld,
    imgId,
    src: "",
    color,
    // 记录真实比例：后续缩放按它校正，长图永远不变形
    aspect: ih / iw,
    // 导入即锁定：题目底图不会被橡皮误擦（左上角徽标可解锁）
    locked: true,
  };
}


export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("图片解析失败"));
    img.src = src;
  });
}

/**
 * 绕中心旋转后的点（世界坐标 y 向上）。
 * 注意符号：画布 SVG 的 rotate(deg) 在屏幕上顺时针，换算到 y 向上的世界坐标是**逆时针**，
 * 所以传进来的角度要用 -rot；之前的符号反了，旋转后控制点会飘到图片外面。
 */
function rotated(p: Point2, c: Point2, ang: number): Point2 {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

/** 图片中心 */
export const imageCenter = (s: ImageShape): Point2 => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });

/** 图片命中：先把点转回未旋转坐标系，再按矩形判断 */
export function imageHitTest(shape: ImageShape, world: Point2, tol: number): boolean {
  const p = shape.rot ? rotated(world, imageCenter(shape), shape.rot) : world;
  return p.x >= shape.x - tol && p.x <= shape.x + shape.w + tol
    && p.y >= shape.y - tol && p.y <= shape.y + shape.h + tol;
}

/** 图片控制点：中心整体移动 + 右下角缩放 + 顶部旋转 */
export function imageHandles(shape: ImageShape): Handle[] {
  const c = imageCenter(shape);
  // 世界坐标 y 向上：屏幕右下角是 (x+w, y)，左下角是 (x, y)
  const corner = { x: shape.x, y: shape.y };          // 缩放点：左下角
  const rotLocal = { x: shape.x + shape.w, y: shape.y }; // 旋转钮：右下角
  const rotAt = rotLocal;
  const rotBase = Math.atan2(rotLocal.y - c.y, rotLocal.x - c.x);
  return [
    {
      id: "pos",
      at: c,
      apply: (s0, w) => ({
        ...(s0 as ImageShape),
        x: w.x - (s0 as ImageShape).w / 2,
        y: w.y - (s0 as ImageShape).h / 2,
      }),
    },
    {
      id: "resize",
      at: corner,
      apply: (s0, w) => {
        const s = s0 as ImageShape;
        // 等比缩放（锚点=左下角）：宽度和高度都给候选值，取变化更显著的一轴做主控，
        // 高度始终按真实宽高比校正——图片永远不会被拖变形
        const ratio = s.aspect && s.aspect > 0 ? s.aspect : s.h / Math.max(s.w, 1e-6);
        const byX = Math.max(0.5, w.x - s.x);
        const byY = Math.max(0.5, (w.y - s.y) / Math.max(ratio, 1e-6));
        const width = Math.abs(byX - s.w) >= Math.abs(byY - s.w) ? byX : byY;
        // 旋转过的图片：按「光标到中心的距离」等比缩放，和朝向无关，不会拽歪
        if (s.rot) {
          const cc = imageCenter(s);
          const dCur = Math.hypot(w.x - cc.x, w.y - cc.y);
          const dCorner = Math.hypot(s.w / 2, s.h / 2);
          const scaled = Math.max(0.5, s.w * (dCur / Math.max(dCorner, 1e-6)));
          return { ...s, x: cc.x - scaled / 2, y: cc.y - (scaled * ratio) / 2, w: scaled, h: scaled * ratio };
        }
        return { ...s, w: width, h: width * ratio };
      },
    },
    {
      id: "rot",
      at: rotAt,
      apply: (s0, w) => {
        const s = s0 as ImageShape;
        const cc = imageCenter(s);
        // 旋转点相对中心的方向是固定的（左下角），减去它才是图片自己的角度
        return { ...s, rot: Math.atan2(w.y - cc.y, w.x - cc.x) - rotBase };
      },
    },
  ];
}

export type { Shape };
