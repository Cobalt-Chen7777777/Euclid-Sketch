/**
 * Marginnote Bridge 桥接层。
 * 纯面板插件通过 window.mn.api() 读写 MN 数据。
 * 提供：能力探测、卡片列表、写标题/正文/批注、以及图片写回能力探测。
 */
import type { Card } from "./topic";

export interface Capabilities {
  routes?: string[];
  raw?: unknown;
}

/** 探测 MN 注册的能力路由（用于判断是否有图片写入接口） */
export async function getCapabilities(): Promise<Capabilities> {
  try {
    const res = await mn.api<{ routes?: string[] }>("/capabilities");
    return res.routes ? { routes: res.routes, raw: res } : { raw: res };
  } catch {
    return {};
  }
}

/** 探测是否存在可用的图片写入路由 */
export async function hasImageWriteCapability(caps: Capabilities): Promise<boolean> {
  const routes = caps.routes ?? [];
  return routes.some((r) => /image|media|attach|picture/i.test(r));
}

/**
 * 把选定卡片渲染成一张长图（标题 / 正文 / 摘录图 / 插图 / 手写合成）。
 * 对应 GET /bridge/v1/notes/{noteid}/render —— 返回图片二进制，需要 fetch 原语读取。
 * 失败（无内容 / 超像素上限 / 断网）返回 null，由调用方提示。
 */
export async function renderCardImage(
  noteid: string,
  width = 880,
): Promise<{ src: string; w: number; h: number } | null> {
  try {
    const res = await fetch(`/bridge/v1/notes/${noteid}/render?format=png&width=${width}`);
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) return null;
    const src = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("图片读取失败"));
      reader.readAsDataURL(blob);
    });
    const size = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => reject(new Error("图片解析失败"));
      img.src = src;
    });
    return { src, w: size.w, h: size.h };
  } catch {
    return null;
  }
}

/** 写卡片标题 */
export async function setCardTitle(noteid: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const res = await mn.api(`/notes/${noteid}/title`, {
    method: "POST",
    body: { text },
  });
  return toResult(res);
}

/** 追加批注（降级方案：把构图说明/公式写进批注） */
export async function addComment(noteid: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const res = await mn.api(`/notes/${noteid}/comments`, {
    method: "POST",
    body: { text, format: "richText" },
  });
  return toResult(res);
}

/**
 * 定位到某张卡片：把界面切到该卡（连带切到它所属的学习集/文档）。
 * 对应 POST /notes/{noteid}/focus —— 界面切换是异步的，本身即结果。
 */
export async function focusCard(noteid: string, topicid?: string): Promise<{ ok: boolean; error?: string }> {
  const res = await mn.api(`/notes/${noteid}/focus`, {
    method: "POST",
    body: topicid ? { topicid } : {},
  });
  return toResult(res);
}

/** 写正文 */
export async function setCardText(
  noteid: string,
  text: string,
  expectedPrefix = "",
): Promise<{ ok: boolean; error?: string }> {
  const res = await mn.api(`/notes/${noteid}/text`, {
    method: "POST",
    body: { text, expectedPrefix },
  });
  return toResult(res);
}

function toResult(res: unknown): { ok: boolean; error?: string } {
  if (res && typeof res === "object" && "error" in res) {
    const err = (res as { error?: { message?: string } }).error;
    return { ok: false, error: err?.message ?? "写入失败" };
  }
  return { ok: true };
}

// 保留 createBridge 兼容（脚手架原 bridge 导出）
export interface PanelCommand {
  ping(payload?: unknown): Promise<{ ok: true; payload: unknown }>;
}
export function createBridge(): PanelCommand {
  return {
    ping(payload) {
      return mn.call("ping", payload);
    },
  };
}

export type { Card };
