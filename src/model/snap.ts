/**
 * 吸附：优先图形上的已有控制点（端点 / 圆心 / 顶点），其次网格交点。
 * 拖动已有图形时传 allowGrid=false——笔微调不该被整数格粘走。
 */
import { getHandles } from "./geometry";
import type { Point2, Shape } from "./types";
import { toScreen } from "../canvas/viewport";
import type { Viewport } from "../canvas/viewport";

/** 吸附判定阈值（屏幕像素） */
export const SNAP_PX = 14;

export interface SnapContext {
  shapes: Shape[];
  v: Viewport;
  enabled: boolean;
  showGrid: boolean;
  gridStep: number;
}

export function snapWorld(world: Point2, ctx: SnapContext, allowGrid = true): Point2 {
  if (!ctx.enabled) return world;
  const sp = toScreen(world, ctx.v);
  let best: Point2 | null = null;
  let bestD = SNAP_PX;
  for (const s of ctx.shapes) {
    for (const h of getHandles(s)) {
      const hs = toScreen(h.at, ctx.v);
      const d = Math.hypot(hs.x - sp.x, hs.y - sp.y);
      if (d < bestD) { bestD = d; best = h.at; }
    }
  }
  if (best) return best;
  if (allowGrid && ctx.showGrid) {
    const step = ctx.gridStep > 0 ? ctx.gridStep : 1;
    const grid = { x: Math.round(world.x / step) * step, y: Math.round(world.y / step) * step };
    const gp = toScreen(grid, ctx.v);
    if (Math.hypot(gp.x - sp.x, gp.y - sp.y) <= SNAP_PX) return grid;
  }
  return world;
}
