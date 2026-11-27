import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { Canvas2D, type CanvasOptions, type Tool } from "./canvas/Canvas2D";
import type { Viewport } from "./canvas/viewport";
import { upsertComment } from "./bridge";
import { downloadDocument, downloadBlob, dataUrlToBlob, renderExportDataUrl } from "./export/image";
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
import { useMnContext } from "./useMnContext";
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
import { useAppQuickCreate } from "./useQuickCreate";
import { OptionsDrawer } from "./stage/OptionsDrawer";
import { SolidStage } from "./stage/SolidStage";
import { FunctionPad } from "./stage/FunctionPad";
import { resolveTheme } from "./theme";
import { useLassoClipboard } from "./useLassoClipboard";
import { useHistoryShapes, useUndoHotkeys } from "./useHistoryShapes";
import { StageTopBar } from "./stage/StageTopBar";
import { ImagePreviewLayer } from "./stage/ImagePreviewLayer";
import { useCopySketch } from "./useCopySketch";
import { useLayers } from "./useLayers";
import { HiddenFileInputs } from "./HiddenFileInputs";
import { readDocumentFile, toExportDoc } from "./io/documents";
import { useDocAutosave, loadDoc } from "./useDocAutosave";
import { estimateMiniSize, useMiniBarFit } from "./useMiniBarFit";
import { HistoryDialog } from "./stage/HistoryDialog";
import { CropDialog } from "./stage/CropDialog";
import { PasteImageSheet } from "./stage/PasteImageSheet";
import { useCardCropInsert } from "./useCardCropInsert";
import { useClipboardImage } from "./useClipboardImage";
import { useOpenAsMini } from "./useOpenAsMini";
import { useSettingsCloud } from "./settings/useSettingsCloud";
import { logHostEnv } from "./debug/env";
import { useImageActions } from "./useImageActions";
import { toggleImageLock } from "./canvas/imageOps";
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
  const [doc, setDoc] = useState<SketchDocument>(() => loadDoc() ?? structuredClone(DEFAULT_DOCUMENT));
  useDocAutosave(doc); const shapes = doc.shapes;
  const rawSetShapes = useCallback((updater: React.SetStateAction<Shape[]>) => {
    setDoc((prev) => ({ ...prev, shapes: typeof updater === "function" ? updater(prev.shapes) : updater }));
  }, []);

  // 撤销/重做：包装 setShapes，所有改图形的操作自动进历史栈
  const { commit: setShapes, undo, redo, canUndo, canRedo, historySteps, historyList, jumpBack, clearHistory } = useHistoryShapes(shapes, rawSetShapes);

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
  const [histOpen, setHistOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formulaMsg, setFormulaMsg] = useState("");
  // 正在输入法里打字：暂停自动高度，避免键盘弹起/收起引发反复 mn.fit
  const [typing, setTyping] = useState(false);
  const [toast, setToast] = useState("");
  const [lockRadius, setLockRadius] = useState(false);
  const [lockedRadius, setLockedRadius] = useState<number | null>(null);
  const [placeType, setPlaceType] = useState<PrimitiveType>("rect");
  const [solid, setSolid] = useState<SolidShape | null>(null);
  const captureRef = useRef<(() => string) | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? "" : cur)), 2200);
  }, []);

  const [currentLayer, setCurrentLayer] = useState(0);
  const layerOps = useLayers(shapes, setShapes, currentLayer, setCurrentLayer);
  const { preview, copy: onCopyPng, closePreview } = useCopySketch(tab, captureRef, svgRef, (ok) =>
    showToast(ok ? "草图图片已复制：去卡片批注长按粘贴即可" : "复制受限：已改为长按保存"));

  // 卡片菜单命令通道的转发 ref：hook 回调只引用 ref，实际行为在后面绑定（避免闭包 TDZ）
  const cardImportRef = useRef<((nid: string) => void) | null>(null);
  const cardWriteRef = useRef<((nid: string) => void) | null>(null);

  // MN 卡片：学习集 + 焦点卡（写入/导入目标） + 能力探测 + 手动同步 + 卡片事件
  const { topic, cards, targetCard, setTargetCard, canWriteImage, refresh: refreshContext, lockTarget } = useMnContext(showToast, {
    onCommand: (id, noteid) => {
      setTargetCard(noteid);
      if (id === "import-image") cardImportRef.current?.(noteid);
      else if (id === "annotate") cardWriteRef.current?.(noteid);
      else showToast("目标卡已切换为点选的卡片");
    },
    onExcerpt: (noteid) => {
      // 做题流程入口：MN 里摘录产生新卡 → 自动设为目标
      setTargetCard(noteid);
      showToast("目标卡已切换为刚摘录的卡片");
    },
  });

  /** 顶栏「同步」：把目标卡对齐到 MN 里当前聚焦/点选的卡 */
  const onSyncTargetCard = useCallback(async () => {
    try {
      const fid = await refreshContext();
      showToast(fid ? "已同步：目标 = MN 当前聚焦卡" : "MN 里没有聚焦的卡片：请先在脑图/文档里点开一张卡再同步");
    } catch (e) {
      showToast(`同步失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  }, [refreshContext, showToast]);

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
    palmReject: settings.palmReject,
  }), [settings]);

  // 面板尺寸记忆与收起/关闭（右下角把手拖动缩放）
  const { resetSize, collapse, expand, close, onResizePointerDown, isResizing, previewSize } = useResizablePanel({
    remember: settings.rememberWindowSize,
  });
  // 收起为迷你条时暂停高度自适应，否则 mn.fit 会把迷你条撑回内容高度；拖动把手缩放时也暂停（避免 mn.fit 拉锯）
  const [collapsed, setCollapsed] = useState(false);
  useMiniBarFit(settings.miniActions.length, settings.miniOrientation === "v", collapsed);
  const autoFitRef = useAutoFitHeight(settings.autoFitHeight && !collapsed && !typing && !isResizing);
  // 快捷键（Ctrl/Cmd+Z / Shift+Z / Ctrl+Y）监听挂在面板根元素上
  useUndoHotkeys(autoFitRef, undo, redo);

  useOpenAsMini(settings, collapse, setCollapsed);

  const onCollapse = useCallback(() => {
    setCollapsed(true);
    // 与迷你条同一套栅格算出尺寸：收起只动一次尺寸，不会「先缩到一个值再跳一下」
    const bar = estimateMiniSize(settings.miniActions.length, settings.miniOrientation === "v");
    collapse({ width: bar.w, height: bar.h });
  }, [collapse, settings.miniActions.length, settings.miniOrientation]);
  const onExpand = useCallback(() => {
    setCollapsed(false);
    expand();
  }, [expand]);

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
  const quickCreate = useAppQuickCreate({ viewport, color, layer: currentLayer, setShapes, onSelect: setSelectedId, onToast: showToast });

  const lasso = useLassoClipboard(shapes, setShapes, showToast);

  const imageInputRef = useRef<HTMLInputElement>(null);

  // 启动时把宿主环境记一行（拖拽条高度、窗口尺寸），真机排查布局用
  useEffect(() => { logHostEnv(); }, []);

  // 设置自动备份到目标卡 / 重装后自动恢复
  useSettingsCloud({ settings, targetCard, onRestore: updateSettings, onRestored: () => showToast("已从上次的卡片恢复插件设置") });

  // 卡片图插入：渲染 → 选区裁剪 → 进画布（逻辑在 useCardCropInsert）
  const { cropSrc, setCropSrc, onCropConfirm, onImportImage, onImportCardImage } = useCardCropInsert({
    viewport, color, shapes, setShapes, setSelectedId, setViewport, showToast,
    insertScale: settings.imageInsertScale,
    targetCard, refreshContext, lockTarget,
    askCardCrop: settings.askCardCrop,
  });

  const { pasteOpen, setPasteOpen, onInsertClipboardImage } = useClipboardImage({
    onFile: (file) => { void onImportImage(file); },
    showToast,
  });

  const onUpdateShape = useCallback((id: string, updater: (s: Shape) => Shape) => {
    setShapes((prev) => prev.map((s) => (s.id === id ? updater(s) : s)));
  }, [setShapes]);

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
    setShapes((prev) => toggleImageLock(prev, id, showToast));
  }, [setShapes, showToast]);
  /** 等比缩放 / 默认大小 / 按真实比例校正（集中 hook） */
  const { onResizeImage, onFitImage, onNormalizeImage } = useImageActions(shapes, setShapes, viewport, showToast);

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

  // ---- 写入 MN（降级：公式/说明写批注；noteidArg 供卡片菜单命令直接指定目标卡） ----
  const onWriteToMN = async (noteidArg?: string) => {
    const fresh = noteidArg ? null : await refreshContext();
    const nid = noteidArg ?? fresh ?? targetCard;
    if (!nid) {
      showToast("请先在 MN 里点选卡片（或在卡片菜单点「设为草图目标卡」）");
      return;
    }
    if (shapes.every((s) => s.type === "coord")) {
      showToast("画布是空的：先画点内容再写入");
      return;
    }
    try {
      // upsert：同一张卡已有草图批注时改写它，不重复堆叠
      const res = await upsertComment(nid, buildSketchReport(shapes));
      showToast(res.ok ? "已写入批注（更新上次的草图纸）" : `写入失败：${res.error ?? ""}`);
    } catch (e) {
      showToast(`写入失败：${e instanceof Error ? e.message : "未知错误"}`);
    }
  };

  // 卡片菜单命令的行为绑定：每次渲染更新 ref 指向最新闭包
  useEffect(() => {
    cardImportRef.current = (nid) => { void onImportCardImage(nid); };
    cardWriteRef.current = (nid) => { void onWriteToMN(nid); };
  });

  const updateSolidParam = (key: string, value: number) => {
    setSolid((prev) => (prev ? { ...prev, params: { ...prev.params, [key]: value } } : prev));
  };

  const onPickSolid = useCallback((kind: SolidKind) => {
    const next = createSolid(kind, color);
    setSolid(next);
    setShapes((prev) => [...prev.filter((x) => x.type !== "solid"), next]);
  }, [color, setShapes]);

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
        orientation={settings.miniOrientation}
        actions={settings.miniActions}
        onQuickShape={(kind) => { onExpand(); quickCreate(kind); setOptionsOpen(true); }}
        onQuickCopy={() => { void onCopyPng(); }}
        onQuickInsert={() => { void onImportCardImage(); }}
        onQuickCalc={() => { onExpand(); setView("canvas"); setTab("fn"); }}
        onQuickHistory={() => { onExpand(); setHistOpen(true); }}
        onQuickSettings={() => { onExpand(); setView("settings"); }}
      />

      <HistoryDialog open={histOpen} list={historyList} currentCount={shapes.length} onJump={jumpBack} onClose={() => setHistOpen(false)} onRestore={setDoc} onClearHistory={clearHistory} />
      <PasteImageSheet
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onImage={(file) => { setPasteOpen(false); void onImportImage(file); }}
      />
      {cropSrc ? (
        <CropDialog src={cropSrc} onCancel={() => setCropSrc(null)} onConfirm={(rect) => { void onCropConfirm(rect); }} />
      ) : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
      <ImagePreviewLayer src={preview?.src ?? null} reason={preview?.reason} onClose={closePreview} onExport={() => { void onExportPng(); }} />
      {/* 窗口拖动缩放中：尺寸预览 HUD（拖动期间不调宿主接口，松手才生效） */}
      {previewSize ? (
        <div className="size-hud" role="status">
          {Math.round(previewSize.width)} × {Math.round(previewSize.height)}
        </div>
      ) : null}

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
              onWrite: () => { void onWriteToMN(); },
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
              tool={tool} onRequestTool={setTool} color={color}
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
              onToggleImageLock={onToggleImageLock}
              frozen={isResizing}
              placeType={placeType}
              placeSides={placeSides}
              penWidth={penWidth}
              options={canvasOptions}
              currentLayer={currentLayer}
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

          {/* 悬浮：模式切换 + 撤销重做 + 写入 + 目标卡（见 StageTopBar） */}
          <StageTopBar
            tab={tab}
            onTabChange={setTab}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
            history={{ list: historyList, count: shapes.length, onOpen: () => setHistOpen(true) }}
            onWrite={() => { void onCopyPng(); }}
            onSyncTarget={() => { void onSyncTargetCard(); }}
            cards={cards}
            targetCard={targetCard}
            topic={topic}
            canvasBg={settings.canvasBg}
            onCanvasBg={(canvasBg) => updateSettings({ canvasBg })}
            onClearShapes={() => {
              // 保留坐标系，清掉其余所有图形（之前条件写反，实际是删坐标系、留图形）
              setShapes((prev) => prev.filter((s2) => s2.type === "coord"));
              showToast("画布已清空");
            }}
          />

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
              placement={settings.railPlacement} railTools={settings.railTools}
              onParamCreate={(id) => {
                setTool("place");
                setPlaceType(id as import("./model/types").PrimitiveType);
                setOptionsOpen(true);
              }}
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
              historySteps={historySteps} onJumpBack={jumpBack}
              color={color}
              onColor={onShapeColor}
              shapes={shapes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDeleteShape={onDeleteShape}
              onToggleDashed={onToggleDashed}
              onUpdateShape={onUpdateShape}
              layers={layerOps}
              currentLayer={currentLayer}
              onSelectLayer={setCurrentLayer}
              selectionIds={lasso.selectionIds.length > 0 ? lasso.selectionIds : selectedId ? [selectedId] : []}
              onToggleImageLock={onToggleImageLock}
              onResizeImage={onResizeImage}
              onFitImage={onFitImage}
              onNormalizeImage={onNormalizeImage}
              dashStyle={settings.dashStyle}
              onDashStyle={(dashStyle) => updateSettings({ dashStyle })}
              onExportPng={() => { void onExportPng(); }}
              onCopyPng={() => { void onCopyPng(); }}
              onImportImageFile={() => imageInputRef.current?.click()}
              onInsertClipboard={() => { void onInsertClipboardImage(); }}
              tool={tool}
              onQuickCreate={(kind) => { quickCreate(kind); setOptionsOpen(true); }}
              imageInsertScale={settings.imageInsertScale}
              onImageInsertScale={(imageInsertScale) => updateSettings({ imageInsertScale })}
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
        onImageFile={(f, i) => { void onImportImage(f, i); }}
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
