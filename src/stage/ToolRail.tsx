/**
 * 左侧悬浮工具栏：只放工具，不占画布布局空间。
 * 图标排成一列，竖在画布左边缘，画布因此可以铺满整个面板。
 */
import type { Tool } from "../canvas/Canvas2D";
import { SlidersIcon, ToolIcon, type ToolIconName } from "../icons";

const TOOLS: { tool: Tool; icon: ToolIconName; label: string }[] = [
  { tool: "select", icon: "select", label: "选择" },
  { tool: "pen", icon: "pen", label: "画笔" },
  { tool: "eraser", icon: "eraser", label: "橡皮" },
  { tool: "compass", icon: "compass", label: "圆规" },
  { tool: "place", icon: "place", label: "绘制图元" },
  { tool: "angle", icon: "angle", label: "画角度" },
  { tool: "pan", icon: "pan", label: "平移" },
];

interface Props {
  tool: Tool;
  onTool: (tool: Tool) => void;
  lockRadius: boolean;
  onToggleLock: () => void;
  optionsOpen: boolean;
  onToggleOptions: () => void;
}

export function ToolRail({ tool, onTool, lockRadius, onToggleLock, optionsOpen, onToggleOptions }: Props) {
  return (
    <div className="rail" role="toolbar" aria-label="绘图工具">
      {TOOLS.map((item) => (
        <button
          key={item.tool}
          type="button"
          className={`rail-btn${tool === item.tool ? " on" : ""}`}
          aria-label={item.label}
          aria-pressed={tool === item.tool}
          title={item.label}
          onClick={() => onTool(item.tool)}
        >
          <ToolIcon name={item.icon} size={19} />
        </button>
      ))}
      <button
        type="button"
        className={`rail-btn${lockRadius ? " on" : ""}`}
        aria-label="锁定半径"
        aria-pressed={lockRadius}
        title="锁定半径（先画一个圆）"
        onClick={onToggleLock}
      >
        <ToolIcon name="lock" size={19} />
      </button>

      <span className="rail-sep" aria-hidden="true" />

      <button
        type="button"
        className={`rail-btn${optionsOpen ? " on" : ""}`}
        aria-label="绘图选项"
        aria-expanded={optionsOpen}
        title="绘图选项（图元 / 笔宽 / 颜色 / 公式）"
        onClick={onToggleOptions}
      >
        <SlidersIcon size={19} />
      </button>
    </div>
  );
}
