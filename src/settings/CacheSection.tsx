/** 缓存管理：查看本机占用，清理画布自动保存与历史快照（设置本身不动） */
import { useState } from "react";

import { ChevronIcon, InfoIcon } from "../icons";

const PREFIX = "mathsketch.";

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 统计 mathsketch.* 键的总字符数与分项 */
function scan(): { total: number; doc: number; snaps: number; settings: number; keys: number } {
  let total = 0;
  let doc = 0;
  let snaps = 0;
  let settings = 0;
  let keys = 0;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i) ?? "";
      if (!k.startsWith(PREFIX)) continue;
      const v = localStorage.getItem(k) ?? "";
      const size = k.length + v.length;
      total += size;
      keys += 1;
      if (k.includes("doc.")) doc += size;
      else if (k.includes("snapshots.")) snaps += size;
      else settings += size;
    }
  } catch {
    // 隐私模式下不可读
  }
  return { total, doc, snaps, settings, keys };
}

export function CacheSection() {
  const [info, setInfo] = useState(() => scan());
  const [msg, setMsg] = useState("");

  const refresh = () => { setInfo(scan()); };

  const clearCanvas = () => {
    try {
      for (let i = localStorage.length - 1; i >= 0; i -= 1) {
        const k = localStorage.key(i) ?? "";
        if (k.includes("doc.") || k.includes("snapshots.")) localStorage.removeItem(k);
      }
      setMsg("已清除画布缓存（当前画布与历史快照）");
    } catch {
      setMsg("清除失败：当前环境不允许写本地存储");
    }
    refresh();
  };

  return (
    <div className="set-row tappable" onClick={refresh}>
      <span className="set-tile"><InfoIcon /></span>
      <span className="set-text">
        <b>缓存管理</b>
        <small>
          共 {human(info.total)}（{info.keys} 项）· 画布 {human(info.doc)} · 快照 {human(info.snaps)} · 设置 {human(info.settings)}
        </small>
        {msg ? <small className="cache-msg">{msg}</small> : null}
        <span className="chips">
          <button type="button" className="chip danger" onClick={(e) => { e.stopPropagation(); clearCanvas(); }}>
            清除画布缓存
          </button>
        </span>
      </span>
      <span className="set-trail"><span className="set-chevron"><ChevronIcon /></span></span>
    </div>
  );
}
