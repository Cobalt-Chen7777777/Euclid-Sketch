/**
 * MN 上下文初始化：学习集 + 焦点卡 + 能力探测。
 * 写入/导入的目标卡 = 用户正在看的焦点卡（GET /context focusedNote），
 * 而不是学习集列表第一张。
 */
import { useEffect, useState } from "react";

import { getCapabilities, hasImageWriteCapability } from "./bridge";
import { getCurrentContext, listCards, type Card } from "./topic";

export function useMnContext(onToast: (msg: string) => void) {
  const [topic, setTopic] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [targetCard, setTargetCard] = useState("");
  const [canWriteImage, setCanWriteImage] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentContext()
      .then(async ({ topicid, focusNoteid }) => {
        if (!active) return;
        setTopic(topicid);
        if (topicid) {
          const items = await listCards(topicid);
          if (!active) return;
          setCards(items);
          setTargetCard((cur) => cur || focusNoteid || items[0]?.noteid || "");
        } else if (focusNoteid) {
          setTargetCard((cur) => cur || focusNoteid);
        }
        const caps = await getCapabilities();
        if (!active) return;
        setCanWriteImage(await hasImageWriteCapability(caps));
      })
      .catch((e: unknown) => onToast(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [onToast]);

  return { topic, cards, targetCard, setTargetCard, canWriteImage };
}
