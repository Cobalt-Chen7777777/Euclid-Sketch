/**
 * 手写防误触：手掌、虎口与「点一下就走」的手指误触。
 *
 * 三条判据都是纯前端可判断的，不需要 Apple Pencil 的原生手势
 * （挤压 / 轻点两下是 UIPencilInteraction，网页层拿不到）：
 *   1. 接触面积：手掌按下时 PointerEvent 的 width/height 明显大于指尖
 *   2. 笔优先：笔正在屏幕上，或刚抬起不到 700ms（写字时虎口本来就贴着屏）
 *   3. 极短笔迹：时长短、屏幕位移极小，不是有意的笔画
 */
import { toScreen } from "./viewport";

import type { Viewport } from "./viewport";
import type { Point2 } from "../model/types";

/** 接触面积上限（CSS 像素）：超过就按手掌处理 */
const PALM_SIZE = 36;
/** 笔抬起后仍然忽略手指的时间窗（毫秒） */
const PEN_HAND_WINDOW = 700;
/** 误触笔迹的长度上限（屏幕像素）与时长上限（毫秒） */
const STRAY_LEN = 8;
const STRAY_MS = 160;

/** 笔的在场状态，由画布层在 pointerdown / pointerup 里维护 */
export interface PenState {
  active: boolean;
  lastAt: number;
}

interface PointerLike {
  pointerType: string;
  width?: number;
  height?: number;
}

/**
 * 这次按下的指针要不要直接忽略。
 * 只处理 touch；笔与鼠标永远放行（笔按下时由调用方自行更新 PenState）。
 */
export function isPalmTouch(e: PointerLike, pen: PenState, palmReject: boolean, now = Date.now()): boolean {
  if (!palmReject || e.pointerType !== "touch") return false;
  const size = Math.max(e.width ?? 0, e.height ?? 0);
  if (size >= PALM_SIZE) return true;
  if (pen.active) return true;
  if (now - pen.lastAt < PEN_HAND_WINDOW) return true;
  return false;
}

/** 手指误触：时长短 + 屏幕上的总位移极小 */
export function isStrayInk(
  d: { points: Point2[]; startedAt: number; pointerType: string },
  v: Viewport,
  now = Date.now(),
): boolean {
  if (d.pointerType !== "touch") return false;
  if (now - d.startedAt > STRAY_MS) return false;
  let len = 0;
  for (let i = 1; i < d.points.length; i++) {
    const a = toScreen(d.points[i - 1]!, v);
    const b = toScreen(d.points[i]!, v);
    len += Math.hypot(a.x - b.x, a.y - b.y);
  }
  return len < STRAY_LEN;
}
