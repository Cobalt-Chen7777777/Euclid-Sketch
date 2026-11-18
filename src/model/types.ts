/**
 * 统一图形模型。
 * 所有图形（2D / 3D、公式生成 / 手动绘制 / 文件导入）都序列化为 Shape[]，
 * 公式输入、圆规绘制、文件导入、导出均围绕该结构运作。
 */

export type Point2 = { x: number; y: number };

/** 二维坐标范围（世界坐标） */
export type Range = [number, number];

export interface CoordShape {
  id: string;
  type: "coord";
  xRange: Range;
  yRange: Range;
  /** 网格间距，0 表示不画网格 */
  grid: number;
  /** 是否显示坐标轴箭头与刻度 */
  axes: boolean;
}

export interface CircleShape {
  id: string;
  type: "circle";
  cx: number;
  cy: number;
  r: number;
  /** 公式来源（如 x²+y²=r²），手动绘制时为空 */
  source?: string;
  color: string;
}

export interface FunctionShape {
  id: string;
  type: "function";
  /** 形如 "sin(x)" 或 "x^2"，因变量固定为 y */
  expr: string;
  xRange: Range;
  color: string;
}

export interface ParametricShape {
  id: string;
  type: "parametric";
  /** 参数方程，如 x=cos(t), y=sin(t) */
  xExpr: string;
  yExpr: string;
  tRange: Range;
  color: string;
}

export interface PointShape {
  id: string;
  type: "point";
  x: number;
  y: number;
  color: string;
}

export interface LineShape {
  id: string;
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export interface EllipseShape {
  id: string;
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  color: string;
}

export interface ArcShape {
  id: string;
  type: "arc";
  cx: number;
  cy: number;
  r: number;
  /** 起止角（弧度） */
  startAngle: number;
  endAngle: number;
  color: string;
}

export interface RectShape {
  id: string;
  type: "rect";
  /** 对角两点定义（轴对齐矩形） */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

export interface PolygonShape {
  id: string;
  type: "polygon";
  /** 外接圆中心、半径 */
  cx: number;
  cy: number;
  r: number;
  sides: number;
  /** 起始旋转角（弧度） */
  rotation: number;
  color: string;
}

export interface RayShape {
  id: string;
  type: "ray";
  /** 起点 + 方向上一点（无限延伸） */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
}

/** 自由笔迹（草稿纸画笔）：世界坐标点序列 */
export interface InkShape {
  id: string;
  type: "ink";
  /** 采样的世界坐标点（顺序即笔画顺序） */
  points: Point2[];
  color: string;
  /** 线宽（屏幕像素，随缩放保持稳定） */
  width: number;
}

/** 点集图形（星形 / 菱形 / 梯形 / 箭头），统一用顶点列表表达 */
export interface PolyShape {
  id: string;
  type: "poly";
  kind: "star" | "rhombus" | "trapezoid" | "arrow";
  points: Point2[];
  /** 是否闭合（箭头为开放折线） */
  closed: boolean;
  color: string;
}

/**
 * 角度标注：顶点 + 两条边的方向角（弧度，数学正方向，y 向上）。
 * 用于画特殊角（30°/45°/60°/90°…），直角自动画方角标记。
 */
export interface AngleShape {
  id: string;
  type: "angle";
  /** 顶点 */
  vx: number;
  vy: number;
  /** 第一条边的方向角 */
  a1: number;
  /** 第二条边的方向角 */
  a2: number;
  /** 标注弧半径（世界单位） */
  r: number;
  color: string;
}

export type SolidKind =
  | "cone" | "cylinder" | "sphere" | "pyramid" | "torus"
  | "cube" | "box" | "frustum" | "prismFrustum" | "hemisphere";

export interface SolidShape {
  id: string;
  type: "solid";
  kind: SolidKind;
  /** 各模型参数，键随 kind 不同 */
  params: Record<string, number>;
  color: string;
}

export type Shape =
  | CoordShape
  | CircleShape
  | EllipseShape
  | ArcShape
  | RectShape
  | PolygonShape
  | RayShape
  | FunctionShape
  | ParametricShape
  | PointShape
  | LineShape
  | InkShape
  | AngleShape
  | PolyShape
  | SolidShape;

/** 可拖拽/可创建的 2D 图元类型（不含坐标系、函数、参数方程、3D、点） */
export type PrimitiveType =
  | "circle" | "ellipse" | "arc" | "rect" | "polygon" | "ray" | "line" | "point"
  | "star" | "rhombus" | "trapezoid" | "arrow";

export interface SketchDocument {
  version: 1;
  /** 2D 图形 */
  shapes: Shape[];
  /** 画布视图 */
  view: {
    xRange: Range;
    yRange: Range;
    grid: number;
  };
}

export const DEFAULT_DOCUMENT: SketchDocument = {
  version: 1,
  shapes: [
    {
      id: "coord-default",
      type: "coord",
      xRange: [-10, 10],
      yRange: [-6, 6],
      grid: 1,
      axes: true,
    },
  ],
  view: {
    xRange: [-10, 10],
    yRange: [-6, 6],
    grid: 1,
  },
};

export const PALETTE = [
  "#2563eb",
  "#dc2626",
  "#059669",
  "#d97706",
  "#7c3aed",
  "#0891b2",
];

let seq = 0;
export function newId(prefix = "s"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}
