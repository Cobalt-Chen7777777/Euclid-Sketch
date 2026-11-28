/**
 * 左侧悬浮工具栏：按钮内容可在「设置 → 工具栏」里自定义。
 * 线 / 点 / 圆等常用图元直接做成按钮，点击即进入对应绘制模式（原生体验）。
 */
import { useRef } from "react";

import type { Tool } from "../canvas/Canvas2D";
import { RAIL_CATALOG } from "../settings/model";
import type { PrimitiveType } from "../model/types";
import { SlidersIcon, ToolIcon, type ToolIconName } from "../icons";
import { toolHasOptions } from "./toolOptions";

/** id → 图标（目录里的每一项都要有图标） */
const ICONS: Record<string, ToolIconName> = {
  select: "select", pen: "pen", eraser: "eraser", lasso: "lasso", angle: "angle",
  line: "line", point: "point", circle: "circle",
  ellipse: "ellipse", rect: "rect", polygon: "polygon", arc: "arc", curve: "curve",
  place: "place", image: "image",
};

/** 图元类按钮：点击进入 place 模式并切换 placeType */
const PLACE_TOOLS = new Set(["line", "point", "circle", "ellipse", "rect", "polygon", "arc"]);

interface Props {
  /** 停靠位置：左/右竖排，上/下横排 */
  placement?: "left" | "right" | "top" | "bottom";
  /** 长按图形图标：按参数创建（默认尺寸，随后在「几何参数」里改） */
  onParamCreate?: (id: string) => void;
  tool: Tool;
  placeType: PrimitiveType;
  railTools: string[];
  onTool: (tool: Tool) => void;
  onPlaceType: (t: PrimitiveType) => void;
  onImportImage: () => void;
  optionsOpen: boolean;
  onToggleOptions: (rect?: DOMRect) => void;
  /** 点「全部图形」时通知上层：弹出独立的图形选择器（参数是按钮位置） */
  onOpenPicker?: (rect: DOMRect) => void;
}

export function ToolRail({
  placement = "left",
  onParamCreate,
  tool, placeType, railTools, onTool, onPlaceType, onImportImage,
  optionsOpen, onToggleOptions, onOpenPicker,
}: Props) {
  /** 长按计时：500ms 内松手仍按原单击行为处理 */
  const holdRef = useRef<{ timer: ReturnType<typeof setTimeout> | null; fired: boolean }>({ timer: null, fired: false });
  const startHold = (id: string) => {
    holdRef.current.fired = false;
    holdRef.current.timer = setTimeout(() => {
      holdRef.current.fired = true;
      onParamCreate?.(id);
    }, 500);
  };
  const endHold = () => {
    if (holdRef.current.timer) clearTimeout(holdRef.current.timer);
    holdRef.current.timer = null;
  };

  // 「选择」永远显示，避免配置后无法返回选择模式
  const items = RAIL_CATALOG.filter((c) => c.id === "select" || railTools.includes(c.id));

  return (
    <div className={`rail${placement === "left" ? "" : ` rail-${placement}`}`} role="toolbar" aria-label="绘图工具">
      {items.map((item) => {
        const isPlace = PLACE_TOOLS.has(item.id);
        const active = item.id === "image"
          ? false
          : isPlace
            ? tool === "place" && placeType === item.id
            : item.id === "place"
              ? tool === "place" && !PLACE_TOOLS.has(placeType)
              : tool === item.id;
        const onClick = (ev?: React.MouseEvent<HTMLButtonElement>) => {
          // 再次点击当前已激活的工具 = 打开「绘图选项」：
          // 画笔/曲线调粗细颜色，图形工具直接列出「按参数创建」的各项参数（不用再点一次按钮）
          if (active && toolHasOptions(item.id)) {
            onToggleOptions?.(ev?.currentTarget.getBoundingClientRect());
            return;
          }
          if (item.id === "image") {
            onImportImage();
            return;
          }
          if (item.id === "place") {
            // 全部图形：只弹独立的「选择图形」小窗，不再拉整个绘图选项抽屉
            onTool("place");
            if (ev) onOpenPicker?.(ev.currentTarget.getBoundingClientRect());
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
            onPointerDown={() => startHold(item.id)}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            className={`rail-btn${active ? " on" : ""}`}
            aria-label={item.label}
            aria-pressed={active}
            title={item.label}
            onClick={(ev) => { if (holdRef.current.fired) { holdRef.current.fired = false; return; } onClick(ev); }}
          >
            <ToolIcon name={ICONS[item.id] ?? "place"} size={19} />
          </button>
        );
      })}

      <span className="rail-sep" aria-hidden="true" />

      {/* 橡皮 / 套索没有可选项，但按钮要占位：直接删掉会让工具栏变短、图标整体位移 */}
      <button
        type="button"
        className={`rail-btn${optionsOpen ? " on" : ""}${toolHasOptions(tool) ? "" : " rail-btn-ghost"}`}
        aria-label="绘图选项"
        aria-expanded={optionsOpen}
        aria-hidden={!toolHasOptions(tool)}
        tabIndex={toolHasOptions(tool) ? 0 : -1}
        title="绘图选项（背景 / 图形 / 笔宽 / 颜色）"
        onClick={(ev) => {
          if (!toolHasOptions(tool)) return;
          onToggleOptions(ev.currentTarget.getBoundingClientRect());
        }}
      >
        <SlidersIcon size={19} />
      </button>
    </div>
  );
}
