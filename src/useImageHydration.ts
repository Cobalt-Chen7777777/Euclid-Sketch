/**
 * 图片库补载：图形的 imgId 第一次出现（比如恢复上次的画布）时，
 * 把 IndexedDB 里的原图取出来建成 objectURL，建好再重绘一次。
 */
import { useEffect, useState } from "react";

import type { ImageShape, Shape } from "./model/types";
import { hydrateImageUrls } from "./io/imageStore";

export function useImageHydration(shapes: Shape[]): number {
  const [version, bump] = useState(0);

  useEffect(() => {
    const ids = shapes
      .filter((s): s is ImageShape => s.type === "image" && !!s.imgId)
      .map((s) => s.imgId as string);
    if (ids.length === 0) return;
    // 不要因为 effect 重跑就吞掉这次结果：第一次已经建好的 URL 会让第二次直接返回 false，
    // 两下一抵消就永远不会重绘（图片刷新后空白就是这个）
    void hydrateImageUrls(ids).then((changed) => {
      if (changed) bump((n) => n + 1);
    });
  }, [shapes]);

  return version;
}
