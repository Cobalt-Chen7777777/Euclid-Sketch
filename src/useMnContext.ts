/**
 * MN 上下文初始化：学习集 + 焦点卡 + 能力探测。
 * 写入/导入的目标卡 = 用户正在看的焦点卡（GET /context focusedNote）。
 *
 * 关键时序：先立即用焦点卡确定 targetCard（不等列表），
 * 卡片列表后台加载（大学习集拉全很慢，不能阻塞目标卡确定）。
 * 顶栏「同步」按钮调 refresh()：用户在 MN 里换了卡后点一下即可对齐。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { getCapabilities, hasImageWriteCapability, focusCard } from "./bridge";
import { getCurrentContext, inferTargetFromPage, listCards, type Card } from "./topic";

/** 卡片事件的回调集（App 每轮传入，内部用 ref 存储避免重复注册监听） */
export interface CardEventHandlers {
  /** 卡片菜单命令：id 为命令 id（annotate / import-image / set-target） */
  onCommand?: (id: string | undefined, noteid: string) => void;
  /** 新摘录产生的卡 */
  onExcerpt?: (noteid: string) => void;
}

export function useMnContext(
  onToast: (msg: string) => void,
  handlers: CardEventHandlers = {},
) {
  const [topic, setTopic] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [targetCard, setTargetCard] = useState("");
  const [canWriteImage, setCanWriteImage] = useState(false);
  /** 最新 targetCard 的镜像，供轮询比对（避免闭包读旧值） */
  const targetRef = useRef("");
  useEffect(() => { targetRef.current = targetCard; }, [targetCard]);
  /** 用户手动指定的卡（卡片菜单命令）：15 秒内不被自动跟随抢走 */
  const manualRef = useRef<{ nid: string; at: number } | null>(null);
  /** 轮询在途标记：避免请求堆积 */
  const busyRef = useRef(false);

  // 监听只注册一次，回调通过 ref 取最新值（否则每轮重渲染都会累积监听器）
  const handlersRef = useRef(handlers);
  useEffect(() => { handlersRef.current = handlers; });
  useEffect(() => {
    if (typeof mn === "undefined" || typeof mn.on !== "function") return;
    mn.on("cardCommand", (data: unknown) => {
      const d = data as { id?: string; noteID?: string };
      if (d?.noteID) handlersRef.current.onCommand?.(d.id, d.noteID);
    });
    mn.on("excerpt", (data: unknown) => {
      const d = data as { noteid?: string; noteID?: string };
      const nid = d?.noteid ?? d?.noteID;
      if (nid) handlersRef.current.onExcerpt?.(nid);
    });
  }, []);

  /** 手动同步：重读 /context 并对齐目标卡（焦点卡 → 当前页推断 → 无）；返回命中的卡 id */
  const refresh = useCallback(async (): Promise<string | null> => {
    manualRef.current = null;
    const { topicid, focusNoteid } = await getCurrentContext();
    if (topicid) setTopic(topicid);
    if (topicid) {
      // 后台刷新列表（不阻塞目标卡设置）
      listCards(topicid).then((items) => setCards(items)).catch(() => {});
    }
    const nid = focusNoteid ?? (await inferTargetFromPage());
    if (nid) {
      setTargetCard(nid);
      return nid;
    }
    return null;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { topicid, focusNoteid } = await getCurrentContext();
        if (!active) return;
        setTopic(topicid);
        // 目标卡优先级：焦点卡 → 当前文档页的摘录卡（不依赖模板菜单的兜底）→ 列表第一张
        let nid = focusNoteid;
        if (!nid) nid = await inferTargetFromPage();
        if (!active) return;
        if (nid) setTargetCard((cur) => cur || nid);
        if (topicid) {
          const items = await listCards(topicid);
          if (!active) return;
          setCards(items);
          if (!nid) setTargetCard((cur) => cur || items[0]?.noteid || "");
        }
        const caps = await getCapabilities();
        if (!active) return;
        setCanWriteImage(await hasImageWriteCapability(caps));
        if (!focusNoteid && !nid) {
          onToast("未检测到目标卡：在 MN 里摘录/点开题目后会自动跟随；也可用卡片菜单命令或顶栏「同步」");
        }
      } catch (e: unknown) {
        onToast(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [onToast]);

  /** 静默跟随：每 700ms 读一次焦点卡，变了才 setTargetCard（不 toast、不打断操作） */
  const followFocus = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      // 只读 /context：页面推断会多读一次文档树，延迟高几百毫秒，轮询路径不用
      const { focusNoteid } = await getCurrentContext();
      const nid = focusNoteid;
      if (!nid || nid === targetRef.current) return;
      const lock = manualRef.current;
      if (lock && Date.now() - lock.at < 15000 && lock.nid !== nid) return;
      setTargetCard(nid);
    } catch {
      // 静默：跟随失败不影响正常使用
    } finally {
      busyRef.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => { void followFocus(); }, 700);
    return () => clearInterval(timer);
  }, [followFocus]);

  /** 手动指定目标卡（卡片菜单命令）：短暂锁定，避免被自动跟随覆盖 */
  const lockTarget = useCallback((nid: string) => {
    manualRef.current = { nid, at: Date.now() };
    setTargetCard(nid);
  }, []);

  /** 卡片导航：按当前学习集的卡片顺序前后跳，并定位到该卡 */
  const gotoCard = useCallback(async (step: number) => {
    if (cards.length === 0) {
      onToast("当前学习集里没有卡片");
      return;
    }
    const current = cards.findIndex((c) => c.noteid === targetCard);
    const index = current < 0 ? (step > 0 ? 0 : cards.length - 1) : (current + step + cards.length) % cards.length;
    const card = cards[index];
    if (!card) return;
    setTargetCard(card.noteid);
    try {
      const res = await focusCard(card.noteid, topic ?? undefined);
      onToast(res.ok ? `${index + 1}/${cards.length} · ${card.title}` : `跳转失败：${res.error ?? ""}`);
    } catch (e) {
      onToast(`跳转失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  }, [cards, targetCard, topic, setTargetCard, onToast]);

  return { topic, cards, targetCard, setTargetCard, canWriteImage, refresh, gotoCard, lockTarget };
}
