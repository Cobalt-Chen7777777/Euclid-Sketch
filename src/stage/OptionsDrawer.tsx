/* eslint-disable no-restricted-syntax -- 色板与图形色点需按颜色动态内联背景，其余为声明式渲染 */
/**
 * 绘图选项抽屉：从左侧悬浮滑出，盖在画布上方，不占画布布局空间。
 * 放的是「画画时会调的东西」——图元类型、笔宽、颜色、公式、图形列表。
 * 导入导出、写入批注这类低频操作放在设置页，避免挤占画布。
 */
import { useState } from "react";

import { DASHABLE, type PrimitiveType, type Shape } from "../model/types";
import type { CanvasBg } from "../settings/model";
import { PALETTE } from "../model/types";
import { describeShape } from "../model/describe";
import { anchorOf, anchorPatch, angleLenPatch, angleRadiusFor, angleSpanPatch, arcAngleDeg, arcAnglePatch, arcRadiusPatch, circleRadiusPatch, ellipseRadiiPatch, lineLength, lineLengthPatch, polygonRadiusPatch, polygonSidesPatch, rectSizePatch } from "../model/paramEdits";
import { angleSpanDeg } from "../model/angle";
import { layerName } from "../model/layers";
import { CloseIcon, FitIcon, MinusIcon, PlusIcon } from "../icons";

const PRIMITIVES: [PrimitiveType, string][] = [
  ["circle", "圆"], ["ellipse", "椭圆"], ["arc", "圆弧"], ["rect", "矩形"],
  ["polygon", "多边形"], ["star", "星形"], ["rhombus", "菱形"], ["trapezoid", "梯形"],
  ["arrow", "箭头"], ["ray", "射线"], ["line", "直线"], ["point", "点"], ["angle", "角度"],
];

interface Props {
  onClose: () => void;
  canvasBg: CanvasBg;
  onCanvasBg: (bg: CanvasBg) => void;
  placeType: PrimitiveType;
  onPlaceType: (type: PrimitiveType) => void;
  placeSides: number;
  onPlaceSides: (sides: number) => void;
  penWidth: number;
  onPenWidth: (width: number) => void;
  /** 撤销栈里还能回退的步数 */
  historySteps?: number;
  /** 一次回退多步 */
  onJumpBack?: (n: number) => void;
  color: string;
  onColor: (color: string) => void;
  shapes: Shape[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDeleteShape: (id: string) => void;
  onToggleDashed: (id: string) => void;
  /** 通用图形补丁（数值输入用） */
  onUpdateShape: (id: string, updater: (s: Shape) => Shape) => void;
  /** 图层 */
  layers: { rows: { id: number; count: number; hidden: boolean; locked: boolean }[]; addLayer: () => void; toggleHidden: (id: number) => void; toggleLocked: (id: number) => void; moveSelected: (ids: string[], layer: number) => void; };
  currentLayer: number;
  onSelectLayer: (layer: number) => void;
  /** 当前选中图形 id（移到图层用） */
  selectionIds: string[];
  /** 切换图片锁定（锁定后橡皮擦不掉） */
  onToggleImageLock: (id: string) => void;
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
  lockRadius: boolean;
  lockedRadius: number | null;
}

/**
 * 数值输入：编辑期间只改草稿，失焦 / 回车才提交。
 * 旧实现是 type=number + 逐字提交：想把数字删掉重输时，每按一次退格都会把中间值
 * 写进图形（图形跟着跳变），iOS 的 number 键盘还常常吞掉退格。现在允许清空，
 * 空串 / 非法值直接回填原值，不会误改图形。
 */
function ParamInput({ value, step, onCommit, positive = true }: {
  value: number;
  step: string;
  onCommit: (n: number) => void;
  /** 尺寸类参数必须为正；坐标可以负 */
  positive?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    setDraft(null);
    const n = Number(raw.trim());
    if (raw.trim() === "" || !Number.isFinite(n) || (positive && n <= 0)) return;
    // 与显示精度一致（两位小数），避免「输入 3.333 看到 3.33 实际存 3.333」
    onCommit(Math.round(n * 100) / 100);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft ?? value.toFixed(2)}
      onFocus={(e) => { setDraft(e.currentTarget.value); e.currentTarget.select(); }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.currentTarget.blur(); return; }
        if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
        e.preventDefault();
        const base = Number((draft ?? value.toFixed(2)).trim());
        if (!Number.isFinite(base)) return;
        const delta = Number(step) || 1;
        const next = base + (e.key === "ArrowUp" ? delta : -delta);
        if (positive && next <= 0) return;
        setDraft(next.toFixed(2));
        onCommit(Math.round(next * 100) / 100);
      }}
    />
  );
}

