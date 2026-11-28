/* eslint-disable no-restricted-syntax -- 色板与图形色点需按颜色动态内联背景，其余为声明式渲染 */
/**
 * 绘图选项抽屉：从左侧悬浮滑出，盖在画布上方，不占画布布局空间。
 * 放的是「画画时会调的东西」——图元类型、笔宽、颜色、公式、图形列表。
 * 导入导出、写入批注这类低频操作放在设置页，避免挤占画布。
 */
import { type PrimitiveType, type Shape } from "../model/types";
import type { CanvasBg } from "../settings/model";
import { PALETTE } from "../model/types";
import { anchorOf, anchorPatch, arcAngleDeg, arcAnglePatch, arcRadiusPatch, circleRadiusPatch, ellipseRadiiPatch, lineLength, lineLengthPatch, polygonRadiusPatch, polygonSidesPatch, rectSizePatch } from "../model/paramEdits";
import { layerName } from "../model/layers";
import { polygonToIrregular } from "../model/poly";
import { ParamInput } from "./ParamInput";
import { AngleParams } from "./AngleParams";
import { AngleDial } from "./AngleDial";
import { PolyParams } from "./PolyParams";
import { RotateDial } from "./RotateDial";
import { popoverStyle } from "./popoverStyle";
import { CloseIcon, FitIcon, MinusIcon, PlusIcon, RotateCcwIcon, RotateCwIcon } from "../icons";

/** 图形类型的中文名（按钮上写「创建圆」这种） */
const PLACE_LABEL: Record<string, string> = {
  circle: "圆", ellipse: "椭圆", arc: "圆弧", rect: "矩形", polygon: "多边形",
  star: "星形", rhombus: "菱形", trapezoid: "梯形", arrow: "箭头",
  ray: "射线", line: "线段", point: "点", angle: "角度",
};

interface Props {
  onClose: () => void;
  canvasBg: CanvasBg;
  onCanvasBg: (bg: CanvasBg) => void;
  placeType: PrimitiveType;
  placeSides: number;
  onPlaceSides: (sides: number) => void;
  /** 「按参数创建」用的尺寸（半径 / 宽高 / 长度 / 角度），抽屉里直接列出来 */
  createSize: { r: number; w: number; h: number; len: number; deg: number };
  onCreateSize: (patch: Partial<{ r: number; w: number; h: number; len: number; deg: number }>) => void;
  penWidth: number;
  onPenWidth: (width: number) => void;
  color: string;
  onColor: (color: string) => void;
  /** 画布图形与当前选中：几何参数/插入图片都要用 */
  shapes: Shape[];
  selectedId: string | null;
  /** 通用图形补丁（数值输入用） */
  onUpdateShape: (id: string, updater: (s: Shape) => Shape) => void;
  /** 图层 */
  layers: { rows: { id: number; count: number; hidden: boolean; locked: boolean }[]; addLayer: () => void; toggleHidden: (id: number) => void; toggleLocked: (id: number) => void; moveSelected: (ids: string[], layer: number) => void; };
  currentLayer: number;
  onSelectLayer: (layer: number) => void;
  /** 当前选中图形 id（移到图层用） */
  selectionIds: string[];
  /** 等比缩放选中图片 */
  onResizeImage: (id: string, factor: number) => void;
  /** 图片重置到默认宽度 */
  onFitImage: (id: string) => void;
  /** 按图片真实尺寸校正宽高比（修复旧数据的变形图片） */
  onNormalizeImage: (id: string) => void;
  /** 线型样式开关（画布上画什么都是虚线） */
  dashStyle: boolean;
  onDashStyle: (v: boolean) => void;
  /** 导出当前画布为 PNG（2×） */
  onExportPng: () => void;
  /** 复制草图图片到剪贴板（可直接粘贴进 MN 批注） */
  onCopyPng: () => void;
  /** 从本地文件导入图片（备用来源；主入口为卡片渲染图） */
  onImportImageFile: () => void;
  /** 从剪贴板插入图片（宿主不授权时会提示改用文件导入） */
  onInsertClipboard: () => void;
  /** 当前工具（用于按工具简化菜单） */
  tool: string;
  /** 按参数创建：在视野中心放一个默认尺寸的图形 */
  onQuickCreate: (kind: string) => void;
  /** 插入图片的大小系数（1 大 / 0.7 中 / 0.45 小） */
  imageInsertScale: number;
  onImageInsertScale: (scale: number) => void;
  /** 触发它的按钮位置：抽屉贴着这个图标弹出（null 时退回默认位置） */
  anchor?: { left: number; top: number; width: number; height: number } | null;
}

