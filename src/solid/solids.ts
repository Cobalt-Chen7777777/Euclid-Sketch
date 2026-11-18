/** 立体模型定义：几何生成 + 默认参数。与 Three.js 解耦，便于测试。 */
import type { SolidKind, SolidShape } from "../model/types";
import { newId } from "../model/types";

export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface SolidMeta {
  kind: SolidKind;
  name: string;
  icon: string;
  params: ParamSpec[];
}

export const SOLID_LIBRARY: SolidMeta[] = [
  {
    kind: "cone",
    name: "圆锥",
    icon: "▲",
    params: [
      { key: "r", label: "底面半径", min: 0.5, max: 4, step: 0.1, default: 2 },
      { key: "h", label: "高", min: 0.5, max: 6, step: 0.1, default: 3 },
      { key: "seg", label: "分段数", min: 8, max: 64, step: 1, default: 32 },
    ],
  },
  {
    kind: "cylinder",
    name: "圆柱",
    icon: "▮",
    params: [
      { key: "r", label: "半径", min: 0.5, max: 4, step: 0.1, default: 1.5 },
      { key: "h", label: "高", min: 0.5, max: 6, step: 0.1, default: 3 },
      { key: "seg", label: "分段数", min: 8, max: 64, step: 1, default: 32 },
    ],
  },
  {
    kind: "sphere",
    name: "球",
    icon: "●",
    params: [
      { key: "r", label: "半径", min: 0.5, max: 4, step: 0.1, default: 2 },
      { key: "seg", label: "分段数", min: 8, max: 64, step: 1, default: 32 },
    ],
  },
  {
    kind: "pyramid",
    name: "棱锥",
    icon: "◆",
    params: [
      { key: "sides", label: "底面边数", min: 3, max: 12, step: 1, default: 4 },
      { key: "r", label: "底面半径", min: 0.5, max: 4, step: 0.1, default: 2 },
      { key: "h", label: "高", min: 0.5, max: 6, step: 0.1, default: 3 },
    ],
  },
  {
    kind: "torus",
    name: "圆环",
    icon: "◎",
    params: [
      { key: "r", label: "主半径", min: 1, max: 4, step: 0.1, default: 2 },
      { key: "tube", label: "管半径", min: 0.2, max: 1.5, step: 0.1, default: 0.6 },
      { key: "seg", label: "分段数", min: 8, max: 64, step: 1, default: 32 },
    ],
  },
];

const NEW_SOLIDS: SolidMeta[] = [
  {
    kind: "cube", name: "正方体", icon: "■",
    params: [{ key: "a", label: "棱长", min: 0.5, max: 4, step: 0.1, default: 2 }],
  },
  {
    kind: "box", name: "长方体", icon: "▭",
    params: [
      { key: "w", label: "长", min: 0.5, max: 5, step: 0.1, default: 3 },
      { key: "h", label: "高", min: 0.5, max: 5, step: 0.1, default: 2 },
      { key: "d", label: "宽", min: 0.5, max: 5, step: 0.1, default: 1.6 },
    ],
  },
  {
    kind: "frustum", name: "圆台", icon: "◹",
    params: [
      { key: "rTop", label: "上底半径", min: 0.2, max: 4, step: 0.1, default: 1 },
      { key: "r", label: "下底半径", min: 0.3, max: 4, step: 0.1, default: 2 },
      { key: "h", label: "高", min: 0.5, max: 6, step: 0.1, default: 3 },
      { key: "seg", label: "分段数", min: 8, max: 64, step: 1, default: 32 },
    ],
  },
  {
    kind: "prismFrustum", name: "棱台", icon: "◺",
    params: [
      { key: "rTop", label: "上底半径", min: 0.2, max: 4, step: 0.1, default: 0.9 },
      { key: "r", label: "下底半径", min: 0.3, max: 4, step: 0.1, default: 2 },
      { key: "h", label: "高", min: 0.5, max: 6, step: 0.1, default: 3 },
      { key: "sides", label: "底面边数", min: 3, max: 10, step: 1, default: 4 },
    ],
  },
  {
    kind: "hemisphere", name: "半球", icon: "◗",
    params: [
      { key: "r", label: "半径", min: 0.5, max: 4, step: 0.1, default: 2 },
      { key: "seg", label: "分段数", min: 8, max: 64, step: 1, default: 32 },
    ],
  },
];

SOLID_LIBRARY.push(...NEW_SOLIDS);

export function defaultsFor(kind: SolidKind): Record<string, number> {
  const meta = SOLID_LIBRARY.find((m) => m.kind === kind);
  const out: Record<string, number> = {};
  if (meta) for (const p of meta.params) out[p.key] = p.default;
  return out;
}

export function createSolid(kind: SolidKind, color: string): SolidShape {
  return {
    id: newId("solid"),
    type: "solid",
    kind,
    params: defaultsFor(kind),
    color,
  };
}
