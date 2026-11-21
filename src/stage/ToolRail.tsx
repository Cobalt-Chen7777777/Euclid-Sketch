/**
 * 左侧悬浮工具栏：按钮内容可在「设置 → 工具栏」里自定义。
 * 线 / 点 / 圆等常用图元直接做成按钮，点击即进入对应绘制模式（原生体验）。
 */
import type { Tool } from "../canvas/Canvas2D";
import { RAIL_CATALOG } from "../settings/model";
import type { PrimitiveType } from "../model/types";
import { SlidersIcon, ToolIcon, type ToolIconName } from "../icons";

/** id → 图标（目录里的每一项都要有图标） */
const ICONS: Record<string, ToolIconName> = {
  select: "select", pen: "pen", eraser: "eraser", lasso: "lasso", angle: "angle",
  line: "line", point: "point", circle: "circle",
  ellipse: "ellipse", rect: "rect", polygon: "polygon", arc: "arc", curve: "curve",
  place: "place", compass: "compass", image: "image",
};

/** 图元类按钮：点击进入 place 模式并切换 placeType */
const PLACE_TOOLS = new Set(["line", "point", "circle", "ellipse", "rect", "polygon", "arc"]);

interface Props {
  tool: Tool;
  placeType: PrimitiveType;
  railTools: string[];
  onTool: (tool: Tool) => void;
  onPlaceType: (t: PrimitiveType) => void;
  onImportImage: () => void;
  lockRadius: boolean;
  onToggleLock: () => void;
  optionsOpen: boolean;
  onToggleOptions: () => void;
}

export function ToolRail({
  tool, placeType, railTools, onTool, onPlaceType, onImportImage,
  lockRadius, onToggleLock, optionsOpen, onToggleOptions,
}: Props) {
  // 「选择」永远显示，避免配置后无法返回选择模式
  const items = RAIL_CATALOG.filter((c) => c.id === "select" || railTools.includes(c.id));

  return (
    <div className="rail" role="toolbar" aria-label="绘图工具">
      {items.map((item) => {
        const isPlace = PLACE_TOOLS.has(item.id);
        const active = item.id === "image"
          ? false
          : isPlace
            ? tool === "place" && placeType === item.id
            : item.id === "place"
              ? tool === "place" && !PLACE_TOOLS.has(placeType)
              : tool === item.id;
        const onClick = () => {
          if (item.id === "image") {
            onImportImage();
            return;
          }
          if (item.id === "place") {
            // 全部图形：进入 place 并自动弹出抽屉选类型（点击即有响应，不至像无效果）
            onTool("place");
            if (!optionsOpen) onToggleOptions();
            return;
          }
          if (isPlace) {
            onPlaceType(item.id as PrimitiveType);
            onTool("place");
            return;
          }
          onTool(item.id as Tool);
        };
        return (
          <button
            key={item.id}
            type="button"
            className={`rail-btn${active ? " on" : ""}`}
            aria-label={item.label}
            aria-pressed={active}
            title={item.label}
            onClick={onClick}
          >
            <ToolIcon name={ICONS[item.id] ?? "place"} size={19} />
          </button>
        );
      })}

      {railTools.includes("compass") ? (
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
      ) : null}

      <span className="rail-sep" aria-hidden="true" />

      <button
        type="button"
        className={`rail-btn${optionsOpen ? " on" : ""}`}
        aria-label="绘图选项"
        aria-expanded={optionsOpen}
        title="绘图选项（背景 / 图形 / 笔宽 / 颜色）"
        onClick={onToggleOptions}
      >
        <SlidersIcon size={19} />
      </button>
    </div>
  );
}
