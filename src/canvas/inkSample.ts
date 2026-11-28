/**
 * 手写采样：把一次 pointermove 里合成事件攒下的所有点都收进来。
 * 一帧通常只派发一个 pointermove，快速连笔时点很稀，只取最后一个就会画成折线。
 */
import type { Point2 } from "../model/types";

/** 采样阈值（世界单位）：0.02 格约合 1px */
const MIN_STEP = 0.02;

export function appendInkSamples(
  points: Point2[],
  samples: PointerEvent[],
  rect: { left: number; top: number } | null,
  fallback: Point2,
  toWorld: (sp: Point2) => Point2,
): Point2[] {
  const out = [...points];
  for (const ev of samples) {
    const local = rect ? { x: ev.clientX - rect.left, y: ev.clientY - rect.top } : fallback;
    const world = toWorld(local);
    const last = out[out.length - 1];
    if (last && Math.hypot(world.x - last.x, world.y - last.y) < MIN_STEP) continue;
    out.push(world);
  }
  return out;
}
