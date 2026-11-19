/**
 * 画布图片的批量操作（纯函数，供 App 的回调包装）。
 * 缩放一律用 ImageShape.aspect（真实宽高比）校正高度——旧数据无 aspect 时退回当前 w/h 比例。
 */
import type { Shape } from "../model/types";

/** 取图片的真实宽高比（height/width） */
function ratioOf(w: number, h: number, aspect?: number): number {
  return aspect && Number.isFinite(aspect) && aspect > 0 ? aspect : h / Math.max(w, 1e-6);
}

/** 等比缩放某张图片（factor > 1 放大），宽度限制 1~14 世界单位 */
export function resizeImageInList(shapes: Shape[], id: string, factor: number): Shape[] {
  return shapes.map((s) => {
    if (s.id !== id || s.type !== "image") return s;
    const w = Math.min(14, Math.max(1, s.w * factor));
    return { ...s, w, h: w * ratioOf(s.w, s.h, s.aspect) };
  });
}

/** 图片重置到目标宽度（等比） */
export function fitImageInList(shapes: Shape[], id: string, targetW: number): Shape[] {
  return shapes.map((s) => {
    if (s.id !== id || s.type !== "image") return s;
    const w = Math.min(targetW, 14);
    return { ...s, w, h: w * ratioOf(s.w, s.h, s.aspect) };
  });
}

/** 切换图片锁定并给出提示文案 */
export function toggleImageLock(
  shapes: Shape[],
  id: string,
  onToast: (msg: string) => void,
): Shape[] {
  let msg = "";
  const next = shapes.map((s) => {
    if (s.id !== id || s.type !== "image") return s;
    const nowLocked = !s.locked;
    msg = nowLocked ? "图片已锁定" : "图片已解锁";
    return { ...s, locked: nowLocked };
  });
  if (msg) onToast(msg);
  return next;
}

/**
 * 按图片真实尺寸校正宽高比（修复旧数据：早期版本可能把长图存成了错误比例）。
 * 异步加载 src 读取自然尺寸，返回新的 shapes 数组；失败时原样返回。
 */
export async function normalizeImageById(shapes: Shape[], id: string): Promise<Shape[]> {
  const shape = shapes.find((s) => s.id === id);
  if (!shape || shape.type !== "image") return shapes;
  try {
    const { loadImage } = await import("../model/image");
    const img = await loadImage(shape.src);
    const aspect = (img.naturalHeight || img.height) / Math.max(1, img.naturalWidth || img.width);
    return shapes.map((s) => (s.id === id && s.type === "image" ? { ...s, aspect, h: s.w * aspect } : s));
  } catch {
    return shapes;
  }
}
