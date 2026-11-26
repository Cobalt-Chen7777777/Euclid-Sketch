/**
 * 立体模型的可拖手柄：把手柄拖到哪，对应参数就变到哪。
 * 纯计算，不依赖 Three.js——SolidView 负责把 world 坐标喂进来。
 *
 * 三类语义：
 *   radial   —— 到 Y 轴的水平距离，改半径类参数（r / rTop / tube / a）
 *   vertical —— 竖直高度，改 h
 *   planar   —— 沿某一坐标轴的距离，改长宽深（box 的 w / h / d）
 */
import type { SolidShape } from "../model/types";

export interface HandleSpec {
  id: string;
  key: string;
  /** 手柄在世界坐标里的位置 */
  pos: [number, number, number];
  axis: "radial" | "vertical" | "planar-x" | "planar-y" | "planar-z";
  /** 手柄当前值（用于计算增量） */
  value: number;
  min: number;
  max: number;
  label: string;
  /** 只读参考点：vertical 手柄的基准高度 */
  base?: number;
}

/** 依据当前参数算出各手柄的位置与它控制的参数 */
export function buildHandles(solid: SolidShape): HandleSpec[] {
  const p = solid.params;
  const r = p.r ?? 2;
  const h = p.h ?? 3;
  const half = h / 2;

  switch (solid.kind) {
    case "cone":
      return [
        { id: "r", key: "r", pos: [r, -half, 0], axis: "radial", value: r, min: 0.5, max: 4, label: "底面半径" },
        { id: "h", key: "h", pos: [0, half, 0], axis: "vertical", value: h, min: 0.5, max: 6, label: "高", base: -half },
      ];
    case "cylinder":
      return [
        { id: "r", key: "r", pos: [r, -half, 0], axis: "radial", value: r, min: 0.5, max: 4, label: "半径" },
        { id: "h", key: "h", pos: [r, half, 0], axis: "vertical", value: h, min: 0.5, max: 6, label: "高", base: -half },
      ];
    case "sphere":
      return [{ id: "r", key: "r", pos: [r, 0, 0], axis: "radial", value: r, min: 0.5, max: 4, label: "半径" }];
    case "hemisphere":
      return [{ id: "r", key: "r", pos: [r, 0, 0], axis: "radial", value: r, min: 0.5, max: 4, label: "半径" }];
    case "pyramid":
      return [
        { id: "r", key: "r", pos: [r, -half, 0], axis: "radial", value: r, min: 0.5, max: 4, label: "底面半径" },
        { id: "h", key: "h", pos: [0, half, 0], axis: "vertical", value: h, min: 0.5, max: 6, label: "高", base: -half },
      ];
    case "prismFrustum":
      return [
        { id: "r", key: "r", pos: [r, -half, 0], axis: "radial", value: r, min: 0.3, max: 4, label: "下底半径" },
        { id: "rTop", key: "rTop", pos: [p.rTop ?? 0.9, half, 0], axis: "radial", value: p.rTop ?? 0.9, min: 0.2, max: 4, label: "上底半径" },
        { id: "h", key: "h", pos: [0, half, 0], axis: "vertical", value: h, min: 0.5, max: 6, label: "高", base: -half },
      ];
    case "frustum":
      return [
        { id: "r", key: "r", pos: [r, -half, 0], axis: "radial", value: r, min: 0.3, max: 4, label: "下底半径" },
        { id: "rTop", key: "rTop", pos: [p.rTop ?? 1, half, 0], axis: "radial", value: p.rTop ?? 1, min: 0.2, max: 4, label: "上底半径" },
        { id: "h", key: "h", pos: [0, half, 0], axis: "vertical", value: h, min: 0.5, max: 6, label: "高", base: -half },
      ];
    case "torus":
      return [
        { id: "r", key: "r", pos: [r + (p.tube ?? 0.6), 0, 0], axis: "radial", value: r, min: 1, max: 4, label: "主半径" },
        { id: "tube", key: "tube", pos: [r, p.tube ?? 0.6, 0], axis: "vertical", value: p.tube ?? 0.6, min: 0.2, max: 1.5, label: "管半径", base: 0 },
      ];
    case "cube": {
      const a = p.a ?? 2;
      return [{ id: "a", key: "a", pos: [a / 2, a / 2, a / 2], axis: "radial", value: a, min: 0.5, max: 4, label: "棱长" }];
    }
    case "box": {
      const w = p.w ?? 3;
      const bh = p.h ?? 2;
      const d = p.d ?? 1.6;
      return [
        { id: "w", key: "w", pos: [w / 2, 0, 0], axis: "planar-x", value: w, min: 0.5, max: 5, label: "长" },
        { id: "h", key: "h", pos: [0, bh / 2, 0], axis: "vertical", value: bh, min: 0.5, max: 5, label: "高", base: -bh / 2 },
        { id: "d", key: "d", pos: [0, 0, d / 2], axis: "planar-z", value: d, min: 0.5, max: 5, label: "宽" },
      ];
    }
    default:
      return [];
  }
}

/** 把拖到的世界坐标换算成参数值（已按 min/max 钳制） */
export function resolveValue(spec: HandleSpec, world: { x: number; y: number; z: number }): number {
  let raw: number;
  switch (spec.axis) {
    case "radial":
      raw = Math.hypot(world.x, world.z);
      // box 的棱长等于对角点距离的 2/√3；其余几何体直接就是半径
      if (spec.key === "a") raw = Math.hypot(world.x, world.y, world.z) * (2 / Math.sqrt(3));
      // 圆环主半径：拖的是外缘，要减去管半径
      if (spec.key === "r" && spec.label === "主半径") raw = Math.max(1, raw);
      break;
    case "vertical":
      raw = world.y - (spec.base ?? 0);
      break;
    case "planar-x":
      raw = Math.abs(world.x) * 2;
      break;
    case "planar-y":
      raw = Math.abs(world.y) * 2;
      break;
    case "planar-z":
      raw = Math.abs(world.z) * 2;
      break;
    default:
      raw = spec.value;
  }
  const v = Math.min(spec.max, Math.max(spec.min, raw));
  return Math.round(v * 100) / 100;
}
