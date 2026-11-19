import { useRef, useCallback, useEffect, useMemo, useState } from "react";

import { Canvas2D, type CanvasOptions, type Tool } from "./canvas/Canvas2D";
import type { Viewport } from "./canvas/viewport";
import { addComment, focusCard, getCapabilities, hasImageWriteCapability, renderCardImage } from "./bridge";
import {
  downloadDocument,
  downloadBlob,
  dataUrlToBlob,
  renderExportDataUrl,
} from "./export/image";
import { buildSketchReport } from "./model/describe";
import { isFormulaShape, parseFormula } from "./model/formula";
import { DASHABLE } from "./model/types";
import {
  DEFAULT_DOCUMENT,
  type PrimitiveType,
  type Shape,
  type SketchDocument,
  type SolidKind,
  type SolidShape,
} from "./model/types";
import { createSolid } from "./solid/solids";
import { getCurrentTopic, listCards, type Card } from "./topic";
import { useResizablePanel } from "./useResizablePanel";
import {
  DEFAULT_SETTINGS,
  clearStoredSettings,
  loadSettings,
  saveSettings,
  type SketchSettings,
} from "./settings/model";
import { SettingsPage } from "./settings/SettingsPage";
import { fitPanelHeight, useAutoFitHeight } from "./settings/useAutoFit";
import { PanelHeader } from "./PanelHeader";
import { ToolRail } from "./stage/ToolRail";
import { OptionsDrawer } from "./stage/OptionsDrawer";
import { SolidStage } from "./stage/SolidStage";
import { FunctionPad } from "./stage/FunctionPad";
import { resolveTheme } from "./theme";
import { useLassoClipboard } from "./useLassoClipboard";
import { useHistoryShapes, useUndoHotkeys } from "./useHistoryShapes";
import { HistoryButtons } from "./stage/HistoryButtons";
import { HiddenFileInputs } from "./HiddenFileInputs";
import { readDocumentFile, toExportDoc } from "./io/documents";
import { fileToImageShape, imageSrcToShape } from "./model/image";
import { LassoBar } from "./stage/LassoBar";

const VIEW_W = 400;
const VIEW_H = 240;

interface AppProps {
  /** 入口传入：系统（或 MN）当前是否深色 */
  systemDark?: boolean;
  /** 入口传入：MN 自己声明的主题 */
  mnTheme?: string | null;
}

