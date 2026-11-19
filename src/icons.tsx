/**
 * 工具图标集：统一 24×24 线性风格，用 currentColor 继承按钮文字色，
 * 选中态由 CSS 改色即可。不依赖图标库，避免增大插件包体积。
 */
interface IconProps {
  size?: number;
}

/** 选择：箭头光标 */
export function CursorIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 3 L5 19 L9.5 14.5 L12.5 21 L15.5 19.5 L12.5 13.5 L19 13 Z" />
    </svg>
  );
}

/** 画笔：铅笔 */
export function PenIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21 L4 16 L16 4 L20 8 L8 20 Z" />
      <path d="M3 21 L8 20" />
      <path d="M14 6 L18 10" />
    </svg>
  );
}

/** 橡皮擦 */
export function EraserIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4 L20 17 L14 22 L2 10 Z" />
      <path d="M6.5 9.5 L14.5 17.5" />
    </svg>
  );
}

/** 圆规 */
export function CompassIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="4" r="2" />
      <path d="M11 6 L7.5 21 M13 6 L16.5 21" />
      <path d="M7.5 21 L5 21 M16.5 21 L19 21" />
    </svg>
  );
}

/** 绘制图元：几何形状叠加 */
export function ShapesIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="12" height="12" rx="1.5" />
      <circle cx="15" cy="15" r="6" />
    </svg>
  );
}

/** 画角度：两条边 + 标注弧 */
export function AngleIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19 L20 19" />
      <path d="M4 19 L18.5 6.5" />
      <path d="M13 19 A 9 9 0 0 0 10.4 12.6" />
    </svg>
  );
}

/** 平移：四向箭头 */
export function PanIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 L12 21 M3 12 L21 12" />
      <path d="M12 3 L9 6 M12 3 L15 6 M12 21 L9 18 M12 21 L15 18" />
      <path d="M3 12 L6 9 M3 12 L6 15 M21 12 L18 9 M21 12 L18 15" />
    </svg>
  );
}

/** 锁定半径：挂锁 */
export function LockIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10 L8 7 A4 4 0 0 1 16 7 L16 10" />
      <circle cx="12" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 导入：向下箭头入托盘 */
export function ImportIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 L12 15 M12 15 L8 11 M12 15 L16 11" />
      <path d="M4 17 L4 20 L20 20 L20 17" />
    </svg>
  );
}

/** 导出：向上箭头出托盘 */
export function ExportIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16 L12 4 M12 4 L8 8 M12 4 L16 8" />
      <path d="M4 17 L4 20 L20 20 L20 17" />
    </svg>
  );
}

/** 图片：PNG 导出 */
export function ImageIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="M4 18 L9 12 L13 16 L16 13 L20 18" />
    </svg>
  );
}

/** 重置：循环箭头 */
export function ResetIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 11 A8 8 0 1 0 18 17" />
      <path d="M20 4 L20 11 L13 11" />
    </svg>
  );
}

/** 写入：文档加笔 */
export function WriteIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 4 L14 4 L18 8 L18 20 L6 20 Z" />
      <path d="M14 4 L14 8 L18 8" />
      <path d="M9 14 L15 12 M9 17 L14 15" />
    </svg>
  );
}

/** 网格：田字格 */
export function GridIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2.5" />
      <path d="M3 9.5 L21 9.5 M3 15 L21 15 M9.5 3 L9.5 21 M15 3 L15 21" />
    </svg>
  );
}

/** 刻度：带刻线的坐标轴 */
export function RulerIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 20 L21 20 M3 20 L3 4" />
      <path d="M6 20 L6 16 M10 20 L10 17 M14 20 L14 16 M18 20 L18 17" />
      <path d="M3 12 L7 12 M3 8 L6 8 M3 16 L7 16" />
    </svg>
  );
}

/** 吸附：磁铁 */
export function MagnetIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4 L5 13 A7 7 0 0 0 19 13 L19 4" />
      <path d="M5 9 L9 9 M15 9 L19 9" />
    </svg>
  );
}

/** 平滑：波浪线 */
export function SmoothIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 15 C6 6, 9 18, 12 12 S18 6, 21 14" />
    </svg>
  );
}

/** 线宽：三条粗细不同的线 */
export function StrokeWidthIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6 L20 6" strokeWidth={1} />
      <path d="M4 12 L20 12" strokeWidth={2.4} />
      <path d="M4 18.5 L20 18.5" strokeWidth={4} />
    </svg>
  );
}

/** 多边形：五边形 */
export function PolygonIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.2 L20.4 9.3 L17.2 19.2 L6.8 19.2 L3.6 9.3 Z" />
    </svg>
  );
}

/** 调色板 */
export function PaletteIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 A9 9 0 1 0 12 21 C14 21 14.6 19.6 13.6 18.4 C12.6 17.2 13.4 15.6 15 15.6 L17.4 15.6 C19.5 15.6 21 14.1 21 12 A9 9 0 0 0 12 3 Z" />
      <circle cx="8.2" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.8" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 窗口：缩放框 */
export function WindowIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="15" rx="2.5" />
      <path d="M3 9.5 L21 9.5" />
      <path d="M14 14 L18 14 M18 14 L18 18" />
    </svg>
  );
}

