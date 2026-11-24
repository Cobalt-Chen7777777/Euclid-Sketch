/**
 * 历史记录：撤销按钮旁的小按钮 + 弹窗列表。
 * 每行显示「第 N 步 · 当时图形数」，点一下直接回到那一步（比连按撤销省事）。
 */
import { useState } from "react";

import { HistoryIcon } from "../icons";
import type { SketchDocument } from "../model/types";
import { listSnapshots } from "../useDocAutosave";

interface Props {
  list: { step: number; count: number }[];
  /** 当前画布上的图形数量（列表首行） */
  currentCount: number;
  /** 回退 n 步 */
  onJump: (n: number) => void;
  /** 恢复某份历史存档（关闭插件前自动留下的） */
  onRestore: ((doc: SketchDocument) => void) | undefined;
}

export function HistoryButton({ list, currentCount, onJump, onRestore }: Props) {
  const [open, setOpen] = useState(false);
  const snaps = open ? listSnapshots() : [];

  return (
    <>
      <button
        type="button"
        className="history-btn"
        disabled={list.length === 0}
        onClick={() => setOpen(true)}
        aria-label="历史记录"
        title={list.length ? `历史记录（${list.length} 步）` : "还没有历史记录"}
      >
        <HistoryIcon size={14} />
      </button>

      {open ? (
        <div className="hist-mask" onClick={() => setOpen(false)}>
          <div className="hist-panel" onClick={(e) => e.stopPropagation()}>
            <div className="hist-head">
              <b>历史记录</b>
              <button type="button" className="chip" onClick={() => setOpen(false)}>关闭</button>
            </div>
            <ol className="hist-list">
              <li className="hist-now">
                <span>当前</span>
                <em>{currentCount} 个图形</em>
              </li>
              {[...list].reverse().map((h) => {
                const back = list.length - h.step + 1;
                return (
                  <li key={h.step}>
                    <span>第 {h.step} 步</span>
                    <em>{h.count} 个图形</em>
                    <button type="button" className="chip" onClick={() => { onJump(back); setOpen(false); }}>回到这里</button>
                  </li>
                );
              })}
            </ol>
            {list.length === 0 ? <p className="hist-empty">还没有历史记录，画几笔再来看</p> : null}
            {snaps.length > 0 ? (
              <div className="hist-snaps">
                <p className="hist-snap-title">上次关闭插件前的画布</p>
                <ul className="hist-list">
                  {snaps.map((s) => (
                    <li key={s.ts}>
                      <span>{new Date(s.ts).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      <em>{s.count} 个图形</em>
                      <button type="button" className="chip" onClick={() => { onRestore?.(s.doc); setOpen(false); }}>恢复</button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
