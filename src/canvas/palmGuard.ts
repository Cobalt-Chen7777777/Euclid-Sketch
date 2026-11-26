/**
 * 手写防误触：手掌、虎口与「点一下就走」的手指误触。
 *
 * 三条判据都是纯前端可判断的，不需要 Apple Pencil 的原生手势
 * （挤压 / 轻点两下是 UIPencilInteraction，网页层拿不到）：
 *   1. 接触面积：手掌按下时 PointerEvent 的 width/height 明显大于指尖
 *   2. 笔优先：笔正在屏幕上，或刚抬起不到 700ms（写字时虎口本来就贴着屏）
 *   3. 极短笔迹：时长短、屏幕位移极小，不是有意的笔画
 */
import { logEvent } from "../debug/log";
import { toScreen } from "./viewport";

import type { Viewport } from "./viewport";
import type { Point2 } from "../model/types";

/**
 * 接触面积上限（CSS 像素）：超过就当作手掌、连指针都不登记。
 * 定在 120 是刻意保守——iOS 给网页的 width/height 并不总是真实接触面积，
 * 手指也能报到 30~50；阈值定低了会把手指标成手掌，两次单指就再也拼不成双指捏合。
 * 手掌实测远大于此，120 只会拦到真正的大面积接触。
 */
export const PALM_SIZE = 120;
/** 笔抬起后仍然忽略手指的时间窗（毫秒） */
export const PEN_HAND_WINDOW = 700;
/** 误触笔迹的长度上限（屏幕像素）与时长上限（毫秒） */
const STRAY_LEN = 8;
const STRAY_MS = 160;

/** 笔的在场状态，由画布层持有并在 pointerdown / pointerup 里更新 */
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
 * pointerdown 时的统一判定：维护笔的在场状态，并给出这次指针要不要忽略。
 * 返回 penInHand 供调用方决定「手指这次能不能落笔」——注意即使 penInHand，
 * 指针也要照常登记，否则两指捏合会被拆成两次单指。
 */
export function notePointerStart(
  e: PointerLike,
  pen: PenState,
  palmReject: boolean,
  now = Date.now(),
): { penInHand: boolean; ignore: boolean } {
  const penInHand = pen.active || now - pen.lastAt < PEN_HAND_WINDOW;
  if (e.pointerType === "pen") {
    pen.active = true;
    pen.lastAt = now;
    return { penInHand, ignore: false };
  }
  if (e.pointerType !== "touch") return { penInHand, ignore: false };

  const w = e.width ?? 0;
  const h = e.height ?? 0;
  // 真机排查用：只在可疑时记一行（笔在手，或接触面积偏大），避免刷满诊断日志
  if (penInHand || Math.max(w, h) >= 40) {
    logEvent("palm", `touch size=${Math.round(w)}x${Math.round(h)} pen=${penInHand ? 1 : 0}`);
  }
  // 只有在「笔在手」且面积特别大时才丢；否则手指一律放行，保证捏合可用
  const ignore = palmReject && penInHand && Math.max(w, h) >= PALM_SIZE;
  return { penInHand, ignore };
}

/** pointerup 时更新笔的在场状态 */
export function notePointerEnd(e: PointerLike, pen: PenState, now = Date.now()): void {
  if (e.pointerType === "pen") {
    pen.active = false;
    pen.lastAt = now;
  }
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
