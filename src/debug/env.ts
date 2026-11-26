/**
 * 启动时把宿主环境记一行：窗口尺寸、原生拖拽条高度、面板模式。
 * 真机上排查布局/拖拽问题时，从诊断日志里就能看到实际数值。
 */
/* eslint-disable no-restricted-globals, no-restricted-syntax -- 只在这里读一次真实窗口尺寸与根元素 CSS 变量，用于诊断日志 */
import { logEvent } from "./log";

let logged = false;

export function logHostEnv(): void {
  if (logged) return;
  logged = true;
  try {
    const dragH = getComputedStyle(document.documentElement).getPropertyValue("--mn-drag-h").trim() || "未注入";
    const mode = (window as unknown as { mn?: { currentMode?: string } }).mn?.currentMode ?? "?";
    logEvent("layout", `win=${window.innerWidth}x${window.innerHeight} drag-h=${dragH} mode=${mode}`);
  } catch {
    // 环境异常时不值得打断启动
  }
}