/** 信息 */
export function InfoIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11 L12 16.5" />
      <circle cx="12" cy="7.8" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 左向箭头：上一张 */
export function ChevronLeftIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14.5 5.5 L8 12 L14.5 18.5" strokeWidth={2.2} />
    </svg>
  );
}

/** 右向箭头：下一张 */
export function ChevronRightIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9.5 5.5 L16 12 L9.5 18.5" strokeWidth={2.2} />
    </svg>
  );
}

/** 右向箭头：可点行尾 */
export function ChevronIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5 L16 12 L9 19" />
    </svg>
  );
}

/** 设置：齿轮 */
export function GearIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8 L12 6 M12 18 L12 21.2 M2.8 12 L6 12 M18 12 L21.2 12 M5.5 5.5 L7.8 7.8 M16.2 16.2 L18.5 18.5 M18.5 5.5 L16.2 7.8 M7.8 16.2 L5.5 18.5" />
    </svg>
  );
}

/** 收起：向下箭头落到一条底线（最小化到底部迷你条） */
export function MinimizeIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 10.5 L12 16 L18 10.5" />
      <path d="M5.5 19.5 L18.5 19.5" />
    </svg>
  );
}

/** 关闭 */
export function CloseIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 6 L18 18 M18 6 L6 18" />
    </svg>
  );
}

/** 选项/滑杆：三条带把手的横线 */
export function SlidersIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7 L20 7 M4 12 L20 12 M4 17 L20 17" />
      <circle cx="9" cy="7" r="2.1" fill="var(--surface, #fff)" />
      <circle cx="15" cy="12" r="2.1" fill="var(--surface, #fff)" />
      <circle cx="8" cy="17" r="2.1" fill="var(--surface, #fff)" />
    </svg>
  );
}

/** 退格 */
export function DeleteIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 5h11a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H9L3 12z" />
      <path d="M12 9.5l5 5M17 9.5l-5 5" />
    </svg>
  );
}

/** 套索：虚线套圈 */
export function LassoIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4.5 12c0-3.6 3.4-6.5 7.5-6.5s7.5 2.9 7.5 6.5-3.4 6.5-7.5 6.5c-1.8 0-3.4-.5-4.7-1.4" strokeDasharray="3 2.6" />
      <path d="M4.5 12c0 1.9 1 3.6 2.6 4.8L4 20" />
    </svg>
  );
}

/** 线段工具 */
export function LineToolIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
      <path d="M5 19 L19 5" />
      <circle cx="5" cy="19" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="5" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 点工具 */
export function PointToolIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.9} aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="7" opacity={0.45} />
    </svg>
  );
}

/** 圆工具 */
export function CircleToolIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.9} aria-hidden="true">
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 公式：Σ */
export function SigmaIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.5 5 L7 5 L12.5 12 L7 19 L17.5 19" />
    </svg>
  );
}

export type ToolIconName = "select" | "pen" | "eraser" | "compass" | "place" | "angle" | "lasso" | "line" | "point" | "circle" | "image" | "lock";
/** 按名称取工具栏图标 */
export function ToolIcon({ name, size = 20 }: { name: ToolIconName; size?: number }) {
  switch (name) {
    case "select": return <CursorIcon size={size} />;
    case "pen": return <PenIcon size={size} />;
    case "eraser": return <EraserIcon size={size} />;
    case "compass": return <CompassIcon size={size} />;
    case "place": return <ShapesIcon size={size} />;
    case "angle": return <AngleIcon size={size} />;
    case "lasso": return <LassoIcon size={size} />;
    case "line": return <LineToolIcon size={size} />;
    case "point": return <PointToolIcon size={size} />;
    case "circle": return <CircleToolIcon size={size} />;
    case "image": return <ImageIcon size={size} />;
    case "lock": return <LockIcon size={size} />;
  }
}

/** 展开：向上箭头离开一条顶线（迷你条展开面板） */
export function ExpandIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 13.5 L12 8 L18 13.5" />
      <path d="M5.5 4.5 L18.5 4.5" />
    </svg>
  );
}

/** 加号：图片放大 */
export function PlusIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
      <path d="M12 5 L12 19 M5 12 L19 12" />
    </svg>
  );
}

/** 减号：图片缩小 */
export function MinusIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
      <path d="M5 12 L19 12" />
    </svg>
  );
}

/** 适应大小：四角向外的箭头 */
export function FitIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 4.5 L4.5 4.5 L4.5 9" />
      <path d="M15 4.5 L19.5 4.5 L19.5 9" />
      <path d="M9 19.5 L4.5 19.5 L4.5 15" />
      <path d="M15 19.5 L19.5 19.5 L19.5 15" />
    </svg>
  );
}

/** 复制：两个叠放的方框 */
export function CopyIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.4" />
      <path d="M15.5 5.5 V4.8 A2 2 0 0 0 13.5 2.8 H4.8 A2 2 0 0 0 2.8 4.8 V13.5 A2 2 0 0 0 4.8 15.5 H5.5" />
    </svg>
  );
}

/** 品牌徽章：圆 + 圆规双翼（欧几里得作图意象），内联 SVG 不依赖资源路径 */
export function BrandIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="11.5" r="7.5" opacity={0.9} />
      <path d="M12 3.2 L17.4 19.6 M12 3.2 L6.6 19.6" />
      <circle cx="12" cy="3.2" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
