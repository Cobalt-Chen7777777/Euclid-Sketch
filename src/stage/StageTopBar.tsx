import { BroomIcon, CanvasBlankIcon, CanvasGridIcon, CopyIcon, LayersIcon } from "../icons";

/**
 * 画布顶部悬浮条：2D/函数/3D 切换 + 撤销重做 + 写入 + 目标卡指示。
 */
import type { Card } from "../topic";
import { HistoryButton } from "./HistoryDialog";
import { HistoryButtons } from "./HistoryButtons";

interface Props {
  tab: string;
  onTabChange: (tab: "2d" | "fn" | "3d") => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** 历史记录：步号摘要 + 回退 */
  history?: { list: { step: number; count: number }[]; count: number; onOpen: () => void };
  onWrite: () => void;
  onSyncTarget: () => void;
  cards: Card[];
  targetCard: string;
  topic: string | null;
  /** 画布背景（坐标系/空白）与切换 */
  canvasBg: "coord" | "blank";
  onCanvasBg: (bg: "coord" | "blank") => void;
  /** 一键清空画布图形 */
  onClearShapes: () => void;
  /** 打开图形清单浮层（参数是按钮位置，浮层贴着它弹） */
  onOpenShapes?: (rect: DOMRect) => void;
}

/** 目标卡指示文案：列表内显示序号/总数/标题，列表外显示短 id */
function targetLabel(cards: Card[], targetCard: string): string {
  if (!targetCard) return "未选卡 · 点此同步";
  const idx = cards.findIndex((c) => c.noteid === targetCard);
  const card = cards[idx];
  if (idx < 0 || !card) return `目标卡 …${targetCard.slice(-6)} · 点此同步`;
  return `${idx + 1}/${cards.length} · ${card.title} · 点此同步`;
}

export function StageTopBar({
  tab, onTabChange, canUndo, canRedo, onUndo, onRedo, history, onWrite, onSyncTarget, cards, targetCard, topic,
  canvasBg, onCanvasBg, onClearShapes, onOpenShapes,
}: Props) {
  const is2d = tab !== "3d";
  return (
    <div className="stage-top">
      <div className="seg" role="group" aria-label="绘制模式">
        <button className={tab === "2d" ? "on" : ""} onClick={() => onTabChange("2d")}>2D</button>
        <button className={tab === "fn" ? "on" : ""} onClick={() => onTabChange("fn")}>函数</button>
        <button className={tab === "3d" ? "on" : ""} onClick={() => onTabChange("3d")}>3D</button>
      </div>
      {is2d ? <HistoryButtons canUndo={canUndo} canRedo={canRedo} onUndo={onUndo} onRedo={onRedo} /> : null}
      {is2d ? (
        <button type="button" className="write-btn" onClick={() => onCanvasBg(canvasBg === "coord" ? "blank" : "coord")}
          aria-label={canvasBg === "coord" ? "切换为空白画布" : "切换为坐标系画布"}
          title={canvasBg === "coord" ? "当前：坐标系画布，点击切换为空白" : "当前：空白画布，点击切换为坐标系"}
        >
          {/* 图标跟着当前背景走：有网格就画网格，空白就画一张没有网格的纸 */}
          {canvasBg === "coord" ? <CanvasGridIcon size={15} /> : <CanvasBlankIcon size={15} />}
        </button>
      ) : null}
      {is2d && onClearShapes ? (
        <button type="button" className="write-btn" onClick={onClearShapes}
          aria-label="清空画布图形" title="一键清空画布上的所有图形（不含坐标系）"
        ><BroomIcon size={15} /></button>
      ) : null}
      {is2d && onOpenShapes ? (
        <button type="button" className="write-btn" onClick={(ev) => onOpenShapes(ev.currentTarget.getBoundingClientRect())}
          aria-label="图形清单" title="图形清单：选中 / 隐藏 / 删除画布上的图形"
        ><LayersIcon size={15} /></button>
      ) : null}
      {is2d && history ? <HistoryButton count={history.list.length} onOpen={history.onOpen} /> : null}
      {is2d ? (
        <button type="button" className="write-btn" onClick={onWrite} aria-label="复制草图图片" title="复制草图图片：到 MN 卡片批注长按粘贴（不写文字，不会污染卡片图）">
          <CopyIcon size={15} />
        </button>
      ) : null}
      {cards.length > 0 || targetCard ? (
        <button
          type="button"
          className="stage-topic"
          onClick={onSyncTarget}
          title="点击同步：把写入/导入的目标对齐到 MN 当前聚焦卡"
        >
          {targetLabel(cards, targetCard)}
        </button>
      ) : topic ? <span className="stage-topic">{topic}</span> : null}
    </div>
  );
}
