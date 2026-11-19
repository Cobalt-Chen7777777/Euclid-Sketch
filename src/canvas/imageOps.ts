/**
 * 画布图片的批量操作（纯函数，供 App 的回调包装）。
 */
import type { Shape } from "../model/types";

/** 等比缩放某张图片（factor > 1 放大），宽度限制 1~14 世界单位 */
export function resizeImageInList(shapes: Shape[], id: string, factor: number): Shape[] {
  return shapes.map((s) => {
    if (s.id !== id || s.type !== "image") return s;
    const w = Math.min(14, Math.max(1, s.w * factor));
    return { ...s, w, h: s.h * (w / s.w) };
  });
}

/** 图片重置到目标宽度（等比） */
export function fitImageInList(shapes: Shape[], id: string, targetW: number): Shape[] {
  return shapes.map((s) => {
    if (s.id !== id || s.type !== "image") return s;
    const w = Math.min(targetW, 14);
    return { ...s, w, h: s.h * (w / s.w) };
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
