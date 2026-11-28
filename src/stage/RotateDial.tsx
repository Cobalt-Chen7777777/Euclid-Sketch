/**
 * 旋转旋钮：和角度 / 多边形参数里那一个一模一样，拖一圈自由调朝向。
 * 矩形、椭圆、线段、圆弧共用。
 */
import type { Shape } from "../model/types";
import { orientDeg, orientPatch } from "../model/rotate";

import { AngleDial } from "./AngleDial";

export function RotateDial({ shape, onUpdateShape }: {
  shape: Shape;
  onUpdateShape: (id: string, updater: (s: Shape) => Shape) => void;
}) {
  const deg = orientDeg(shape);
  return (
    <div className="dial-row">
      <AngleDial deg={deg} onChange={(d) => onUpdateShape(shape.id, (s) => orientPatch(s, d))} label="旋转角度" />
      <span className="drawer-hint">拖动旋钮自由旋转</span>
      <output>{deg}°</output>
    </div>
  );
}
