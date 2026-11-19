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
 * 官方接口：GET /notes/{noteid}/render —— 返回图片本身不是 JSON，官方要求用 fetch 原语读取：
 *   fetch('/bridge/v1/notes/' + noteid + '/render?format=png&width=880')
 * 失败（无内容 / 超像素上限 / 断网）返回 null，由调用方提示。
 * 注意：不检查 blob.type —— MN 返回的 Content-Type 不一定是 image/*，交给 Image 解码验证。
 */
export async function renderCardImage(
  noteid: string,
  width = 880,
): Promise<{ src: string; w: number; h: number } | null> {
  let res: Response;
  try {
    res = await fetch(`/bridge/v1/notes/${encodeURIComponent(noteid)}/render?format=png&width=${width}`);
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const blob = await res.blob();
  if (blob.size === 0) return null;
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
}

/** 写卡片标题 */
export async function setCardTitle(noteid: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const res = await mn.api(`/notes/${noteid}/title`, {
    method: "POST",
    body: { text },
  });
  return toResult(res);
}

/**
 * 追加批注（降级方案：把构图说明/公式写进批注）。
 * 官方接口：POST /notes/{noteid}/comments —— body 需 confirm:true（必填），
 * format 合法值是 text/markdown/html/rich（之前误传 "richText" 导致写入失败）。
 */
export async function addComment(noteid: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const res = await mn.api(`/notes/${noteid}/comments`, {
    method: "POST",
    body: { text, format: "text", confirm: true },
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

/** 草图批注的识别前缀（写入时用于找到并改写上次的批注，避免堆叠） */
export const REPORT_MARK = "【Euclid Sketch 草图";

interface CommentsList {
  comments?: Array<{ index?: number; text?: string }>;
}

/**
 * 写入或更新草图批注：同一张卡上已存在草图批注时改写它（保留一条），
 * 否则新增。更新用 expectedPrefix 防并发覆盖（内容已变则退回新增）。
 */
export async function upsertComment(noteid: string, text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const list = await mn.api<CommentsList>(`/notes/${noteid}/comments`);
    if (!list.error) {
      let target: { index: number; text: string } | null = null;
      for (const c of list.comments ?? []) {
        if (typeof c.index === "number" && typeof c.text === "string" && c.text.startsWith(REPORT_MARK)) {
          target = { index: c.index, text: c.text };
        }
      }
      if (target) {
        const res = await mn.api(`/notes/${noteid}/comments/${target.index}`, {
          method: "POST",
          body: { text, format: "text", confirm: true, expectedPrefix: target.text.slice(0, 32) },
        });
        if (!res.error) return { ok: true };
      }
    }
  } catch {
    // 读取/更新失败：退回新增
  }
  return addComment(noteid, text);
}
