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
  /** 工具栏停靠位置 */
  railPlacement: "left" | "right" | "top" | "bottom";
  /** 迷你条方向 */
  miniOrientation: "h" | "v";
  /** 迷你条显示哪些按钮（顺序即显示顺序） */
  miniActions: string[];
  /** 调试模式：开启后设置页出现诊断日志（版本号连点 5 次切换） */
  debug: boolean;
  /** 手指触控作图：关闭后只有 Apple Pencil / 鼠标能画图（双指平移缩放保留） */
  allowTouchDraw: boolean;
  /** 手掌防误触：忽略大接触面积、笔在位时的手指，以及误触产生的极短笔迹 */
  palmReject: boolean;
  /** 插入图片的大小系数（1 = 视口 80%，0.7 = 中，0.45 = 小） */
  imageInsertScale: number;
  /** 插入卡片图时先弹选区（只插题目区时可以裁掉多余内容） */
  askCardCrop: boolean;
  /** 线型：画布样式开关——开启后画什么都画成虚线 */
  dashStyle: boolean;
  /** 工具栏显示的工具按钮（顺序即显示顺序） */
  railTools: string[];
  /** 工具栏方案：一键切换整组按钮组合 */
  railPresets: { name: string; tools: string[] }[];
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
  railPlacement: "left",
  miniOrientation: "h",
  miniActions: ["point", "line", "circle", "angle", "insert", "copy", "expand"],
  debug: false,
  allowTouchDraw: true,
  palmReject: true,
  imageInsertScale: 1,
  askCardCrop: true,
  dashStyle: false,
  railTools: ["select", "pen", "curve", "eraser", "lasso", "angle", "line", "point", "circle", "place", "image"],
  railPresets: [
    { name: "常用", tools: ["select", "pen", "curve", "eraser", "lasso", "angle", "line", "point", "circle", "place", "image"] },
    { name: "精简", tools: ["select", "pen", "eraser", "line", "point", "circle", "place"] },
  ],
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
  { id: "curve", label: "曲线" }, { id: "place", label: "全部图形" }, { id: "image", label: "插入图片" },
];

const RAIL_TOOL_IDS = new Set([
  "select", "pen", "eraser", "lasso", "angle", "line", "point", "circle",
  "ellipse", "arc", "rect", "polygon", "star", "rhombus", "trapezoid", "arrow",
  "place", "image",
]);

function readRailPresets(raw: unknown, fallback: { name: string; tools: string[] }[]): { name: string; tools: string[] }[] {
  if (!Array.isArray(raw)) return fallback;
  const presets = raw
    .filter((x): x is { name?: unknown; tools?: unknown } => typeof x === "object" && x !== null)
    .map((x) => ({
      name: typeof x.name === "string" && x.name.trim() ? x.name.trim().slice(0, 10) : "方案",
      tools: readRailTools(x.tools, []),
    }))
    .filter((x) => x.tools.length > 0);
  return presets.length > 0 ? presets : fallback;
}

function readRailTools(raw: unknown, fallback: string[]): string[] {
  if (!Array.isArray(raw)) return fallback;
  const picked = raw.filter((x): x is string => typeof x === "string" && RAIL_TOOL_IDS.has(x));
  return picked.length > 0 ? picked : fallback;
}

function readTheme(raw: unknown, fallback: ThemeMode): ThemeMode {
  return raw === "light" || raw === "dark" || raw === "auto" ? raw : fallback;
}

/**
 * 迷你条按钮：去重，并强制保留 expand。
 * 收起态只能从迷你条展开，缺了它面板就再也打不开——旧数据里被删过也要补回来。
 */
function readMiniActions(raw: unknown, fallback: string[]): string[] {
  const list = Array.isArray(raw)
    ? raw.filter((x): x is string => typeof x === "string")
    : fallback;
  const deduped = [...new Set(list)];
  if (!deduped.includes("expand")) deduped.push("expand");
  return deduped.length > 0 ? deduped : fallback;
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
    gridStep: readNumber(source.gridStep, DEFAULT_SETTINGS.gridStep, 1, 100),
    railPlacement: (["left", "right", "top", "bottom"] as const).includes(source.railPlacement as never)
      ? (source.railPlacement as SketchSettings["railPlacement"])
      : "left",
    miniOrientation: source.miniOrientation === "v" ? "v" : "h",
    miniActions: readMiniActions(source.miniActions, DEFAULT_SETTINGS.miniActions),
    debug: readBoolean(source.debug, DEFAULT_SETTINGS.debug),
    allowTouchDraw: readBoolean(source.allowTouchDraw, DEFAULT_SETTINGS.allowTouchDraw),
    palmReject: readBoolean(source.palmReject, DEFAULT_SETTINGS.palmReject),
    imageInsertScale: readNumber(source.imageInsertScale, DEFAULT_SETTINGS.imageInsertScale, 0.3, 1),
    askCardCrop: readBoolean(source.askCardCrop, DEFAULT_SETTINGS.askCardCrop),
    dashStyle: readBoolean(source.dashStyle ?? (source as Record<string, unknown>).dashedDefault, DEFAULT_SETTINGS.dashStyle),
    railTools: readRailTools(source.railTools, DEFAULT_SETTINGS.railTools),
    railPresets: readRailPresets(source.railPresets, DEFAULT_SETTINGS.railPresets),
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

/** 本地是否已经有保存过的设置（重装后首次启动时为 false） */
export function hasStoredSettings(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
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
