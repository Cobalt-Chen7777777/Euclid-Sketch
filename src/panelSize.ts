/**
 * 面板尺寸下发的唯一出口。
 *
 * 为什么需要它：`mn.size()` 带过渡动画，同一个值在短时间内被下发两次，宿主会把动画**重播一遍**
 * —— 收起/展开时会看到「缩一下、又抖一下」。而尺寸由两个地方给：
 *   - `useResizablePanel`（展开、收起、拖动把手）
 *   - `useMiniBarFit`（迷你条按内容自适应）
 * 各自做去重只能挡住自己那一路，所以统一收敛到这里，按「同值 700ms 内只发一次」去重。
 */

interface Issued {
  w: number;
  h: number;
  at: number;
}

/** 去重窗口：宿主的尺寸过渡动画大致在这个量级内完成 */
const DEDUP_MS = 700;

let last: Issued | null = null;

function hasApi(): boolean {
  return typeof mn !== "undefined" && typeof mn.size === "function";
}

/** 下发面板尺寸；同值且距上次 < 700ms 时跳过。返回是否真的调用了宿主 */
export function issuePanelSize(w: number, h: number, force = false): boolean {
  if (!hasApi()) return false;
  const now = Date.now();
  if (!force && last && last.w === w && last.h === h && now - last.at < DEDUP_MS) return false;
  last = { w, h, at: now };
  mn.size(w, h);
  return true;
}

/** 只登记、不下发（宿主自己改过尺寸时用来对齐记录，避免下一帧多调一次） */
export function rememberPanelSize(w: number, h: number): void {
  last = { w, h, at: Date.now() };
}
