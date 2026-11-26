/* eslint-disable no-restricted-globals, no-restricted-syntax, no-console -- 诊断日志要读 window/document 的错误事件与环境信息 */
/**
 * 本机诊断日志：环形缓冲 200 条，记录错误、警告与关键操作。
 * 开启方式：设置 → 关于 → 连点版本号 5 次。
 */

export interface LogEntry {
  t: number;
  kind: string;
  detail: string;
}

const MAX = 200;
const buf: LogEntry[] = [];

function safeJson(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function push(kind: string, detail: unknown) {
  const text = typeof detail === "string" ? detail : safeJson(detail);
  buf.push({ t: Date.now(), kind, detail: text.slice(0, 800) });
  if (buf.length > MAX) buf.splice(0, buf.length - MAX);
}

/** 手动埋点：关键流程记一条 */
export function logEvent(kind: string, detail?: unknown) {
  push(kind, detail ?? "");
}

/** 摘取日志（时间正序纯文本，便于复制给开发者） */
export function exportLogs(): string {
  if (buf.length === 0) return "（暂无日志）";
  return buf
    .map((e) => {
      const d = new Date(e.t);
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      return `${hh}:${mm}:${ss} [${e.kind}] ${e.detail}`;
    })
    .join("\n");
}

export function recentLogs(n: number): string[] {
  return buf.slice(-n).map((e) => `[${e.kind}] ${e.detail.slice(0, 42)}`);
}

export function logCount(): number {
  return buf.length;
}

export function clearLogs() {
  buf.length = 0;
}

let installed = false;

/** 挂全局错误钩子（只挂一次），并接管 console.error / warn */
export function installLogHooks() {
  if (installed) return;
  installed = true;
  // 启动横幅：先记环境，排查时至少知道跑的是哪一版、什么模式
  const mode = document.documentElement.getAttribute("data-mode") || "workspace";
  const theme = document.documentElement.getAttribute("data-theme") || "light";
  push("boot", `mode=${mode} theme=${theme} ua=${navigator.userAgent.slice(0, 60)}`);
  logEvent("boot", `viewport ${window.innerWidth}×${window.innerHeight} dpr=${window.devicePixelRatio}`);

  window.addEventListener("error", (e) => push("error", e.message || e.error));
  window.addEventListener("unhandledrejection", (e) => push("rejection", e.reason));
  const origError = console.error.bind(console);
  const origWarn = console.warn.bind(console);
  console.error = (...args: unknown[]) => {
    push("console.error", args);
    origError(...args);
  };
  console.warn = (...args: unknown[]) => {
    push("console.warn", args);
    origWarn(...args);
  };
}
