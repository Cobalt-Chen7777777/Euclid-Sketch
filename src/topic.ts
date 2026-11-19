export interface Card {
  noteid: string;
  title: string;
  docPage: number | null;
}

interface UiState {
  state?: {
    topicid?: string;
    focusnoteid?: string;
  };
}

interface TopicTree {
  nodes?: Array<{
    noteid?: string;
    title?: string;
    docPage?: number | null;
  }>;
  nextCursor?: string | null;
}

interface AppContext {
  available?: boolean;
  /** 学习集信息（id 为 topicid） */
  studySet?: { id?: string };
  /** 当前焦点卡（用户正在看的卡） */
  focusedNote?: string;
}

export interface CurrentContext {
  topicid: string | null;
  focusNoteid: string | null;
}

/**
 * 当前操作上下文：学习集 + 焦点卡。
 * 官方 GET /context 返回整理过的语义（focusedNote = 用户正在看的卡）；
 * 失败或不可用时回退 GET /ui-state 的原始键值。
 */
export async function getCurrentContext(): Promise<CurrentContext> {
  try {
    const ctx = await mn.api<AppContext>("/context");
    if (!ctx.error && ctx.available !== false) {
      const topicid = typeof ctx.studySet?.id === "string" ? ctx.studySet.id : null;
      const focusNoteid = typeof ctx.focusedNote === "string" && ctx.focusedNote ? ctx.focusedNote : null;
      if (topicid || focusNoteid) return { topicid, focusNoteid };
    }
  } catch {
    // /context 不可用，回退 ui-state
  }
  const state = await mn.api<UiState>("/ui-state");
  if (state.error) {
    throw new Error(`${state.error.code}：${state.error.message}`);
  }
  return {
    topicid: state.state?.topicid ?? null,
    focusNoteid: state.state?.focusnoteid ?? null,
  };
}

export async function listCards(topicid: string): Promise<Card[]> {
  const out: Card[] = [];
  // 官方接口分页：limit/cursor，nextCursor 为 null 表示读完（默认 limit 较小，必须循环拉全）
  let cursor: string | null = null;
  for (let page = 0; page < 50; page++) {
    const query: string = `sort=document${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const tree = await mn.api<TopicTree>(
      `/study-sets/${encodeURIComponent(topicid)}/tree?${query}`,
    );
    if (tree.error) {
      throw new Error(`${tree.error.code}：${tree.error.message}`);
    }
    for (const node of tree.nodes ?? []) {
      if (typeof node.noteid !== "string") continue;
      out.push({
        noteid: node.noteid,
        title: node.title ?? "无标题",
        docPage: node.docPage ?? null,
      });
    }
    cursor = tree.nextCursor ?? null;
    if (!cursor) break;
  }
  return out;
}
