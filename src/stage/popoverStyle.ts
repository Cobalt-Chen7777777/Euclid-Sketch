/* eslint-disable no-restricted-globals, no-restricted-syntax -- 浮层位置要量画布区（.stage）与窗口的边界，这是运行时几何，不是渲染 */
/**
 * 浮层位置：贴着触发它的按钮弹出。
 *
 * 坐标是相对 `.stage` 的（浮层用 absolute 定位）：`.stage` 在 `#root` 里，
 * 而 `#root` 是 `overflow: hidden` + 圆角，所以浮层画不出面板 ——
 * 之前用 fixed 定位，坐标一算歪就会压到面板圆角上。
 *
 * 优先摆在按钮上方（上方空间不够就落到下面），水平方向夹在画布区内。
 */
export function popoverStyle(
  anchor: { left: number; top: number; width: number; height: number } | null | undefined,
  opts: { width: number; maxHeight: number; minHeight?: number; pad?: number; fill?: boolean },
) {
  if (!anchor) return undefined;
  const stage = document.querySelector(".stage")?.getBoundingClientRect();
  const root = document.getElementById("root")?.getBoundingClientRect();
  const bounds = stage && stage.width > 0
    ? stage
    : root && root.width > 0
      ? root
      : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };

  const pad = opts.pad ?? 18;
  const width = Math.min(opts.width, bounds.right - bounds.left - pad * 2);
  const absLeft = Math.max(bounds.left + pad, Math.min(anchor.left + anchor.width + 8, bounds.right - width - pad));
  const spaceAbove = anchor.top - bounds.top - pad;
  const spaceBelow = bounds.bottom - (anchor.top + anchor.height) - pad;
  const minHeight = opts.minHeight ?? 240;
  const above = spaceAbove >= minHeight || spaceAbove >= spaceBelow;
  const room = Math.max(minHeight, Math.min(opts.maxHeight, above ? spaceAbove : spaceBelow));
  const maxHeight = Math.min(bounds.bottom - bounds.top - pad * 2, room);
  // fill：直接占满可用高度（图形清单这种「一屏看越多越好」的浮层），内容在内部滚动
  const height = opts.fill ? maxHeight : undefined;

  return above
    ? {
      left: absLeft - bounds.left, width, maxHeight, ...(height ? { height } : {}),
      bottom: bounds.bottom - anchor.top + 8, top: "auto",
    }
    : {
      left: absLeft - bounds.left, width, maxHeight, ...(height ? { height } : {}),
      top: anchor.top + anchor.height + 8 - bounds.top, bottom: "auto",
    };
}
