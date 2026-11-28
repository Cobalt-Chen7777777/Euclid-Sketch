/**
 * 「绘图选项」按钮的显隐：橡皮只负责擦、套索只负责框选，
 * 打开抽屉也是空的，干脆不给入口（切过去时把已经开着的抽屉收起来）。
 */
const TOOLS_WITHOUT_OPTIONS = new Set(["eraser", "lasso"]);

export function toolHasOptions(tool: string): boolean {
  return !TOOLS_WITHOUT_OPTIONS.has(tool);
}
