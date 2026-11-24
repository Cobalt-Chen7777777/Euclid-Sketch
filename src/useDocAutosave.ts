/* eslint-disable no-restricted-globals, no-restricted-syntax -- 需要监听 pagehide / visibilitychange 保证关闭前落盘 */
/** 画布自动保存：doc 变化防抖 1.2s 写入；图形数量变化时额外留一份历史快照 */
import { useEffect } from "react";

import { pushSnapshot, saveDoc } from "./io/autosave";

export { loadDoc, listSnapshots } from "./io/autosave";
import type { SketchDocument } from "./model/types";

export function useDocAutosave(doc: SketchDocument) {
  useEffect(() => {
    const t = setTimeout(() => saveDoc(doc), 1200);
    return () => clearTimeout(t);
  }, [doc]);

  // 关面板 / 切到后台：立刻写一次，快照里就能看到「上次关闭前」
  useEffect(() => {
    const flush = () => { saveDoc(doc); pushSnapshot(doc); };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [doc]);

  // 结构性变化（图形增减）留档，间隔 3 秒；拖动属性微调不触发
  useEffect(() => {
    const t = setTimeout(() => pushSnapshot(doc), 3000);
    return () => clearTimeout(t);
    // 只按图形数量触发，属性微调不重复存档
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.shapes.length]);
}
