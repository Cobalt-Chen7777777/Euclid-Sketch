/**
 * 历史记录：顶部栏的按钮 + 覆盖面板的弹窗。
 * 弹窗必须挂在面板根（.panel）而不是顶部栏里——顶部栏有 transform，会让 fixed/absolute 的定位基准缩小。
 */
import { HistoryIcon } from "../icons";
import type { SketchDocument } from "../model/types";
import { listSnapshots } from "../useDocAutosave";

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
      <HistoryIcon size={14} />
    </button>
  );
}

interface DialogProps {
  open: boolean;
  list: { step: number; count: number }[];
  currentCount: number;
  onJump: (n: number) => void;
  onClose: () => void;
  onRestore: ((doc: SketchDocument) => void) | undefined;
}

export function HistoryDialog({ open, list, currentCount, onJump, onClose, onRestore }: DialogProps) {
  if (!open) return null;
  const snaps = listSnapshots();

  return (
    <div className="hist-mask" onClick={onClose}>
      <div className="hist-panel" onClick={(e) => e.stopPropagation()}>
        <div className="hist-head">
          <b>历史记录</b>
          <button type="button" className="chip" onClick={onClose}>关闭</button>
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
            <p className="hist-snap-title">上次关闭前的画布{snaps.length > 3 ? `（最近 3 份 / 共 ${snaps.length} 份）` : ""}</p>
            <ul className="hist-list">
              {snaps.slice(0, 3).map((s) => (
                <li key={s.ts}>
                  <span>{new Date(s.ts).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replace("/", "/")}</span>
                  <em>{s.count} 个图形</em>
                  <button type="button" className="chip" onClick={() => { onRestore?.(s.doc); onClose(); }}>恢复</button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
