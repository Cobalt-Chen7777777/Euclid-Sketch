/**
 * 「绘图选项」里的自由多边形参数：边数 + 每条边的长度。
 * 闭合多边形改一条边，下一条会跟着变——这是几何上的必然，所以按想要的顺序调一遍即可。
 */
import type { PolyShape, Shape } from "../model/types";
import { polySideCountPatch, polySideLen, polySideLenPatch, rotatePoly } from "../model/poly";
import { ParamInput } from "./ParamInput";
import { AngleDial } from "./AngleDial";

interface Props {
  shape: PolyShape;
  onUpdateShape: (id: string, patch: (s: Shape) => Shape) => void;
}

/** 多边形的朝向：质心指向第一个顶点的方向 */
function polyAngle(points: { x: number; y: number }[]): number {
  if (points.length === 0) return 0;
  const c = points.reduce((a, p) => ({ x: a.x + p.x / points.length, y: a.y + p.y / points.length }), { x: 0, y: 0 });
  const p0 = points[0]!;
  return Math.atan2(p0.y - c.y, p0.x - c.x);
}

export function PolyParams({ shape, onUpdateShape }: Props) {
  const update = (fn: (s: PolyShape) => Shape) => onUpdateShape(shape.id, (s) => (s.type === "poly" ? fn(s) : s));

  return (
    <>
      {/* 边数是整数档位，用拖杆比输入框顺手 */}
      <label className="drawer-row">
        <span>边数</span>
        <input
          type="range" min={3} max={24} step={1}
          value={shape.points.length}
          onChange={(e) => update((s) => polySideCountPatch(s, Number(e.target.value)) ?? s)}
        />
        <output>{shape.points.length}</output>
      </label>
      {shape.points.map((_, i) => (
        <label className="param-row" key={`side-${i}`}>
          <span>边{i + 1}</span>
          <ParamInput
            value={polySideLen(shape, i)}
            step="0.5"
            onCommit={(len) => update((s) => polySideLenPatch(s, i, len) ?? s)}
          />
          <span className="param-unit">格</span>
        </label>
      ))}
      {/* 自由多边形没有「角度」字段，用旋钮拖出目标朝向，再按差值整体转 */}
      <div className="dial-row">
        <AngleDial
          deg={((Math.round((polyAngle(shape.points) * 180) / Math.PI) % 360) + 360) % 360}
          onChange={(d) => update((s) => rotatePoly(s, ((d * Math.PI) / 180) - polyAngle(s.points)))}
          label="多边形旋转角度"
        />
        <span className="drawer-hint">拖动旋钮自由旋转</span>
        <output>{((Math.round((polyAngle(shape.points) * 180) / Math.PI) % 360) + 360) % 360}°</output>
      </div>
      <p className="drawer-hint">闭合多边形改一条边，下一条会跟着变；顶点也能直接在画布上拖</p>
    </>
  );
}
