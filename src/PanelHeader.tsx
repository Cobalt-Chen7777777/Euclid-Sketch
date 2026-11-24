/**
 * 面板顶部：迷你条（收起态）+ 品牌行（含窗口控制）+ 主视图切换。
 *
 * 迷你模式的显隐由 CSS 负责（MN 会改 <html data-mode="mini">），
 * 这里不做状态判断，避免和宿主状态不同步。
 */
import {
  AngleIcon, BrandIcon, CircleToolIcon, CloseIcon, CopyIcon,
  ExpandIcon, ImageIcon, LineToolIcon, MinimizeIcon, PointToolIcon,
} from "./icons";

/** 迷你条上的图形快建：点一下就在视野中心生成，随后可在几何参数里精确改 */
const QUICK_SHAPES = [
  { id: "point", label: "快速画点", Icon: PointToolIcon },
  { id: "line", label: "快速画线段", Icon: LineToolIcon },
  { id: "circle", label: "快速画圆", Icon: CircleToolIcon },
  { id: "angle", label: "快速画角度", Icon: AngleIcon },
] as const;

export type PanelView = "canvas" | "settings";

interface Props {
  view: PanelView;
  onViewChange: (view: PanelView) => void;
  /** 收起为迷你条 */
  onCollapse: () => void;
  /** 从迷你条展开 */
  onExpand: () => void;
  /** 关闭面板 */
  onClose: () => void;
  /** 迷你条上的卡片导航（收起后仍可切卡） */
  onPrev?: () => void;
  onNext?: () => void;
  hasCards?: boolean;
  /** 迷你条图形快建：传图形 id（point / line / circle / angle） */
  onQuickShape?: (kind: string) => void;
  /** 迷你条快捷：复制整张草图 */
  onQuickCopy?: () => void;
  /** 迷你条快捷：把当前目标卡插进画布 */
  onQuickInsert?: () => void;
}

export function PanelHeader({
  view, onViewChange, onCollapse, onExpand, onClose, onQuickShape, onQuickCopy, onQuickInsert,
}: Props) {
  return (
    <>
      <div className="mini-bar">
        <span className="brand-badge" aria-hidden="true"><BrandIcon size={13} /></span>
        <span className="mini-title">Euclid Sketch</span>
        {(onQuickShape ? QUICK_SHAPES : []).map((s) => (
          <button key={s.id} type="button" className="mini-btn icon" onClick={() => onQuickShape?.(s.id)}
            aria-label={s.label} title={s.label}>
            <s.Icon size={16} />
          </button>
        ))}
        <span className="mini-spacer" />
        {onQuickInsert ? (
          <button type="button" className="mini-btn icon" onClick={onQuickInsert} aria-label="插入卡片图" title="插入卡片图">
            <ImageIcon size={16} />
          </button>
        ) : null}
        {onQuickCopy ? (
          <button type="button" className="mini-btn icon" onClick={onQuickCopy} aria-label="复制草图" title="复制草图">
            <CopyIcon size={16} />
          </button>
        ) : null}
        <button type="button" className="mini-btn icon" onClick={onExpand} aria-label="展开面板" title="展开">
          <ExpandIcon size={16} />
        </button>
        <button type="button" className="mini-btn icon" onClick={onClose} aria-label="关闭插件窗口" title="关闭">
          <CloseIcon size={15} />
        </button>
      </div>

      <header className="appbar">
        <div className="brand">
          <span className="brand-badge" aria-hidden="true"><BrandIcon size={13} /></span>
          <span className="brand-text">
            <b>Euclid Sketch</b>
            <small>数学模型构图</small>
          </span>
        </div>
        <div className="wincontrols">
          <button
            type="button" className="win-btn" onClick={onCollapse}
            aria-label="收起插件窗口" title="收起为迷你条"
          ><MinimizeIcon /></button>
          <button
            type="button" className="win-btn" onClick={onClose}
            aria-label="关闭插件窗口" title="关闭面板"
          ><CloseIcon /></button>
        </div>
      </header>

      <nav className="appnav full" aria-label="主视图">
        <button className={view === "canvas" ? "on" : ""} onClick={() => onViewChange("canvas")}>画布</button>
        <button className={view === "settings" ? "on" : ""} onClick={() => onViewChange("settings")}>设置</button>
      </nav>
    </>
  );
}
