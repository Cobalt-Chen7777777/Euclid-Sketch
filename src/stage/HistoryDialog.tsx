/**
 * 历史记录：顶部栏的按钮 + 覆盖面板的弹窗。
 * 弹窗必须挂在面板根（.panel）而不是顶部栏里——顶部栏有 transform，会让 fixed/absolute 的定位基准缩小。
 *
 * 两段：
 *   - 撤销步骤：本次会话的操作链，只能整段清空（步骤是链式的，删中间一段会让前后对不上）
 *   - 关闭前快照：整份存档，可单独恢复或删除
 */
import { useState } from "react";

import { HistoryIcon } from "../icons";
import type { SketchDocument } from "../model/types";
import { clearSnapshots, listSnapshots, removeSnapshot } from "../useDocAutosave";

interface ButtonProps {
  count: number;
  onOpen: () => void;
}

export function HistoryButton({ count, onOpen }: ButtonProps) {
  return (
    <button
      type="button"
      className="history-btn"
      onClick={onOpen}
      aria-label="历史记录"
      title={count ? "历史记录（" + count + " 步）" : "历史记录 / 上次画布"}
    >
      <HistoryIcon size={15} />
    </button>
  );
}

interface DialogProps {
  open: boolean;
  list: { step: number; count: number }[];
  currentCount: number;
  /** 当前画布内容：用来过滤掉「和当前一模一样」的快照，避免它跟「当前」那行重复 */
  currentShapes?: unknown;
  onJump: (n: number) => void;
  onClose: () => void;
  onRestore: ((doc: SketchDocument) => void) | undefined;
  /** 清空本次会话的撤销步骤（画布内容不变） */
  onClearHistory?: () => void;
  /** 清空「关闭前快照」 */
  onClearSnapshots?: () => void;
}

export function HistoryDialog({
  open, list, currentCount, currentShapes, onJump, onClose, onRestore, onClearHistory, onClearSnapshots,
}: DialogProps) {
  // 删除快照后强制重渲染（快照存在 localStorage，不在 React 状态里）
  const [, setTick] = useState(0);
  if (!open) return null;
  const currentKey = currentShapes === undefined ? null : JSON.stringify(currentShapes);
  const seen = new Set<string>();
  const snaps = listSnapshots().filter((s2) => {
    const key = JSON.stringify(s2.doc.shapes);
    if (key === currentKey) return false;   // 和当前画布一模一样 → 不算「上次关闭的画布」
    if (seen.has(key)) return false;        // 历史里重复的存档只留最新一条
    seen.add(key);
    return true;
  });

  const dropSnapshot = (ts: number) => {
    removeSnapshot(ts);
    setTick((n) => n + 1);
  };

  const wipeSnapshots = () => {
    clearSnapshots();
    onClearSnapshots?.();
    setTick((n) => n + 1);
  };

  return (
    <div className="hist-mask" onClick={onClose}>
      <div className="hist-panel" onClick={(e) => e.stopPropagation()}>
        <div className="hist-head">
          <b>历史记录</b>
          <span className="hist-head-actions">
            {list.length > 0 && onClearHistory ? (
              <button type="button" className="chip danger" onClick={() => {
                onClearHistory();
                onClose();
              }}>清空步骤</button>
            ) : null}
            <button type="button" className="chip" onClick={onClose}>关闭</button>
          </span>
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
                <button type="button" className="chip" onClick={() => onJump(back)}>回到这里</button>
              </li>
            );
          })}
        </ol>

        {list.length === 0 ? <p className="hist-empty">本次还没有操作记录；如果有「上次关闭插件前的画布」，会列在下面</p> : null}

        {snaps.length > 0 ? (
          <div className="hist-snaps">
            <p className="hist-snap-title">
              上次关闭前的画布（共 {snaps.length} 份）
              <button type="button" className="chip danger" onClick={wipeSnapshots}>全部删除</button>
            </p>
            <ul className="hist-list">
              {snaps.map((s) => (
                <li key={s.ts} className="hist-snap-row">
                  <span>{new Date(s.ts).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <em>{s.count} 个图形</em>
                  <button type="button" className="chip" onClick={() => { onRestore?.(s.doc); onClose(); }}>恢复</button>
                  <button type="button" className="chip danger" aria-label="删除这份存档" title="删除这份存档"
                    onClick={() => dropSnapshot(s.ts)}>删除</button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
