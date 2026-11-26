/**
 * 阻止宿主把手势当成「拖动面板窗口 / 滚动」。
 *
 * WKWebView 里 React 的 pointer 事件 preventDefault 拦不住宿主的原生手势，
 * 必须用非 passive 的 touchstart/touchmove 监听来拦（画布、缩放把手、计算器浮条
 * 都是这么做的）。所有可拖拽的自绘控件都应挂这个。
 */
export function blockHostTouch(el: HTMLElement): () => void {
  const block = (ev: Event) => ev.preventDefault();
  el.addEventListener("touchstart", block, { passive: false });
  el.addEventListener("touchmove", block, { passive: false });
  return () => {
    el.removeEventListener("touchstart", block);
    el.removeEventListener("touchmove", block);
  };
}
