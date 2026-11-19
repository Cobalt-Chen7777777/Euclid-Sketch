export interface Card {
  noteid: string;
  title: string;
  docPage: number | null;
}

interface UiState {
  state?: {
    topicid?: string;
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

export async function getCurrentTopic(): Promise<string | null> {
  const state = await mn.api<UiState>("/ui-state");
  if (state.error) {
    throw new Error(`${state.error.code}：${state.error.message}`);
  }
  return state.state?.topicid ?? null;
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
