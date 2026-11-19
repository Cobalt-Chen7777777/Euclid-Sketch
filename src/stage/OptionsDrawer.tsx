/* eslint-disable no-restricted-syntax -- 色板与图形色点需按颜色动态内联背景，其余为声明式渲染 */
/**
 * 绘图选项抽屉：从左侧悬浮滑出，盖在画布上方，不占画布布局空间。
 * 放的是「画画时会调的东西」——图元类型、笔宽、颜色、公式、图形列表。
 * 导入导出、写入批注这类低频操作放在设置页，避免挤占画布。
 */
import { DASHABLE, type PrimitiveType, type Shape } from "../model/types";
import type { CanvasBg } from "../settings/model";
import { PALETTE } from "../model/types";
import { describeShape } from "../model/describe";
import { CloseIcon } from "../icons";

const PRIMITIVES: [PrimitiveType, string][] = [
  ["circle", "圆"], ["ellipse", "椭圆"], ["arc", "圆弧"], ["rect", "矩形"],
  ["polygon", "多边形"], ["star", "星形"], ["rhombus", "菱形"], ["trapezoid", "梯形"],
  ["arrow", "箭头"], ["ray", "射线"], ["line", "直线"], ["point", "点"],
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
  color: string;
  onColor: (color: string) => void;
  shapes: Shape[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDeleteShape: (id: string) => void;
  onToggleDashed: (id: string) => void;
  lockRadius: boolean;
  lockedRadius: number | null;
}

export function OptionsDrawer(props: Props) {
  const {
    onClose, canvasBg, onCanvasBg,
    placeType, onPlaceType, placeSides, onPlaceSides, penWidth, onPenWidth,
    color, onColor,
    shapes, selectedId, onSelect, onDeleteShape, lockRadius, lockedRadius,
    onToggleDashed,
  } = props;

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

        {/* 图元类型 */}
        <section className="drawer-sec">
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
          <p className="drawer-hint">选好类型后按住拖动：拖多远决定多大，拖动中实时预览</p>
        </section>

        {/* 画笔 */}
        <section className="drawer-sec">
          <h3>笔宽</h3>
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
      </div>
    </aside>
  );
}
