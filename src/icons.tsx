/**
 * 工具图标集。
 *
 * 视觉规范：24×24 网格、1.75 描边、圆角端点与连接、四周留 2px 安全边，
 * 用 currentColor 继承按钮文字色（选中态交给 CSS）。
 *
 * 主体图形来自 Lucide（ISC 许可，https://lucide.dev）：
 *   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
 *   其余版权归 Lucide Contributors 2022，按 ISC 许可使用。
 * 角度 / 线宽 / 线段 / 椭圆 / 圆弧 / 曲线 / 品牌标记为本项目按同一网格自绘。
 */
import type { ReactNode } from "react";

interface IconProps {
  size?: number;
}

/** 统一外壳：所有图标共用同一套描边参数，保证视觉重量一致 */
function Glyph({ size = 20, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      {children}
    </svg>
  );
}


/** 选择：箭头光标 */
export function CursorIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z" />
    </Glyph>
  );
}


/** 画笔：铅笔 */
export function PenIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </Glyph>
  );
}


/** 橡皮 */
export function EraserIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M21 21H8a2 2 0 0 1-1.42-.587l-3.994-3.999a2 2 0 0 1 0-2.828l10-10a2 2 0 0 1 2.829 0l5.999 6a2 2 0 0 1 0 2.828L12.834 21" />
      <path d="m5.082 11.09 8.828 8.828" />
    </Glyph>
  );
}


/** 圆规 */
export function CompassIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
    </Glyph>
  );
}


/** 图形合集 */
export function ShapesIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M8.3 10a.7.7 0 0 1-.626-1.079L11.4 3a.7.7 0 0 1 1.198-.043L16.3 8.9a.7.7 0 0 1-.572 1.1Z" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <circle cx="17.5" cy="17.5" r="3.5" />
    </Glyph>
  );
}


/** 平移：手 */
export function PanIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2" />
      <path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </Glyph>
  );
}


/** 锁定 */
export function LockIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Glyph>
  );
}


/** 导入 */
export function ImportIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="M12 18v-6" />
      <path d="m9 15 3 3 3-3" />
    </Glyph>
  );
}


/** 导出 */
export function ExportIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
      <path d="M12 12v6" />
      <path d="m15 15-3-3-3 3" />
    </Glyph>
  );
}


/** 图片 */
export function ImageIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </Glyph>
  );
}


/** 重置 / 复位 */
export function ResetIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </Glyph>
  );
}


/** 写入 */
export function WriteIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M13 21h8" />
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
    </Glyph>
  );
}


/** 网格 */
export function GridIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
    </Glyph>
  );
}


/** 网格密度 */
export function RulerIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" />
      <path d="m14.5 12.5 2-2" />
      <path d="m11.5 9.5 2-2" />
      <path d="m8.5 6.5 2-2" />
      <path d="m17.5 15.5 2-2" />
    </Glyph>
  );
}


/** 吸附 */
export function MagnetIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="m12 15 4 4" />
      <path d="M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282z" />
      <path d="m5 8 4 4" />
    </Glyph>
  );
}


/** 平滑 */
export function SmoothIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M2 12q2.5 2 5 0t5 0 5 0 5 0" />
      <path d="M2 19q2.5 2 5 0t5 0 5 0 5 0" />
      <path d="M2 5q2.5 2 5 0t5 0 5 0 5 0" />
    </Glyph>
  );
}


/** 多边形 */
export function PolygonIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </Glyph>
  );
}


/** 调色板 */
export function PaletteIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z" />
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
    </Glyph>
  );
}


/** 窗口 */
export function WindowIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M10 4v4" />
      <path d="M2 8h20" />
      <path d="M6 4v4" />
    </Glyph>
  );
}


/** 信息 */
export function InfoIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Glyph>
  );
}


/** 左箭头 */
export function ChevronLeftIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="m15 18-6-6 6-6" />
    </Glyph>
  );
}


/** 右箭头 */
export function ChevronRightIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="m9 18 6-6-6-6" />
    </Glyph>
  );
}


/** 展开箭头 */
export function ChevronIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="m6 9 6 6 6-6" />
    </Glyph>
  );
}


/** 设置 */
export function GearIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </Glyph>
  );
}


/** 收起 */
export function MinimizeIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="m14 10 7-7" />
      <path d="M20 10h-6V4" />
      <path d="m3 21 7-7" />
      <path d="M4 14h6v6" />
    </Glyph>
  );
}


/** 关闭 */
export function CloseIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Glyph>
  );
}


/** 调节 */
export function SlidersIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M10 5H3" />
      <path d="M12 19H3" />
      <path d="M14 3v4" />
      <path d="M16 17v4" />
      <path d="M21 12h-9" />
      <path d="M21 19h-5" />
      <path d="M21 5h-7" />
      <path d="M8 10v4" />
      <path d="M8 12H3" />
    </Glyph>
  );
}


/** 删除 */
export function DeleteIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Glyph>
  );
}