/** 画笔的粗细：档位 + 滑杆（画笔专用抽屉与完整抽屉共用） */
function PenWidthSec({ penWidth, onPenWidth }: {
  penWidth: number;
  onPenWidth: (w: number) => void;
}) {
  return (
    <section className="drawer-sec">
      <h3>笔宽</h3>
      <div className="chips" style={{ marginBottom: 8 }}>
        {([["细", 2], ["中", 4], ["粗", 7]] as [string, number][]).map(([label, w]) => (
          <button key={label} type="button" className={`chip${penWidth === w ? " on" : ""}`}
            onClick={() => onPenWidth(w)}>{label}</button>
        ))}
      </div>
      <label className="drawer-row">
        <span>粗细</span>
        <input
          type="range" min={1} max={12} step={1} value={penWidth}
          onChange={(e) => onPenWidth(Number(e.target.value))}
        />
        <output>{penWidth}px</output>
      </label>
    </section>
  );
}

/** 调色板（14 色） */
function ColorSec({ color, onColor }: { color: string; onColor: (c: string) => void }) {
  return (
    <section className="drawer-sec">
      <h3>颜色</h3>
      <div className="swatches">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            className={`swatch${color === c ? " on" : ""}`}
            style={{ background: c }}
            aria-label={`颜色 ${c}`}
            aria-pressed={color === c}
            onClick={() => onColor(c)}
          />
        ))}
      </div>
    </section>
  );
}

