/**
 * 「绘图选项」里的角度参数：角度值、朝向、边长，外加角度锁定。
 * 拆成独立组件，免得主抽屉越堆越长。
 */
import type { AngleShape, Shape } from "../model/types";
import { angleOrientDeg, angleOrientPatch, angleSpanDeg } from "../model/angle";
import { angleLenPatch, angleRadiusFor, angleSpanPatch } from "../model/paramEdits";
import { ParamInput } from "./ParamInput";

interface Props {
  shape: AngleShape;
  onUpdateShape: (id: string, patch: (s: Shape) => Shape) => void;
}

export function AngleParams({ shape, onUpdateShape }: Props) {
  const update = (fn: (s: AngleShape) => Shape) => onUpdateShape(shape.id, (s) => (s.type === "angle" ? fn(s) : s));

  return (
    <>
      <label className="param-row">
        <span>角度</span>
        <ParamInput
          value={Math.round(angleSpanDeg(shape))}
          step="5"
          // 锁定状态下改角度值要同步锁定的目标值，否则下一次拖边会被旧锁定值拉回去
          onCommit={(deg) => update((s) => ({
            ...s,
            ...angleSpanPatch(s, deg),
            ...(s.lockDeg ? { lockDeg: Math.min(179, Math.max(1, deg)) } : {}),
          }))}
        />
        <span className="param-unit">°</span>
      </label>
      <label className="param-row">
        <span>朝向</span>
        <ParamInput
          value={angleOrientDeg(shape)}
          step="15"
          positive={false}
          onCommit={(deg) => update((s) => ({ ...s, ...angleOrientPatch(s, deg) }))}
        />
        <span className="param-unit">°</span>
      </label>
      <label className="param-row">
        <span>边长</span>
        <ParamInput
          value={shape.len ?? shape.r * 1.3}
          step="0.5"
          onCommit={(len) => update((s) => ({ ...s, ...angleLenPatch(len), r: angleRadiusFor(len) }))}
        />
        <span className="param-unit">格</span>
      </label>
      <div className="chips">
        <button
          type="button"
          className={`chip${shape.lockDeg ? " on" : ""}`}
          onClick={() => update((s) => ({ ...s, lockDeg: s.lockDeg ? undefined : Math.round(angleSpanDeg(s)) }))}
          title="锁定后夹角固定，拖任一条边都是整角绕顶点旋转"
        >
          {shape.lockDeg ? "角度已锁定" : "锁定角度"}
        </button>
      </div>
    </>
  );
}
