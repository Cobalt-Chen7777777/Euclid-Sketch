/** 世界坐标与 SVG 屏幕坐标之间的变换 */
import type { Point2, Range } from "../model/types";

export interface Viewport {
  width: number;
  height: number;
  xRange: Range;
  yRange: Range;
}

export function toScreen(p: Point2, v: Viewport): Point2 {
  const [x0, x1] = v.xRange;
  const [y0, y1] = v.yRange;
  const sx = ((p.x - x0) / (x1 - x0)) * v.width;
  const sy = v.height - ((p.y - y0) / (y1 - y0)) * v.height;
  return { x: sx, y: sy };
}

export function toWorld(p: Point2, v: Viewport): Point2 {
  const [x0, x1] = v.xRange;
  const [y0, y1] = v.yRange;
  const x = x0 + (p.x / v.width) * (x1 - x0);
  const y = y0 + ((v.height - p.y) / v.height) * (y1 - y0);
  return { x, y };
}

/** 半径（世界）转屏幕像素长度 */
export function scaleX(v: Viewport): number {
  return v.width / (v.xRange[1] - v.xRange[0]);
}
export function scaleY(v: Viewport): number {
  return v.height / (v.yRange[1] - v.yRange[0]);
}

/** 屏幕上的圆半径：取 x/y 缩放的几何平均，保持视觉接近正圆 */
export function radiusToScreen(r: number, v: Viewport): number {
  return r * Math.sqrt(Math.abs(scaleX(v) * scaleY(v)));
}
export function radiusToWorld(rPx: number, v: Viewport): number {
  return rPx / Math.sqrt(Math.abs(scaleX(v) * scaleY(v)));
}

/** 生成网格线位置（世界坐标） */
export function gridLines(v: Viewport, step: number): { x: number[]; y: number[] } {  const xs: number[] = [];
  const ys: number[] = [];
  if (step <= 0) return { x: xs, y: ys };
  const [x0, x1] = v.xRange;
  const [y0, y1] = v.yRange;
  // 上限保护：极端缩放时按倍数放粗步长，避免生成上万条线把界面卡死
  const MAX_LINES = 240;
  const countX = Math.ceil((x1 - x0) / step);
  const countY = Math.ceil((y1 - y0) / step);
  const stepX = countX > MAX_LINES ? step * Math.ceil(countX / MAX_LINES) : step;
  const stepY = countY > MAX_LINES ? step * Math.ceil(countY / MAX_LINES) : step;

  for (let x = Math.ceil(x0 / stepX) * stepX; x <= x1; x += stepX) xs.push(x);
  for (let y = Math.ceil(y0 / stepY) * stepY; y <= y1; y += stepY) ys.push(y);
  return { x: xs, y: ys };
}

/** 平移视口（世界坐标增量） */
export function panRange(range: Range, delta: number): Range {
  return [range[0] + delta, range[1] + delta];
}

/**
 * 让画布铺满容器：**保持当前缩放比例**，只增减可见范围。
 *
 * 早先的写法是「保持横向范围、按宽高比重算纵向范围」，面板一变尺寸，
 * 世界范围就跟着变，拖窗口调大小时画面会不断重新缩放（看起来是"乱动"）。
 * 现在固定 px/单位，尺寸变化只改变看得到多少，图形不会跳。
 */
export function fitViewport(v: Viewport, width: number, height: number): Viewport {
  if (width < 40 || height < 40) return v;
  const spanX = v.xRange[1] - v.xRange[0];
  const spanY = v.yRange[1] - v.yRange[0];
  if (spanX <= 0 || spanY <= 0) return { ...v, width, height };

  // 比例只从横向推导：反复 fit 时结果稳定（用几何平均会因舍入逐次漂移）
  const scale = v.width / spanX;
  const cx = (v.xRange[0] + v.xRange[1]) / 2;
  const cy = (v.yRange[0] + v.yRange[1]) / 2;
  const nextSpanX = width / scale;
  const nextSpanY = height / scale;

  return {
    width,
    height,
    xRange: [cx - nextSpanX / 2, cx + nextSpanX / 2],
    yRange: [cy - nextSpanY / 2, cy + nextSpanY / 2],
  };
}

/**
 * 缩放极限（世界单位跨度）。
 * 双指每帧最多 0.5 倍，连续捏合几十帧后跨度会塌到 1e-9 以下：
 * 此时 toScreen 的 (p - x0) / span 已经丢失全部有效位，所有坐标挤成同一个值，
 * 曲线/图形看上去「整条消失」（其实是画成了一个点）。所以跨度必须有硬边界。
 */
export const MIN_SPAN = 0.02;
export const MAX_SPAN = 4000;

/** 跨度异常（塌缩成 0 或 NaN）时的兜底视野 */
function fallbackRange(v: Viewport): Viewport {
  return { ...v, xRange: [-8, 8], yRange: [-8, 8] };
}

/** 以某屏幕点为中心缩放视口 */
export function zoomViewport(v: Viewport, anchor: Point2, factor: number): Viewport {
  const [x0, x1] = v.xRange;
  const [y0, y1] = v.yRange;
  const spanX = x1 - x0;
  const spanY = y1 - y0;
  // 已经坏掉的视口先复位，否则后续每帧都会算出 NaN
  if (!Number.isFinite(spanX) || !Number.isFinite(spanY) || spanX <= 0 || spanY <= 0) {
    return fallbackRange(v);
  }
  // 到达缩放上下限就停手：继续缩放只会让坐标失去精度
  const nextSpanX = spanX * factor;
  if (!Number.isFinite(nextSpanX) || nextSpanX < MIN_SPAN || nextSpanX > MAX_SPAN) return v;

  const worldAnchor = toWorld(anchor, v);
  const newW = spanX * factor;
  const newH = spanY * factor;
  const rx = (worldAnchor.x - x0) / spanX;
  const ry = (worldAnchor.y - y0) / spanY;
  return {
    ...v,
    xRange: [worldAnchor.x - newW * rx, worldAnchor.x + newW * (1 - rx)],
    yRange: [worldAnchor.y - newH * ry, worldAnchor.y + newH * (1 - ry)],
  };
}

/**
 * 缩放到刚好包住某个世界矩形（四周留边距）。
 * 世界范围宽高比必须与画布一致，否则图形会被拉伸变形。
 */
export function zoomToBox(
  v: Viewport,
  box: { x: number; y: number; w: number; h: number },
  padRatio = 0.08,
): Viewport {
  if (v.width < 40 || v.height < 40 || box.w <= 0 || box.h <= 0) return v;
  const canvasRatio = v.width / v.height;
  let w = box.w * (1 + padRatio * 2);
  let h = box.h * (1 + padRatio * 2);
  if (w / h > canvasRatio) h = w / canvasRatio;
  else w = h * canvasRatio;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  return { ...v, xRange: [cx - w / 2, cx + w / 2], yRange: [cy - h / 2, cy + h / 2] };
}