export function OptionsDrawer(props: Props) {
  const {
    onClose, canvasBg, onCanvasBg,
    tool, placeType, onPlaceType, placeSides, onPlaceSides, penWidth, onPenWidth,
    historySteps = 0, onJumpBack,
    color, onColor,
    shapes, selectedId, onSelect, onDeleteShape, lockRadius, lockedRadius,
    onToggleDashed, onUpdateShape, layers, currentLayer, onSelectLayer, selectionIds, onToggleImageLock, onResizeImage, onFitImage, onNormalizeImage,
    dashStyle, onDashStyle, onExportPng, onCopyPng, onImportImageFile, onInsertClipboard, imageInsertScale, onImageInsertScale,
    onQuickCreate,
  } = props;

  const selectedShape = shapes.find((s) => s.id === selectedId) ?? null;

  return (
    <aside className="drawer" aria-label="绘图选项">
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
              <>
              <label className="param-row">
                <span>角度</span>
                <ParamInput
                  value={Math.round(angleSpanDeg(selectedShape))}
                  step="5"
                  onCommit={(deg) => onUpdateShape(selectedShape.id, (s2) =>
                    s2.type === "angle" ? { ...s2, ...angleSpanPatch(s2, deg) } : s2)}
                />
                <span className="param-unit">°</span>
              </label>
              <label className="param-row">
                <span>边长</span>
                <ParamInput
                  value={selectedShape.len ?? selectedShape.r * 1.3}
                  step="0.5"
                  onCommit={(len) => onUpdateShape(selectedShape.id, (s) =>
                    s.type === "angle" ? { ...s, ...angleLenPatch(len), r: angleRadiusFor(len) } : s)}
                />
                <span className="param-unit">格</span>
              </label>
              </>
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
              </>
            ) : selectedShape.type === "polygon" ? (
              <>
                <label className="param-row">
                  <span>边数</span>
                  <ParamInput value={selectedShape.sides} step="1"
                    onCommit={(v) => onUpdateShape(selectedShape.id, (s2) => s2.type === "polygon" ? { ...s2, ...polygonSidesPatch(v) } : s2)} />
                  <span className="param-unit">边</span>
                </label>
                <label className="param-row">
                  <span>半径</span>
                  <ParamInput value={selectedShape.r} step="0.5"
                    onCommit={(v) => onUpdateShape(selectedShape.id, (s2) => s2.type === "polygon" ? { ...s2, ...polygonRadiusPatch(v) } : s2)} />
                  <span className="param-unit">格</span>
                </label>
              </>
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
              <button type="button" className="chip" onClick={() => onNormalizeImage(selectedShape.id)} title="按图片真实比例校正高度（修复变形的长图）">校正比例</button>
            </div>
            <p className="drawer-hint">拖动图片中心移动 · 右下角控制点自由拉伸 · 点图片左上角锁图标切换防误擦</p>
            <button type="button" className="chip export-chip" onClick={onImportImageFile}>从文件导入图片</button>
          </section>
        ) : null}

        {/* 插入图形：只在绘图类工具下显示（画笔 / 橡皮 / 套索 / 曲线没有插入图形的需求） */}
        {["place", "select", "circle", "line", "point", "angle", "arc"].includes(tool) ? (
        <section className="drawer-sec" style={selectedShape ? { display: "none" } : undefined}>
          <h3>插入图形</h3>
          <div className="chips">
            {PRIMITIVES.map(([t, label]) => (
              <button
                key={t}
                type="button"
                className={`chip${placeType === t ? " on" : ""}`}
                onClick={() => onPlaceType(t)}
              >{label}</button>
            ))}
          </div>
          {placeType === "polygon" ? (
            <label className="drawer-row">
              <span>边数</span>
              <input
                type="range" min={3} max={12} step={1} value={placeSides}
                onChange={(e) => onPlaceSides(Number(e.target.value))}
              />
              <output>{placeSides}</output>
            </label>
          ) : null}
          <div className="chips">
            <button type="button" className="chip primary" onClick={() => onQuickCreate(placeType)}>
              按参数创建{placeType === "polygon" ? `（${placeSides} 边）` : ""}
            </button>
          </div>
          <p className="drawer-hint">也可以直接在画布上按住拖动来画</p>
        </section>
        ) : null}

        {/* 笔宽：只在画笔 / 曲线下显示 */}
        {tool === "pen" || tool === "curve" ? (
        <section className="drawer-sec">
          <h3>笔宽</h3>
          {/* 笔宽档位：细 / 中 / 粗 一键切换，减少进抽屉细调 */}
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
          {lockRadius && lockedRadius != null ? (
            <p className="drawer-hint">半径已锁定 {lockedRadius.toFixed(2)}，点一下即成圆</p>
          ) : null}
        </section>
        ) : null}

        {/* 颜色 */}
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

        {/* 历史：回退多步（单步用顶部栏的撤销按钮） */}
        {onJumpBack && historySteps > 0 ? (
          <section className="drawer-sec">
            <h3>历史 <em>{historySteps}</em></h3>
            <div className="chips">
              {[1, 5, 10].map((n) => (
                <button key={n} type="button" className="chip" disabled={historySteps < n}
                  onClick={() => onJumpBack(n)}>退 {n} 步</button>
              ))}
            </div>
          </section>
        ) : null}

        {/* 图形列表 */}
        <section className="drawer-sec">
          <h3>图形 {shapes.length > 0 ? <em>{shapes.length}</em> : null}</h3>
          {shapes.length === 0 ? (
            <p className="drawer-hint">还没有图形。用画笔随手画，或用公式添加一条曲线。</p>
          ) : (
            <div className="shape-list">
              {shapes.map((s) => (
                <div key={s.id} className={`shape-item${selectedId === s.id ? " sel" : ""}`}>
                  <button
                    type="button"
                    className="shape-pick"
                    onClick={() => onSelect(s.id)}
                    aria-label={`选中 ${describeShape(s)}`}
                  >
                    <span className="dot" style={{ background: "color" in s ? s.color : "#8a8377" }} />
                    <span className="shape-label">{describeShape(s)}</span>
                  </button>
                  {/* 坐标系是画布的基准，不给删除入口（与画布上的橡皮规则一致） */}
                  {s.type === "coord" ? null : (
                    <>
                      {s.type === "image" ? (
                        <button
                          type="button"
                          className={`lock-btn${"locked" in s && s.locked ? " on" : ""}`}
                          onClick={() => onToggleImageLock(s.id)}
                          aria-label={"locked" in s && s.locked ? "解锁图片" : "锁定图片"}
                          title={"locked" in s && s.locked ? "已锁定：橡皮擦不掉，点击解锁" : "未锁定：点击锁定防误擦"}
                        >
                          {/* 锁形用 SVG 画（emoji 在 WKWebView 里基线偏移会歪） */}
                          <svg width={13} height={13} viewBox="0 0 18 18" aria-hidden="true">
                            <path
                              d={"locked" in s && s.locked ? "M6 8.2 V6.6 a3 3 0 0 1 6 0 V8.2" : "M6 8.2 V6.6 a3 3 0 0 1 6 0"}
                              fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                            />
                            <rect x={3.8} y={8.2} width={10.4} height={7.2} rx={2} fill="currentColor" />
                          </svg>
                        </button>
                      ) : null}
                      {DASHABLE.has(s.type) ? (
                        <button
                          type="button"
                          className={`dash-btn${"dashed" in s && s.dashed ? " on" : ""}`}
                          onClick={() => onToggleDashed(s.id)}
                          aria-label="切换虚线"
                          title="切换虚线 / 实线"
                        >┄</button>
                      ) : null}
                      <button type="button" className="del-btn" onClick={() => onDeleteShape(s.id)} aria-label="删除">✕</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
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
