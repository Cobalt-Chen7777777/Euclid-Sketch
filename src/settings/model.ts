/**
 * 插件设置：类型、默认值、持久化。
 *
 * 设置项都是「会真实影响画布行为」的开关，不做样子货：
 * 每一项都能在 Canvas2D / ShapeLayer / 尺寸 Hook 里找到对应消费点。
 */
/** 外观：跟随 MN/系统，或强制浅色/深色 */
export type ThemeMode = "auto" | "light" | "dark";

/** 画布背景：坐标系（带网格刻度）或空白草稿纸 */
export type CanvasBg = "coord" | "blank";

export interface SketchSettings {
  /** 外观：默认跟随 MN 的白天/夜间 */
  theme: ThemeMode;
  /** 画布背景模式 */
  canvasBg: CanvasBg;
  /** 画布：显示网格 */
  showGrid: boolean;
  /** 画布：显示刻度数字 */
  showTicks: boolean;
  /** 画布：吸附到已有点/控制点 */
  snapEnabled: boolean;
  /** 画布：网格密度（世界坐标单位） */
  gridStep: number;
  /** 线型：新画图元默认为虚线 */
  dashedDefault: boolean;
  /** 工具栏显示的工具按钮（顺序即显示顺序） */
  railTools: string[];
  /** 图元：描边线宽 */
  strokeWidth: number;
  /** 画笔：默认笔宽 */
  penWidth: number;
  /** 画笔：笔迹平滑（对采样点做低通） */
  inkSmoothing: boolean;
  /** 画笔：橡皮命中半径（屏幕像素） */
  eraserRadius: number;
  /** 图元：默认颜色 */
  shapeColor: string;
  /** 图元：多边形默认边数 */
  polygonSides: number;
  /** 角度工具：是否把第二条边吸附到特殊角（默认关闭 = 任意角度） */
  specialAngleSnap: boolean;
  /** 窗口：记住上次调整的窗口尺寸 */
  rememberWindowSize: boolean;
  /** 窗口：面板高度跟随内容自动调整（官方 mn.fit()） */
  autoFitHeight: boolean;
}

export const DEFAULT_SETTINGS: SketchSettings = {
  theme: "auto",
  canvasBg: "coord",
  showGrid: true,
  showTicks: true,
  snapEnabled: true,
  gridStep: 1,
  dashedDefault: false,
  railTools: ["select", "pen", "eraser", "lasso", "angle", "line", "point", "circle", "place", "compass", "image"],
  strokeWidth: 2,
  penWidth: 3,
  inkSmoothing: true,
  eraserRadius: 14,
  shapeColor: "#2563eb",
  polygonSides: 5,
  specialAngleSnap: false,
  rememberWindowSize: true,
  autoFitHeight: false,
};

const STORAGE_KEY = "math-sketch-addon.settings.v1";

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value));

/** 读取数字并钳制；非法值回退默认 */
function readNumber(raw: unknown, fallback: number, low: number, high: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  return Math.round(clamp(raw, low, high) * 100) / 100;
}

function readBoolean(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

/** 工具栏可选按钮目录（设置页展示 + ToolRail 图标映射共用 id） */
export const RAIL_CATALOG: { id: string; label: string }[] = [
  { id: "select", label: "选择" }, { id: "pen", label: "画笔" }, { id: "eraser", label: "橡皮" },
  { id: "lasso", label: "套索" }, { id: "angle", label: "画角度" }, { id: "line", label: "线段" },
  { id: "point", label: "点" }, { id: "circle", label: "圆" }, { id: "ellipse", label: "椭圆" },
  { id: "rect", label: "矩形" }, { id: "polygon", label: "多边形" }, { id: "arc", label: "圆弧" },
  { id: "place", label: "全部图形" }, { id: "compass", label: "圆规" }, { id: "image", label: "插入图片" },
];

const RAIL_TOOL_IDS = new Set([
  "select", "pen", "eraser", "lasso", "angle", "line", "point", "circle",
  "ellipse", "arc", "rect", "polygon", "star", "rhombus", "trapezoid", "arrow",
  "place", "compass", "image",
]);

function readRailTools(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  const picked = raw.filter((x): x is string => typeof x === "string" && RAIL_TOOL_IDS.has(x));
  return picked.length > 0 ? picked : fallback;
}

function readTheme(raw: unknown, fallback: ThemeMode): ThemeMode {
  return raw === "light" || raw === "dark" || raw === "auto" ? raw : fallback;
}

function readCanvasBg(raw: unknown, fallback: CanvasBg): CanvasBg {
  return raw === "blank" || raw === "coord" ? raw : fallback;
}

function readColor(raw: unknown, fallback: string): string {
  return typeof raw === "string" && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw : fallback;
}

/** 把任意来源（本地缓存 / 旧版本数据）规范化为完整设置 */
export function normalizeSettings(raw: unknown): SketchSettings {
  const source = (raw ?? {}) as Partial<Record<keyof SketchSettings, unknown>>;
  return {
    theme: readTheme(source.theme, DEFAULT_SETTINGS.theme),
    canvasBg: readCanvasBg(source.canvasBg, DEFAULT_SETTINGS.canvasBg),
    showGrid: readBoolean(source.showGrid, DEFAULT_SETTINGS.showGrid),
    showTicks: readBoolean(source.showTicks, DEFAULT_SETTINGS.showTicks),
    snapEnabled: readBoolean(source.snapEnabled, DEFAULT_SETTINGS.snapEnabled),
    gridStep: readNumber(source.gridStep, DEFAULT_SETTINGS.gridStep, 0.25, 5),
    dashedDefault: readBoolean(source.dashedDefault, DEFAULT_SETTINGS.dashedDefault),
    railTools: readRailTools(source.railTools, DEFAULT_SETTINGS.railTools),
    strokeWidth: readNumber(source.strokeWidth, DEFAULT_SETTINGS.strokeWidth, 1, 6),
    penWidth: readNumber(source.penWidth, DEFAULT_SETTINGS.penWidth, 1, 12),
    inkSmoothing: readBoolean(source.inkSmoothing, DEFAULT_SETTINGS.inkSmoothing),
    eraserRadius: readNumber(source.eraserRadius, DEFAULT_SETTINGS.eraserRadius, 8, 40),
    shapeColor: readColor(source.shapeColor, DEFAULT_SETTINGS.shapeColor),
    polygonSides: readNumber(source.polygonSides, DEFAULT_SETTINGS.polygonSides, 3, 12),
    specialAngleSnap: readBoolean(source.specialAngleSnap, DEFAULT_SETTINGS.specialAngleSnap),
    rememberWindowSize: readBoolean(source.rememberWindowSize, DEFAULT_SETTINGS.rememberWindowSize),
    autoFitHeight: readBoolean(source.autoFitHeight, DEFAULT_SETTINGS.autoFitHeight),
  };
}

export function loadSettings(): SketchSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeSettings(JSON.parse(raw));
  } catch {
    // 缓存损坏或不可用时回退默认值
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: SketchSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 存储不可用时本次会话内仍生效
  }
}

export function clearStoredSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略
  }
}