/** 套索 */
export function LassoIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M3.704 14.467a10 8 0 1 1 3.115 2.375" />
      <path d="M7 22a5 5 0 0 1-2-3.994" />
      <circle cx="5" cy="16" r="2" />
    </Glyph>
  );
}


/** 点工具 */
export function PointToolIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="12" r="10" />
    </Glyph>
  );
}


/** 圆工具 */
export function CircleToolIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="10" />
    </Glyph>
  );
}


/** 函数 */
export function SigmaIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2" />
    </Glyph>
  );
}


/** 矩形工具 */
export function RectToolIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <rect width="18" height="18" x="3" y="3" rx="2" />
    </Glyph>
  );
}


/** 多边形工具 */
export function PolygonToolIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M10.83 2.38a2 2 0 0 1 2.34 0l8 5.74a2 2 0 0 1 .73 2.25l-3.04 9.26a2 2 0 0 1-1.9 1.37H7.04a2 2 0 0 1-1.9-1.37L2.1 10.37a2 2 0 0 1 .73-2.25z" />
    </Glyph>
  );
}




/** 展开 */
export function ExpandIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M15 3h6v6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
      <path d="M9 21H3v-6" />
    </Glyph>
  );
}


/** 放大 / 加 */
export function PlusIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Glyph>
  );
}


/** 缩小 / 减 */
export function MinusIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M5 12h14" />
    </Glyph>
  );
}


/** 默认大小 */
export function FitIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M14 15H9v-5" />
      <path d="M16 3h5v5" />
      <path d="M21 3 9 15" />
    </Glyph>
  );
}


/** 复制 */
export function CopyIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </Glyph>
  );
}


/** 历史记录 */
export function HistoryIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </Glyph>
  );
}


/** 角度工具 */
export function AngleIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M4 19h15" />
      <path d="M4 19 15 5" />
      <path d="M10.6 19a6.6 6.6 0 0 0-1.9-4.7" />
    </Glyph>
  );
}


/** 线宽：三档粗细 */
export function StrokeWidthIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M4 7h16" strokeWidth="1.1" />
      <path d="M4 12h16" strokeWidth="2.2" />
      <path d="M4 18h16" strokeWidth="3.6" />
    </Glyph>
  );
}


/** 线段工具：两点一线 */
export function LineToolIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M6.5 17.5 17.5 6.5" />
      <circle cx="6.5" cy="17.5" r="1.8" />
      <circle cx="17.5" cy="6.5" r="1.8" />
    </Glyph>
  );
}


/** 椭圆工具 */
export function EllipseToolIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <ellipse cx="12" cy="12" rx="9" ry="6" />
    </Glyph>
  );
}


/** 圆弧工具：一段弧加两个端点 */
export function ArcToolIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M4 17a9 9 0 0 1 16 0" />
      <circle cx="4" cy="17" r="1.6" />
      <circle cx="20" cy="17" r="1.6" />
    </Glyph>
  );
}


/** 曲线工具：带手柄的贝塞尔 */
export function CurveToolIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M4 18c3.5 0 4.5-12 8-12s4 8 8 8" />
      <circle cx="4" cy="18" r="1.6" />
      <circle cx="20" cy="14" r="1.6" />
    </Glyph>
  );
}


/** 品牌标记：与插件图标同一构型（圆规立在弧上） */
export function BrandIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="5.2" r="1.9" fill="currentColor" stroke="none" />
      <path d="M12 7.4 6.8 18.6" />
      <path d="M12 7.4 17.2 18.6" />
      <path d="M4.9 19.6Q12 16.9 19.1 19.6" strokeWidth="1.5" />
    </Glyph>
  );
}

export type ToolIconName =
  | "select" | "pen" | "eraser" | "compass" | "place" | "angle" | "lasso" | "line"
  | "point" | "circle" | "image" | "lock" | "ellipse" | "rect" | "polygon" | "arc" | "curve";

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
    case "ellipse": return <EllipseToolIcon size={size} />;
    case "rect": return <RectToolIcon size={size} />;
    case "polygon": return <PolygonToolIcon size={size} />;
    case "arc": return <ArcToolIcon size={size} />;
    case "curve": return <CurveToolIcon size={size} />;
  }
}

/** 撤销：回旋箭头 */
export function UndoIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
    </Glyph>
  );
}

/** 重做：回旋箭头（反向） */
export function RedoIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" />
    </Glyph>
  );
}

/** 画布背景：带坐标轴的画布框 */
export function CanvasBgIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <path d="M3.5 12h17" />
      <path d="M12 3.5v17" />
    </Glyph>
  );
}

/** 一键清空：扫帚（Lucide broom，ISC） */
export function BroomIcon({ size = 20 }: IconProps) {
  return (
    <Glyph size={size}>
      <path d="M13.5 10.5 22 2" />
      <path d="M14.734 13.841a2 2 0 00-.314-2.42L12.58 9.58a2 2 0 00-2.421-.314l-7.657 4.461A1 1 0 002.3 15.3l6.403 6.403a1 1 0 001.571-.204z" />
      <path d="m5 18 2-2" />
      <path d="m7.699 10.7 5.602 5.601" />
    </Glyph>
  );
}
