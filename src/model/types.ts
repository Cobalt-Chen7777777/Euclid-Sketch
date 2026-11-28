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
  /** 线型：虚线 */
  dashed?: boolean;
  color: string;
}

export interface FunctionShape {
  id: string;
  type: "function";
  /** 形如 "sin(x)" 或 "x^2"，因变量固定为 y */
  expr: string;
  xRange: Range;
  /** 公式来源（由函数面板绘制时写入，用于统一列出与清除） */
  source?: string;
  /** 线型：虚线 */
  dashed?: boolean;
  color: string;
}

/** 极坐标曲线：r = f(θ) */
export interface PolarShape {
  id: string;
  type: "polar";
  /** r 关于 θ 的表达式（变量写 t、theta 或 θ 都可以，内部统一成 t） */
  expr: string;
  /** θ 的范围，默认 0..2π */
  tRange: Range;
  source?: string;
  dashed?: boolean;
  color: string;
}

export interface ParametricShape {
  id: string;
  type: "parametric";
  /** 参数方程，如 x=cos(t), y=sin(t) */
  xExpr: string;
  yExpr: string;
  tRange: Range;
  /** 公式来源（由函数面板绘制时写入） */
  source?: string;
  /** 线型：虚线 */
  dashed?: boolean;
  color: string;
}

/**
 * 隐函数：任意形如 F(x,y)=0 的方程（xy=1、x^2+y^2=1、x^3+y^3-3xy=0 ……）。
 * 存储的是已归一的 F 表达式，渲染时在 xRange × yRange 的方框内用菱形方格采样成折线，
 * 所以缩放后线条仍然是连续的，只是分辨率固定。
 */
export interface ImplicitShape {
  id: string;
  type: "implicit";
  /** 已归一为 F(x,y)=0 的表达式，如 "xy-1"、"x^2+y^2-1" */
  expr: string;
  xRange: Range;
  yRange: Range;
  /** 公式来源（由函数面板绘制时写入） */
  source?: string;
  /** 线型：虚线 */
  dashed?: boolean;
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
  /** 线型：虚线 */
  dashed?: boolean;
  color: string;
}

export interface EllipseShape {
  id: string;
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** 旋转角（弧度，绕椭圆中心） */
  rot?: number;
  /** 公式来源（由函数面板绘制时写入；手动拖出的椭圆为空） */
  source?: string;
  /** 线型：虚线 */
  dashed?: boolean;
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
  /** 线型：虚线 */
  dashed?: boolean;
  color: string;
}

export interface RectShape {
  id: string;
  type: "rect";
  /** 对角两点定义（未旋转时的轴对齐矩形） */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** 旋转角（弧度，绕矩形中心） */
  rot?: number;
  /** 线型：虚线 */
  dashed?: boolean;
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
  /** 线型：虚线 */
  dashed?: boolean;
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
  /** 线型：虚线 */
  dashed?: boolean;
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
  /** 平滑曲线：多点曲线工具生成，渲染时按 Catmull-Rom 平滑 */
  smooth?: boolean;
  /** 每点的出向切线（世界单位）；有值时按三次贝塞尔渲染，可拖手柄单独调曲率 */
  tangents?: Point2[];
  /** 每点压感（0–1）：Apple Pencil 记录，渲染时按力度分档变粗 */
  pressures?: number[];
}

/** 点集图形（星形 / 菱形 / 梯形 / 箭头），统一用顶点列表表达 */
export interface PolyShape {
  id: string;
  type: "poly";
  /** irregular = 边长相等的正多边形转过来的自由多边形（每条边都能单独调） */
  kind: "star" | "rhombus" | "trapezoid" | "arrow" | "irregular";
  points: Point2[];
  /** 是否闭合（箭头为开放折线） */
  closed: boolean;
  /** 线型：虚线 */
  dashed?: boolean;
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
  /** 两条边的长度（等长）；缺省时按标注弧半径推算 */
  len?: number;
  /** 第二条边长度（缺省时取 len） */
  len2?: number;
  /** 线型：虚线 */
  dashed?: boolean;
  /** 锁定角度（度）：设了值以后夹角不再变，拖任一条边都是整角绕顶点旋转 */
  lockDeg?: number | undefined;
  color: string;
}

/** 支持虚线线型的图形类型（描边类） */
export const DASHABLE = new Set([
  "circle", "ellipse", "arc", "rect", "polygon", "poly", "ray", "line", "angle", "function", "parametric",
]);

/** 画布图片（题目照片等；导入时压缩为 dataURL） */
export interface ImageShape {
  id: string;
  type: "image";
  /** 左下角 */
  x: number;
  y: number;
  w: number;
  h: number;
  src: string;
  color: string;
  /** 锁定保护：橡皮擦不掉（导入默认锁定，图片左上角徽标可切换） */
  locked?: boolean;
  /** 原图在图片库（IndexedDB）里的 id；有它就不看 src */
  imgId?: string;
  /** 旋转角（弧度，绕图片中心） */
  rot?: number;
  /** 真实宽高比（height/width）：缩放时按它校正，避免长图被压扁变形 */
  aspect?: number;
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

/** 图层与可见性：所有图形通用（缺省 = 图层 0 / 可见 / 未锁） */
export interface LayerProps {
  /** 图层序号：0 起，越大越靠上 */
  layer?: number;
  /** 隐藏：不渲染、不参与命中与导出 */
  hidden?: boolean;
  /** 锁定：不可选中、拖动、擦除（图片的 locked 语义为「防误擦」，仍可选中以解锁） */
  locked?: boolean;
}

export type Shape = (
  | CoordShape
  | CircleShape
  | EllipseShape
  | ArcShape
  | RectShape
  | PolygonShape
  | RayShape
  | FunctionShape
  | ParametricShape
  | PolarShape
  | ImplicitShape
  | PointShape
  | LineShape
  | InkShape
  | AngleShape
  | PolyShape
  | ImageShape
  | SolidShape
) &
  LayerProps;

/** 可拖拽/可创建的 2D 图元类型（不含坐标系、函数、参数方程、3D、点） */
export type PrimitiveType =
  | "circle" | "ellipse" | "arc" | "rect" | "polygon" | "ray" | "line" | "point"
  | "star" | "rhombus" | "trapezoid" | "arrow" | "angle";

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

/** 画笔/图元调色板：墨色与灰在前（批注最常用），后面是七种色相 */
export const PALETTE = [
  "#2a2723", // 墨黑
  "#6b655d", // 灰
  "#2563eb", // 蓝
  "#0891b2", // 青
  "#059669", // 绿
  "#65a30d", // 草绿
  "#d97706", // 橙
  "#dc2626", // 红
  "#db2777", // 玫红
  "#7c3aed", // 紫
  "#4f46e5", // 靛
  "#0f766e", // 深青
  "#a16207", // 金褐
  "#57534e", // 暖灰
];

let seq = 0;
export function newId(prefix = "s"): string {
  seq += 1;
  return `${prefix}-${Date.now().toString(36)}-${seq.toString(36)}`;
}