export function App({ systemDark = false, mnTheme = null }: AppProps = {}) {
  // ---- 文档状态 ----
  const [doc, setDoc] = useState<SketchDocument>(() => structuredClone(DEFAULT_DOCUMENT));
  const shapes = doc.shapes;
  const rawSetShapes = useCallback(
    (updater: React.SetStateAction<Shape[]>) => {
      setDoc((prev) => ({
        ...prev,
        shapes: typeof updater === "function" ? updater(prev.shapes) : updater,
      }));
    },
    [],
  );

  // 撤销/重做：包装 setShapes，所有改图形的操作自动进历史栈
  const { commit: setShapes, undo, redo, canUndo, canRedo } = useHistoryShapes(shapes, rawSetShapes);

  const [viewport, setViewport] = useState<Viewport>({
    width: VIEW_W,
    height: VIEW_H,
    xRange: [...doc.view.xRange] as [number, number],
    yRange: [...doc.view.yRange] as [number, number],
  });

  // ---- UI 状态 ----
  const [view, setView] = useState<"canvas" | "settings">("canvas");
  const [tab, setTab] = useState<"2d" | "fn" | "3d">("2d");
  const [tool, setTool] = useState<Tool>("select");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formulaMsg, setFormulaMsg] = useState("");
  // 正在输入法里打字：暂停自动高度，避免键盘弹起/收起引发反复 mn.fit
  const [typing, setTyping] = useState(false);
  const [toast, setToast] = useState("");
  const [lockRadius, setLockRadius] = useState(false);
  const [lockedRadius, setLockedRadius] = useState<number | null>(null);
  const [placeType, setPlaceType] = useState<PrimitiveType>("rect");

  // 3D 当前模型（稳定对象引用，参数更新时替换）
  const [solid, setSolid] = useState<SolidShape | null>(null);
  const captureRef = useRef<(() => string) | null>(null);

  // MN 卡片
  const [topic, setTopic] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [targetCard, setTargetCard] = useState<string>("");
  const [canWriteImage, setCanWriteImage] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? "" : cur)), 2200);
  }, []);

  // ---- 设置：本地持久化，改一项存一项 ----
  const [settings, setSettings] = useState<SketchSettings>(loadSettings);
  const updateSettings = useCallback((patch: Partial<SketchSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);
  const resetSettings = useCallback(() => {
    clearStoredSettings();
    setSettings({ ...DEFAULT_SETTINGS });
    showToast("已恢复默认设置");
  }, [showToast]);

  // 设置直接作为绘制参数的单一来源，避免画布与设置页各存一份导致不同步
  const color = settings.shapeColor;
  const penWidth = settings.penWidth;
  const placeSides = settings.polygonSides;

  const canvasOptions: CanvasOptions = useMemo(() => ({
    // 空白画布 = 连网格和刻度一起关掉，只剩一张纸
    showGrid: settings.canvasBg === "coord" && settings.showGrid,
    showTicks: settings.canvasBg === "coord" && settings.showTicks,
    snapEnabled: settings.snapEnabled,
    gridStep: settings.gridStep,
    strokeWidth: settings.strokeWidth,
    eraserRadius: settings.eraserRadius,
    inkSmoothing: settings.inkSmoothing,
    specialAngleSnap: settings.specialAngleSnap,
    dashStyle: settings.dashStyle,
    allowTouchDraw: settings.allowTouchDraw,
  }), [settings]);

  // 面板尺寸记忆与收起/关闭（右下角把手拖动缩放）
  const { resetSize, collapse, expand, close, onResizePointerDown, isResizing } = useResizablePanel({
    remember: settings.rememberWindowSize,
  });
  // 收起为迷你条时暂停高度自适应，否则 mn.fit 会把迷你条撑回内容高度；拖动把手缩放时也暂停（避免 mn.fit 拉锯）
  const [collapsed, setCollapsed] = useState(false);
  const autoFitRef = useAutoFitHeight(settings.autoFitHeight && !collapsed && !typing && !isResizing);
  // 快捷键（Ctrl/Cmd+Z / Shift+Z / Ctrl+Y）监听挂在面板根元素上
  useUndoHotkeys(autoFitRef, undo, redo);

  const onCollapse = useCallback(() => {
    setCollapsed(true);
    collapse();
  }, [collapse]);
  const onExpand = useCallback(() => {
    setCollapsed(false);
    expand();
  }, [expand]);

  // 初始化：读取当前学习集与能力
  useEffect(() => {
    let active = true;
    getCurrentTopic()
      .then(async (tid) => {
        if (!active) return;
        setTopic(tid);
        if (tid) {
          const items = await listCards(tid);
          if (!active) return;
          setCards(items);
          setTargetCard((cur) => cur || items[0]?.noteid || "");
        }
        const caps = await getCapabilities();
        setCanWriteImage(await hasImageWriteCapability(caps));
      })
      .catch((e: unknown) => showToast(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [showToast]);

  // ---- 公式添加（由函数面板传入表达式，返回是否成功） ----
  const onAddFormula = useCallback((src: string): { ok: boolean } => {
    const result = parseFormula(src, color);
    if (result.kind === "error") {
      setFormulaMsg(result.message);
      return { ok: false };
    }
    setShapes((prev) => [...prev, result.shape]);
    setFormulaMsg("");
    // 在函数面板里连续绘制时不切走，切回 2D 反而会把面板关掉
    setTab((cur) => (cur === "fn" ? "fn" : "2d"));
    showToast("已添加公式图形");
    return { ok: true };
  }, [color, setShapes, showToast]);

  // ---- 圆规锁定半径 ----
  const onToggleLock = () => {
    if (!lockRadius && lockedRadius == null) {
      showToast("先用圆规画一个圆，再锁定半径");
      return;
    }
    setLockRadius((v) => !v);
  };

  const onDeleteShape = useCallback((id: string) => {
    setShapes((prev) => prev.filter((x) => x.id !== id));
    setSelectedId((cur) => (cur === id ? null : cur));
  }, [setShapes]);

  // 套索多选 + 剪贴板（复制 / 剪切 / 粘贴 / 删除）
  const lasso = useLassoClipboard(shapes, setShapes, showToast);

  // 图片导入（题目照片等）
  const imageInputRef = useRef<HTMLInputElement>(null);
  const onImportImage = useCallback(async (file: File) => {
    try {
      const shape = await fileToImageShape(file, viewport, color);
      setShapes((prev) => [...prev, shape]);
      setSelectedId(shape.id);
      showToast(`已插入图片（约 ${Math.round(shape.src.length / 1024)}KB）`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "图片导入失败");
    }
  }, [viewport, color, setShapes, showToast]);

  /** 从当前选定卡片渲染长图，插入画布（题目图上作图的主入口） */
  const onImportCardImage = useCallback(async () => {
    if (!targetCard) {
      showToast("请先通过「下一张卡片」或设置页选定一张卡片");
      return;
    }
    try {
      const rendered = await renderCardImage(targetCard);
      if (!rendered) {
        showToast("卡片渲染失败：卡片可能没有内容，或长图超过像素上限");
        return;
      }
      const shape = await imageSrcToShape(rendered.src, viewport, color, true);
      setShapes((prev) => [...prev, shape]);
      setSelectedId(shape.id);
      showToast("已插入卡片图，可在图上直接作图");
    } catch (e) {
      showToast(`插入卡片图失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  }, [targetCard, viewport, color, setShapes, showToast]);

  /** 切换某个已有图形的虚线线型 */
  const onToggleDashed = useCallback((id: string) => {
    setShapes((prev) => prev.map((x) => {
      if (x.id !== id || !DASHABLE.has(x.type)) return x;
      const cur = "dashed" in x && x.dashed;
      return { ...x, dashed: !cur } as typeof x;
    }));
  }, [setShapes]);

  /** 切换图片锁定（锁定后橡皮擦不掉，仍可拖动缩放） */
  const onToggleImageLock = useCallback((id: string) => {
    setShapes((prev) => prev.map((x) => {
      if (x.id !== id || x.type !== "image") return x;
      const nowLocked = !x.locked;
      showToast(nowLocked ? "图片已锁定" : "图片已解锁");
      return { ...x, locked: nowLocked };
    }));
  }, [setShapes, showToast]);

  // 清除所有「函数面板」绘制的图形；手画的图元/笔迹不受影响
  const onClearCurves = useCallback(() => {
    const removed = new Set(shapes.filter(isFormulaShape).map((x) => x.id));
    if (removed.size === 0) return;
    setShapes((prev) => prev.filter((x) => !removed.has(x.id)));
    setSelectedId((cur) => (cur && removed.has(cur) ? null : cur));
    showToast(`已清除 ${removed.size} 条函数曲线`);
  }, [shapes, setShapes, showToast]);

  /** 色板点击：选中图形时直接改它的颜色（同时记住为新图形默认色） */
  const onShapeColor = useCallback((c: string) => {
    updateSettings({ shapeColor: c });
    if (selectedId) {
      setShapes((prev) => prev.map((s) => (s.id === selectedId && "color" in s ? { ...s, color: c } : s)));
    }
  }, [updateSettings, selectedId, setShapes]);

  // ---- 文件导入 ----
  const onImportFile = useCallback(async (file: File) => {
    try {
      const parsed = await readDocumentFile(file);
      setDoc(parsed);
      setViewport({
        width: VIEW_W,
        height: VIEW_H,
        xRange: [...parsed.view.xRange] as [number, number],
        yRange: [...parsed.view.yRange] as [number, number],
      });
      setTab(parsed.shapes.some((s) => s.type === "solid") ? "3d" : "2d");
      const coordShape = parsed.shapes.find((s) => s.type === "coord");
      if (coordShape && coordShape.type === "coord") updateSettings({ gridStep: coordShape.grid });
      showToast("导入成功");
    } catch (e) {
      showToast(`导入失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  }, [updateSettings, showToast]);

  // ---- 导出 PNG ----
  const onExportPng = async () => {
    try {
      const { dataUrl, name } = await renderExportDataUrl(tab, captureRef.current, svgRef.current);
      downloadBlob(dataUrlToBlob(dataUrl), name);
      showToast("PNG 已导出；想作为子卡插图，可在 MN 里给当前卡添加子卡后插入该图");
    } catch (e) {
      showToast(`导出失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  };

  // ---- 写入 MN（降级：公式/说明写批注） ----
  const onWriteToMN = async () => {
    if (!targetCard) {
      showToast("请先选择一个笔记卡片");
      return;
    }
    try {
      const res = await addComment(targetCard, buildSketchReport(shapes));
      showToast(res.ok ? "已写入批注" : `写入失败：${res.error ?? ""}`);
    } catch (e) {
      showToast(`写入失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  };

  const updateSolidParam = (key: string, value: number) => {
    setSolid((prev) => (prev ? { ...prev, params: { ...prev.params, [key]: value } } : prev));
  };

  const onPickSolid = useCallback((kind: SolidKind) => {
    const next = createSolid(kind, color);
    setSolid(next);
    setShapes((prev) => [...prev.filter((x) => x.type !== "solid"), next]);
  }, [color, setShapes]);

  // 卡片导航：按当前学习集的卡片顺序前后跳，并定位到该卡
  const gotoCard = useCallback(async (step: number) => {
    if (cards.length === 0) {
      showToast("当前学习集里没有卡片");
      return;
    }
    const current = cards.findIndex((c) => c.noteid === targetCard);
    const index = current < 0 ? (step > 0 ? 0 : cards.length - 1) : (current + step + cards.length) % cards.length;
    const card = cards[index];
    if (!card) return;
    setTargetCard(card.noteid);
    try {
      const res = await focusCard(card.noteid, topic ?? undefined);
      showToast(res.ok ? `${index + 1}/${cards.length} · ${card.title}` : `跳转失败：${res.error ?? ""}`);
    } catch (e) {
      showToast(`跳转失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  }, [cards, targetCard, topic, showToast]);

  const resolvedTheme = resolveTheme(settings.theme, systemDark, mnTheme);

  const docToExport = useMemo(
    () => toExportDoc(doc, viewport, settings.gridStep),
    [doc, viewport, settings.gridStep],
  );

  return (
    <main className={`panel theme-${resolvedTheme}`} ref={autoFitRef}>
      <PanelHeader
        view={view}
        onViewChange={setView}
        onCollapse={onCollapse}
        onExpand={onExpand}
        onClose={close}
        onPrev={() => { void gotoCard(-1); }}
        onNext={() => { void gotoCard(1); }}
        hasCards={cards.length > 0}
      />

      {toast ? <div className="toast" role="status">{toast}</div> : null}

      {view === "settings" ? (
        <div className="scroll">
          <SettingsPage
            onToast={showToast}
            settings={settings}
            onChange={updateSettings}
            onResetSettings={resetSettings}
            onResetWindow={() => { resetSize(); showToast("窗口尺寸已重置"); }}
            onFitNow={() => { fitPanelHeight(); showToast("已按内容调整高度"); }}
            data={{
              topic,
              cards,
              targetCard,
              onTargetCard: setTargetCard,
              canWriteImage,
              onImport: () => fileInputRef.current?.click(),
              onExport: () => downloadDocument(docToExport),
              onExportPng,
              onWrite: onWriteToMN,
            }}
          />
        </div>
      ) : (
        <div className="stage">
          {tab !== "3d" ? (
            <Canvas2D
              shapes={shapes}
              setShapes={setShapes}
              viewport={viewport}
              setViewport={setViewport}
              tool={tool}
              color={color}
              lockRadius={lockRadius}
              lockedRadius={lockedRadius}
              onLockedRadiusChange={setLockedRadius}
              svgRef={svgRef}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onToast={showToast}
              dashStyle={settings.dashStyle}
              selectionIds={lasso.selectionIds}
              onSelectionChange={lasso.setSelectionIds}
              placeType={placeType}
              placeSides={placeSides}
              penWidth={penWidth}
              options={canvasOptions}
            />
          ) : (
            <SolidStage
              dark={resolvedTheme === "dark"}
              onExportPng={() => { void onExportPng(); }}
              solid={solid}
              onPick={onPickSolid}
              onParam={updateSolidParam}
              onReady={(fn) => { captureRef.current = fn; }}
            />
          )}

          {/* 悬浮：2D / 3D 切换 */}
          <div className="stage-top">
            <div className="seg" role="group" aria-label="绘制模式">
              <button className={tab === "2d" ? "on" : ""} onClick={() => setTab("2d")}>2D</button>
              <button className={tab === "fn" ? "on" : ""} onClick={() => setTab("fn")}>函数</button>
              <button className={tab === "3d" ? "on" : ""} onClick={() => setTab("3d")}>3D</button>
            </div>
            {tab !== "3d" ? (
              <HistoryButtons canUndo={canUndo} canRedo={canRedo} onUndo={undo} onRedo={redo} />
            ) : null}
            {tab !== "3d" ? (
              <button
                type="button"
                className="write-btn"
                onClick={() => { void onWriteToMN(); }}
                aria-label="写入卡片"
                title="把画布构图说明写入当前选定卡片的批注"
              >写入</button>
            ) : null}
            {cards.length > 0 ? (
              <span className="stage-topic">
                {Math.max(1, cards.findIndex((c) => c.noteid === targetCard) + 1)}/{cards.length}
                {cards.find((c) => c.noteid === targetCard)?.title ? ` · ${cards.find((c) => c.noteid === targetCard)?.title}` : ""}
              </span>
            ) : topic ? <span className="stage-topic">{topic}</span> : null}
          </div>

          {tab === "fn" ? (
            <FunctionPad
              onAdd={onAddFormula}
              onTypingChange={setTyping}
              onClose={() => setTab("2d")}
              message={formulaMsg}
              shapes={shapes}
              onDeleteShape={onDeleteShape}
              onClearCurves={onClearCurves}
            />
          ) : null}

          {tab !== "3d" ? (
            <>
            <ToolRail
              tool={tool}
              placeType={placeType}
              railTools={settings.railTools}
              onTool={setTool}
              onPlaceType={setPlaceType}
              onImportImage={() => { void onImportCardImage(); }}
              lockRadius={lockRadius}
              onToggleLock={onToggleLock}
              optionsOpen={optionsOpen}
              onToggleOptions={() => setOptionsOpen((v) => !v)}
            />

            <LassoBar
              count={lasso.selectionIds.length}
              clipCount={lasso.clipboard.length}
              onCopy={lasso.copy}
              onCut={lasso.cut}
              onPaste={lasso.paste}
              onDelete={() => { lasso.erasePicked(); setSelectedId(null); }}
              onClear={lasso.clear}
            />
            </>
          ) : null}

          {tab === "2d" ? (
            <p className="stage-hint">双指拖动平移 · 捏合缩放</p>
          ) : null}

          {tab === "2d" && optionsOpen ? (
            <OptionsDrawer
              onClose={() => setOptionsOpen(false)}
              canvasBg={settings.canvasBg}
              onCanvasBg={(canvasBg) => updateSettings({ canvasBg })}
              placeType={placeType}
              onPlaceType={(t) => { setPlaceType(t); setTool("place"); }}
              placeSides={placeSides}
              onPlaceSides={(n) => updateSettings({ polygonSides: n })}
              penWidth={penWidth}
              onPenWidth={(n) => updateSettings({ penWidth: n })}
              color={color}
              onColor={onShapeColor}
              shapes={shapes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDeleteShape={onDeleteShape}
              onToggleDashed={onToggleDashed}
              onToggleImageLock={onToggleImageLock}
              dashStyle={settings.dashStyle}
              onDashStyle={(dashStyle) => updateSettings({ dashStyle })}
              onExportPng={() => { void onExportPng(); }}
              onImportImageFile={() => imageInputRef.current?.click()}
              lockRadius={lockRadius}
              lockedRadius={lockedRadius}
            />
          ) : null}
        </div>
      )}

      <HiddenFileInputs
        jsonInputRef={fileInputRef}
        imageInputRef={imageInputRef}
        onJsonFile={onImportFile}
        onImageFile={(f) => { void onImportImage(f); }}
      />

      {/* 右下角拖动缩放窗口；开启「跟随内容」时高度交给 mn.fit() */}
      {settings.autoFitHeight ? null : (
        <button
          type="button"
          className="resize-handle"
          aria-label="右下角拖动缩放窗口"
          title="拖动缩放；点击恢复默认尺寸"
          onPointerDown={onResizePointerDown}
        >
          <svg viewBox="0 0 44 44" aria-hidden="true">
            <path d="M12 35C27 35 35 27 35 12" />
          </svg>
        </button>
      )}

    </main>
  );
}
