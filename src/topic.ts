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
  /** 打开中的文档（focused=true 为当前文档） */
  documents?: Array<{
    bookmd5?: string;
    page?: number;
    focused?: boolean;
  }>;
  /** 学习集（键名实测为 topicid，不是 id） */
  studySet?: { topicid?: string };
  /** 焦点卡：官方实测基本恒为 null，不可依赖，仅作尝试 */
  focusedNote?: string;
  /** 用户在脑图里点选的卡（实测也常为空数组，仅作尝试） */
  selectedNotes?: string[];
}

interface DocumentExcerpts {
  items?: Array<{ noteid?: string; cardNoteId?: string; page?: number }>;
}

/**
 * 从当前打开的文档页反查题目卡：文档摘要里 page === 当前页的摘录卡。
 * 这是不依赖模板菜单的自动兜底——用户在做当前页的题时，该页的摘录卡就是目标卡。
 */
export async function inferTargetFromPage(): Promise<string | null> {
  try {
    const ctx = await mn.api<AppContext>("/context");
    if (ctx.error || ctx.available === false) return null;
    const doc = (ctx.documents ?? []).find((d) => d.focused) ?? (ctx.documents ?? [])[0];
    if (!doc?.bookmd5 || typeof doc.page !== "number") return null;
    const res = await mn.api<DocumentExcerpts>(
      `/documents/${encodeURIComponent(doc.bookmd5)}/excerpts`,
    );
    if (res.error) return null;
    const samePage = (res.items ?? []).filter(
      (x) => typeof x.cardNoteId === "string" && x.cardNoteId && x.page === doc.page,
    );
    return samePage.length > 0 ? samePage[samePage.length - 1]!.cardNoteId! : null;
  } catch {
    return null;
  }
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
      const topicid = typeof ctx.studySet?.topicid === "string" ? ctx.studySet.topicid : null;
      const selected = Array.isArray(ctx.selectedNotes) ? ctx.selectedNotes.find((n) => typeof n === "string" && n) : undefined;
      const focusNoteid = selected ?? (typeof ctx.focusedNote === "string" && ctx.focusedNote ? ctx.focusedNote : null);
      if (topicid || focusNoteid) return { topicid, focusNoteid };
    }
  } catch {
    // /context 不可用，回退 ui-state
  }
  const state = await mn.api<UiState>("/ui-state");
  if (state.error) {
    throw new Error(`${state.error.code}：${state.error.message}`);
  }
  const raw = (state.state ?? {}) as Record<string, unknown>;
  const pickNote = (): string | null => {
    for (const key of ["focusnoteid", "focusNoteid", "focusedNote", "currentNoteid"]) {
      if (typeof raw[key] === "string" && raw[key]) return raw[key] as string;
    }
    const sel = raw["selectedNotes"];
    if (Array.isArray(sel)) {
      const first = sel.find((n) => typeof n === "string" && n);
      if (first) return first as string;
    }
    return null;
  };
  return {
    topicid: typeof raw["topicid"] === "string" ? (raw["topicid"] as string) : null,
    focusNoteid: pickNote(),
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