export function OptionsDrawer(props: Props) {
  const {
    onClose, canvasBg, onCanvasBg,
    tool, placeType, placeSides, onPlaceSides, createSize, onCreateSize, penWidth, onPenWidth,
    color, onColor,
    shapes, selectedId, onUpdateShape, layers, currentLayer, onSelectLayer, selectionIds, onResizeImage, onFitImage, onNormalizeImage,
    dashStyle, onDashStyle, onExportPng, onCopyPng, onImportImageFile, onInsertClipboard, imageInsertScale, onImageInsertScale,
    onQuickCreate, anchor = null,
  } = props;

  /**
   * 抽屉贴着「绘图选项」图标弹出：优先摆在图标上方（下方空间不够时放下面），
   * 水平方向夹在面板内，右边的图标也不会把面板顶出屏幕。
   */
  // 位置交给统一的浮层定位：以画布区为边界，左上右下都不会压到面板外
  const drawerStyle = popoverStyle(anchor, { width: 340, maxHeight: 640, minHeight: 260 });

  const selectedShape = shapes.find((s) => s.id === selectedId) ?? null;
  /** 当前要创建的类型：角度是独立工具，其余看「当前图形类型」 */
  const placeKind = tool === "angle" ? "angle" : placeType;

  // 画笔用不到插入图形 / 线型 / 图层这些，抽屉只留粗细与颜色
  if (tool === "pen") {
    return (
      <aside className="drawer" aria-label="绘图选项" style={drawerStyle}>
        <div className="drawer-head">
          <b>画笔</b>
          <button type="button" className="drawer-close" onClick={onClose} aria-label="收起选项">
            <CloseIcon size={14} />
          </button>
        </div>
        <div className="drawer-body">
          <PenWidthSec penWidth={penWidth} onPenWidth={onPenWidth} />
          <ColorSec color={color} onColor={onColor} />
        </div>
      </aside>
    );
  }

  return (
    <aside className="drawer" aria-label="绘图选项" style={drawerStyle}>
      <div className="drawer-head">
        <b>绘图选项</b>
        <button type="button" className="drawer-close" onClick={onClose} aria-label="收起选项">
          <CloseIcon size={14} />
        </button>
      </div>

      <div className="drawer-body">
        {/* 画布背景：空白纸 or 坐标系 */}
        <section className="drawer-sec">
          <h3>画布背景</h3>
          <div className="chips">
            <button
              type="button"
              className={`chip${canvasBg === "coord" ? " on" : ""}`}
              onClick={() => onCanvasBg("coord")}
            >坐标系</button>
            <button
              type="button"
              className={`chip${canvasBg === "blank" ? " on" : ""}`}
              onClick={() => onCanvasBg("blank")}
            >空白画布</button>
          </div>
          <p className="drawer-hint">
            {canvasBg === "coord" ? "带网格与刻度，适合函数与几何作图" : "纯白纸面，适合随手演算与涂画"}
          </p>
        </section>

        {/* 线型：只对会生成图形的工具显示 */}
        {["place", "select", "circle", "line", "point", "angle", "arc"].includes(tool) ? (
        <section className="drawer-sec">
          <h3>线型</h3>
          <div className="chips">
            <button type="button" className={`chip${dashStyle ? "" : " on"}`} onClick={() => onDashStyle(false)}>实线</button>
            <button type="button" className={`chip${dashStyle ? " on" : ""}`} onClick={() => onDashStyle(true)}>虚线</button>
          </div>
          <p className="drawer-hint">虚线开启后，新画的线段 / 圆 / 矩形等都是虚线；已有图形在下方列表可单独切换</p>
        </section>
        ) : null}

        {/* 几何参数：选中线段 / 圆 / 圆弧 / 角度 / 点时可精确输入 */}
        {selectedShape && (["line", "circle", "arc", "angle", "point", "ellipse", "rect", "polygon", "poly"] as string[]).includes(selectedShape.type) ? (
          <section className="drawer-sec">
            <h3>几何参数</h3>
            {(() => {
              const a = anchorOf(selectedShape);
              if (!a) return null;
              return (
                <>
                  <label className="param-row">
                    <span>位置 x</span>
                    <ParamInput value={Math.round(a.x * 100) / 100} step="0.5" positive={false}
                      onCommit={(vv) => onUpdateShape(selectedShape.id, (s) => anchorPatch(s, "x", vv))} />
                    <span className="param-unit">格</span>
                  </label>
                  <label className="param-row">
                    <span>位置 y</span>
                    <ParamInput value={Math.round(a.y * 100) / 100} step="0.5" positive={false}
                      onCommit={(vv) => onUpdateShape(selectedShape.id, (s) => anchorPatch(s, "y", vv))} />
                    <span className="param-unit">格</span>
                  </label>
                </>
              );
            })()}
            {selectedShape.type === "point" ? (
              <>
                <label className="param-row">
                  <span>x</span>
                  <ParamInput
                    value={selectedShape.x}
                    step="0.5"
                    positive={false}
                    onCommit={(v) => onUpdateShape(selectedShape.id, (s) =>
                      s.type === "point" ? { ...s, x: v } : s)}
                  />
                  <span className="param-unit">格</span>
                </label>
                <label className="param-row">
                  <span>y</span>
                  <ParamInput
                    value={selectedShape.y}
                    step="0.5"
                    positive={false}
                    onCommit={(v) => onUpdateShape(selectedShape.id, (s) =>
                      s.type === "point" ? { ...s, y: v } : s)}
                  />
                  <span className="param-unit">格</span>
                </label>
              </>
            ) : selectedShape.type === "line" ? (
              <>
              <label className="param-row">
                <span>长度</span>
                <ParamInput
                  value={lineLength(selectedShape)}
                  step="0.5"
                  onCommit={(len) => onUpdateShape(selectedShape.id, (s) =>
                    s.type === "line" ? { ...s, ...lineLengthPatch(s, len) } : s)}
                />
                <span className="param-unit">格</span>
              </label>
              <RotateDial shape={selectedShape} onUpdateShape={onUpdateShape} />
              </>
            ) : selectedShape.type === "circle" ? (
              <label className="param-row">
                <span>半径</span>
                <ParamInput
                  value={selectedShape.r}
                  step="0.5"
                  onCommit={(r) => onUpdateShape(selectedShape.id, (s) =>
                    s.type === "circle" ? { ...s, ...circleRadiusPatch(r) } : s)}
                />
                <span className="param-unit">格</span>
              </label>
            ) : selectedShape.type === "angle" ? (
              <AngleParams shape={selectedShape} onUpdateShape={onUpdateShape} />
            ) : selectedShape.type === "ellipse" ? (
              <>
                <label className="param-row">
                  <span>横轴 a</span>
                  <ParamInput value={selectedShape.rx} step="0.5"
                    onCommit={(v) => onUpdateShape(selectedShape.id, (s2) => s2.type === "ellipse" ? { ...s2, ...ellipseRadiiPatch(v, s2.ry) } : s2)} />
                  <span className="param-unit">格</span>
                </label>
                <label className="param-row">
                  <span>纵轴 b</span>
                  <ParamInput value={selectedShape.ry} step="0.5"
                    onCommit={(v) => onUpdateShape(selectedShape.id, (s2) => s2.type === "ellipse" ? { ...s2, ...ellipseRadiiPatch(s2.rx, v) } : s2)} />
                  <span className="param-unit">格</span>
                </label>
                <RotateDial shape={selectedShape} onUpdateShape={onUpdateShape} />
              </>
            ) : selectedShape.type === "rect" ? (
              <>
                <label className="param-row">
                  <span>宽</span>
                  <ParamInput value={Math.abs(selectedShape.x2 - selectedShape.x1)} step="0.5"
                    onCommit={(v) => onUpdateShape(selectedShape.id, (s2) => s2.type === "rect" ? { ...s2, ...rectSizePatch(s2, v, Math.abs(s2.y2 - s2.y1)) } : s2)} />
                  <span className="param-unit">格</span>
                </label>
                <label className="param-row">
                  <span>高</span>
                  <ParamInput value={Math.abs(selectedShape.y2 - selectedShape.y1)} step="0.5"
                    onCommit={(v) => onUpdateShape(selectedShape.id, (s2) => s2.type === "rect" ? { ...s2, ...rectSizePatch(s2, Math.abs(s2.x2 - s2.x1), v) } : s2)} />
                  <span className="param-unit">格</span>
                </label>
                <RotateDial shape={selectedShape} onUpdateShape={onUpdateShape} />
              </>
            ) : selectedShape.type === "polygon" ? (
              <>
                <label className="drawer-row">
                  <span>边数</span>
                  <input
                    type="range" min={3} max={24} step={1} value={selectedShape.sides}
                    onChange={(e) => onUpdateShape(selectedShape.id, (s2) =>
                      s2.type === "polygon" ? { ...s2, ...polygonSidesPatch(Number(e.target.value)) } : s2)}
                  />
                  <output>{selectedShape.sides}</output>
                </label>
                <label className="param-row">
                  <span>半径</span>
                  <ParamInput value={selectedShape.r} step="0.5"
                    onCommit={(v) => onUpdateShape(selectedShape.id, (s2) => s2.type === "polygon" ? { ...s2, ...polygonRadiusPatch(v) } : s2)} />
                  <span className="param-unit">格</span>
                </label>
                <div className="dial-row">
                  <AngleDial
                    deg={((Math.round((selectedShape.rotation * 180) / Math.PI) % 360) + 360) % 360}
                    onChange={(d) => onUpdateShape(selectedShape.id, (s2) =>
                      s2.type === "polygon" ? { ...s2, rotation: (d * Math.PI) / 180 } : s2)}
                    label="多边形旋转角度"
                  />
                  <span className="drawer-hint">拖动旋钮自由旋转</span>
                  <output>{((Math.round((selectedShape.rotation * 180) / Math.PI) % 360) + 360) % 360}°</output>
                </div>
                <div className="chips">
                  <button
                    type="button"
                    className="chip"
                    title="转成每个顶点都能拖、每条边都能单独给长度的多边形"
                    onClick={() => onUpdateShape(selectedShape.id, (s2) => (s2.type === "polygon" ? polygonToIrregular(s2) : s2))}
                  >边长可调</button>
                </div>
              </>
            ) : selectedShape.type === "poly" && selectedShape.kind === "irregular" ? (
              <PolyParams shape={selectedShape} onUpdateShape={onUpdateShape} />
            ) : selectedShape.type === "arc" ? (
              <>
                <label className="param-row">
                  <span>半径</span>
                  <ParamInput
                    value={selectedShape.r}
                    step="0.5"
                    onCommit={(r) => onUpdateShape(selectedShape.id, (s) =>
                      s.type === "arc" ? { ...s, ...arcRadiusPatch(r) } : s)}
                  />
                  <span className="param-unit">格</span>
                </label>
                <label className="param-row">
                  <span>起始</span>
                  <ParamInput
                    value={arcAngleDeg(selectedShape.startAngle)}
                    step="5"
                    onCommit={(deg) => onUpdateShape(selectedShape.id, (s) =>
                      s.type === "arc" ? { ...s, ...arcAnglePatch("startAngle", deg) } : s)}
                  />
                  <span className="param-unit">°</span>
                </label>
                <label className="param-row">
                  <span>终止</span>
                  <ParamInput
                    value={arcAngleDeg(selectedShape.endAngle)}
                    step="5"
                    onCommit={(deg) => onUpdateShape(selectedShape.id, (s) =>
                      s.type === "arc" ? { ...s, ...arcAnglePatch("endAngle", deg) } : s)}
                  />
                  <span className="param-unit">°</span>
                </label>
                <RotateDial shape={selectedShape} onUpdateShape={onUpdateShape} />
              </>
            ) : null}
            <p className="drawer-hint">数值以网格为单位；弧的起止角按 0–360° 输入，逆时针为正</p>
          </section>
        ) : null}

        {/* 图片调整：选中图片时显示（等比缩放 + 文件导入备用入口） */}
        {selectedShape?.type === "image" ? (
          <section className="drawer-sec">
            <h3>图片调整</h3>
            <div className="chips">
              <button type="button" className="chip icon-chip" onClick={() => onResizeImage(selectedShape.id, 1.25)} aria-label="放大" title="放大">
                <PlusIcon size={13} />
              </button>
              <button type="button" className="chip icon-chip" onClick={() => onResizeImage(selectedShape.id, 0.8)} aria-label="缩小" title="缩小">
                <MinusIcon size={13} />
              </button>
              <button type="button" className="chip icon-chip" onClick={() => onFitImage(selectedShape.id)} aria-label="默认大小" title="默认大小">
                <FitIcon size={13} />
              </button>
              <button type="button" className="chip icon-chip" aria-label="逆时针旋转 90°" title="逆时针旋转 90°"
                onClick={() => onUpdateShape(selectedShape.id, (s2) => s2.type === "image" ? { ...s2, rot: (s2.rot ?? 0) - Math.PI / 2 } : s2)}>
                <RotateCcwIcon size={14} />
              </button>
              <button type="button" className="chip icon-chip" aria-label="顺时针旋转 90°" title="顺时针旋转 90°"
                onClick={() => onUpdateShape(selectedShape.id, (s2) => s2.type === "image" ? { ...s2, rot: (s2.rot ?? 0) + Math.PI / 2 } : s2)}>
                <RotateCwIcon size={14} />
              </button>
              <button type="button" className="chip" onClick={() => onNormalizeImage(selectedShape.id)} title="按图片真实比例校正高度（修复变形的长图）">校正比例</button>
            </div>
            {/* 旋转：旋钮拖一圈自由调（比滑杆直观，能直接看出朝向） */}
            <div className="dial-row">
              <AngleDial
                deg={((Math.round(((selectedShape.rot ?? 0) * 180) / Math.PI) % 360) + 360) % 360}
                onChange={(d) => onUpdateShape(selectedShape.id, (s2) =>
                  s2.type === "image" ? { ...s2, rot: (d * Math.PI) / 180 } : s2)}
                label="图片旋转角度"
              />
              <span className="drawer-hint">拖动旋钮自由旋转</span>
              <output>{((Math.round(((selectedShape.rot ?? 0) * 180) / Math.PI) % 360) + 360) % 360}°</output>
            </div>
            <p className="drawer-hint">拖动图片中心移动 · 左下角控制点拉伸 · 右下角图标旋转 · 左上角锁图标切换防误擦</p>
            <button type="button" className="chip export-chip" onClick={onImportImageFile}>从文件导入图片</button>
          </section>
        ) : null}

        {/* 按参数创建：把当前图形的参数直接列出来，改完点一次「创建」就行 */}
        {["place", "select", "angle"].includes(tool) && !selectedShape ? (
          <section className="drawer-sec">
            <h3>按参数创建</h3>
            {(() => null)()}
            {placeKind === "polygon" ? (
              <label className="drawer-row">
                <span>边数</span>
                <input type="range" min={3} max={24} step={1} value={placeSides}
                  onChange={(e) => onPlaceSides(Number(e.target.value))} />
                <output>{placeSides}</output>
              </label>
            ) : null}
            {placeKind === "polygon" || placeType === "circle" || placeType === "star" || placeType === "arc" ? (
              <label className="param-row">
                <span>半径</span>
                <ParamInput value={createSize.r} step="0.5"
                  onCommit={(v) => onCreateSize({ r: v })} />
                <span className="param-unit">格</span>
              </label>
            ) : null}
            {placeKind === "ellipse" ? (
              <>
                <label className="param-row">
                  <span>横轴 a</span>
                  <ParamInput value={createSize.w / 2} step="0.5" onCommit={(v) => onCreateSize({ w: v * 2 })} />
                  <span className="param-unit">格</span>
                </label>
                <label className="param-row">
                  <span>纵轴 b</span>
                  <ParamInput value={createSize.h / 2} step="0.5" onCommit={(v) => onCreateSize({ h: v * 2 })} />
                  <span className="param-unit">格</span>
                </label>
              </>
            ) : null}
            {placeKind === "rect" ? (
              <>
                <label className="param-row">
                  <span>宽</span>
                  <ParamInput value={createSize.w} step="0.5" onCommit={(v) => onCreateSize({ w: v })} />
                  <span className="param-unit">格</span>
                </label>
                <label className="param-row">
                  <span>高</span>
                  <ParamInput value={createSize.h} step="0.5" onCommit={(v) => onCreateSize({ h: v })} />
                  <span className="param-unit">格</span>
                </label>
              </>
            ) : null}
            {["line", "ray", "arrow"].includes(placeType) ? (
              <label className="param-row">
                <span>长度</span>
                <ParamInput value={createSize.len} step="0.5" onCommit={(v) => onCreateSize({ len: v })} />
                <span className="param-unit">格</span>
              </label>
            ) : null}
            {(tool === "angle" || placeType === "angle") ? (
              <>
                <label className="param-row">
                  <span>角度</span>
                  <ParamInput value={createSize.deg} step="5" onCommit={(v) => onCreateSize({ deg: v })} />
                  <span className="param-unit">°</span>
                </label>
                <label className="param-row">
                  <span>边长</span>
                  <ParamInput value={createSize.len} step="0.5" onCommit={(v) => onCreateSize({ len: v })} />
                  <span className="param-unit">格</span>
                </label>
              </>
            ) : null}
            <div className="chips">
              <button type="button" className="chip primary" onClick={() => onQuickCreate(placeKind)}>
                创建{PLACE_LABEL[placeKind] ?? "图形"}
              </button>
            </div>
            <p className="drawer-hint">也可以直接在画布上按住拖动来画</p>
          </section>
        ) : null}

        {/* 笔宽：只在画笔 / 曲线下显示 */}
        {tool === "pen" || tool === "curve" ? (
          <PenWidthSec penWidth={penWidth} onPenWidth={onPenWidth} />
        ) : null}

        {/* 颜色 */}
        <ColorSec color={color} onColor={onColor} />

        {/* 图层：切换当前绘制层 / 整层隐藏锁定 / 选中项移层 */}
        <section className="drawer-sec">
          <h3>图层</h3>
          <div className="layer-list">
            {layers.rows.map((row) => (
              <div key={row.id} className={`layer-row${currentLayer === row.id ? " cur" : ""}`}>
                <button type="button" className="layer-pick" onClick={() => onSelectLayer(row.id)}>
                  <span className="layer-name">{layerName(row.id)}</span>
                  <span className="layer-count">{row.count}</span>
                </button>
                <button type="button" className={`layer-btn${row.hidden ? " off" : ""}`} onClick={() => layers.toggleHidden(row.id)}>
                  {row.hidden ? "已隐" : "显示"}
                </button>
                <button type="button" className={`layer-btn${row.locked ? " off" : ""}`} onClick={() => layers.toggleLocked(row.id)}>
                  {row.locked ? "已锁" : "锁定"}
                </button>
              </div>
            ))}
          </div>
          <div className="chips">
            <button type="button" className="chip" onClick={layers.addLayer}>+ 新建图层</button>
            {selectionIds.length > 0 ? (
              <button type="button" className="chip" onClick={() => layers.moveSelected(selectionIds, currentLayer)}>
                选中项移到本层
              </button>
            ) : null}
          </div>
          <p className="drawer-hint">点图层名切换「新图形画在哪层」，层次越高越靠上；隐藏后不渲染也不导出，锁定后不可选中与擦除</p>
        </section>

        {/* 导出 PNG（画布在 DOM 里才可用，所以入口放画布侧） */}
        <section className="drawer-sec">
          <h3>导出</h3>
          <button type="button" className="chip export-chip" onClick={onExportPng}>导出 PNG 图片（2×）</button>
          <button type="button" className="chip export-chip" onClick={onCopyPng}>复制草图图片</button>
          <button type="button" className="chip export-chip" onClick={onImportImageFile}>从文件导入图片</button>
          <button type="button" className="chip export-chip" onClick={onInsertClipboard}>从剪贴板插入</button>
          <div className="chips">
            <span className="drawer-hint">插入大小</span>
            {[[1, "大"], [0.7, "中"], [0.45, "小"]].map(([v, label]) => (
              <button key={String(v)} type="button"
                className={`chip${Math.abs(imageInsertScale - (v as number)) < 0.01 ? " on" : ""}`}
                onClick={() => onImageInsertScale(v as number)}>{label}</button>
            ))}
          </div>
          <p className="drawer-hint">「复制草图图片」后可直接在 MN 卡片批注/子卡里长按粘贴；导出含全部图形；卡片图请用左侧「插入卡片图」</p>
        </section>
      </div>
    </aside>
  );
}
