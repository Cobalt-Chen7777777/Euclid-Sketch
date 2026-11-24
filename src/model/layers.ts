/**
 * 图层：图形带 layer 序号（0 起，越大越靠上）+ hidden / locked 两个开关。
 * 图层元数据不单独存——从图形聚合，避免与形状数据不同步。
 */
import type { Shape } from "./types";

export const DEFAULT_LAYER = 0;

export const layerOf = (s: Shape): number => s.layer ?? DEFAULT_LAYER;

/** 可见（未隐藏）的图形；坐标轴不参与图层隐藏 */
export const isVisible = (s: Shape): boolean => !s.hidden || s.type === "coord";

/**
 * 可选中 / 拖动：可见，且未锁。
 * 例外：图片的 locked 语义是「防误擦」，仍需可选中才能点徽标解锁。
 */
export const isSelectable = (s: Shape): boolean => isVisible(s) && !s.locked;

/** 可被橡皮擦除：可见且未锁（图片锁定即不可擦） */
export const isEraseable = (s: Shape): boolean => isVisible(s) && !s.locked;

/** 渲染顺序：先按图层升序，同层保持原数组顺序（稳定排序） */
export function sortForRender(shapes: Shape[]): Shape[] {
  return shapes
    .map((s, i) => ({ s, i }))
    .sort((a, b) => layerOf(a.s) - layerOf(b.s) || a.i - b.i)
    .map((x) => x.s);
}

/** 存在的图层序号（升序去重） */
export function layerIds(shapes: Shape[]): number[] {
  return [...new Set(shapes.map(layerOf))].sort((a, b) => a - b);
}

/** 图层统计：图形数、是否整层隐藏 / 锁定 */
export function layerStats(shapes: Shape[], layer: number) {
  const own = shapes.filter((s) => layerOf(s) === layer && s.type !== "coord");
  return {
    count: own.length,
    hidden: own.length > 0 && own.every((s) => s.hidden),
    locked: own.length > 0 && own.every((s) => s.locked),
  };
}

/** 对整层应用 hidden / locked */
export function setLayerFlag(shapes: Shape[], layer: number, patch: { hidden?: boolean; locked?: boolean }): Shape[] {
  return shapes.map((s) => (layerOf(s) === layer && s.type !== "coord" ? { ...s, ...patch } : s));
}

/** 把指定图形移到某图层 */
export function moveToLayer(shapes: Shape[], ids: string[], layer: number): Shape[] {
  const set = new Set(ids);
  return shapes.map((s) => (set.has(s.id) ? { ...s, layer } : s));
}

/** 新建图层序号 = 现有最大 + 1 */
export const nextLayer = (shapes: Shape[]): number =>
  shapes.length === 0 ? 1 : Math.max(...shapes.map(layerOf)) + 1;

/** 图层显示名 */
export const layerName = (layer: number): string => `图层 ${layer + 1}`;
