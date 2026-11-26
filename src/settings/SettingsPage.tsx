/**
 * 设置页：版式参考 CardLink 插件（分组卡片 + 图标行 + 胶囊式子导航）。
 * 所有开关都接到真实行为上，不做装饰性条目。
 */
import { useState } from "react";

import { checkUpdate, type UpdateAsset } from "../update";
import { getLastRawContext } from "../topic";
import { CHANGELOG_URL, GITHUB_URL } from "../repo";
import { APP_VERSION } from "../version";
import { MINI_ACTIONS, MINI_REQUIRED_ACTIONS } from "../PanelHeader";
import { CacheSection } from "./CacheSection";
import { DebugSection } from "./DebugSection";
import { RailCustomizer } from "./RailCustomizer";
import {
  AngleIcon, ChevronIcon, EraserIcon, ExportIcon, GridIcon, ImageIcon, ImportIcon, InfoIcon, MagnetIcon,
  MinimizeIcon, PaletteIcon, PenIcon, PolygonIcon, ResetIcon, RulerIcon, SmoothIcon,
  StrokeWidthIcon, WindowIcon, WriteIcon,
} from "../icons";
import { PALETTE } from "../model/types";
import { Choice, ColorRow, SettingRow, SettingsGroup, SliderRow, Stepper, Toggle } from "./controls";
import type { SketchSettings } from "./model";

type SectionId = "canvas" | "pen" | "shape" | "data" | "window";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "canvas", label: "画布" },
  { id: "pen", label: "画笔" },
  { id: "shape", label: "图元" },
  { id: "data", label: "导出" },
  { id: "window", label: "窗口与关于" },
];

const GRID_STEPS = [
  { value: 1, label: "1" },
  { value: 5, label: "5" },
  { value: 10, label: "10" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
];

/** 数据与导出相关的能力（画布页不再放这些按钮，避免挤占绘图区） */
export interface DataActions {
  topic: string | null;
  cards: { noteid: string; title: string }[];
  targetCard: string;
  onTargetCard: (id: string) => void;
  canWriteImage: boolean;
  onImport: () => void;
  onExport: () => void;
  onExportPng: () => void;
  onWrite: () => void;
}

interface Props {
  onToast: (message: string) => void;
  settings: SketchSettings;
  onChange: (patch: Partial<SketchSettings>) => void;
  onResetSettings: () => void;
  onResetWindow: () => void;
  onFitNow: () => void;
  data: DataActions;
}

export function SettingsPage({
  settings, onChange, onResetSettings, onResetWindow, onFitNow, data, onToast,
}: Props) {
  const [section, setSection] = useState<SectionId>("canvas");
  // 更新检查：idle / checking / 结果
  const [update, setUpdate] = useState<{
    checking: boolean; text: string; bad: boolean; asset?: UpdateAsset | undefined;
  }>({
    checking: false, text: "", bad: false,
  });

  const onCheckUpdate = async () => {
    setUpdate({ checking: true, text: "正在检查…", bad: false });
    const res = await checkUpdate();
    if (!res.ok) {
      setUpdate({ checking: false, text: res.error ?? "检查失败", bad: true });
      return;
    }
    if (res.hasUpdate) {
      setUpdate({ checking: false, text: `发现新版本 v${res.latest}，点下方「下载更新包」`, bad: false, asset: res.asset });
      onToast(`发现新版本 v${res.latest}`);
      return;
    }
    setUpdate({ checking: false, text: `已是最新版本（v${APP_VERSION}）`, bad: false });
  };

  /** 上下文诊断：重读一次 context 再复制原始 JSON，便于排查「目标卡不对」 */
  const onDiagnoseContext = async () => {
    try {
      await mn.api("/context");
    } catch {
      // 忽略：下面照常读已记录的值
    }
    const raw = getLastRawContext();
    const text = JSON.stringify(raw, null, 1);
    try {
      await navigator.clipboard.writeText(text);
      onToast(`已复制上下文（${text.length} 字符）：粘到反馈里即可`);
    } catch {
      onToast("复制失败，请重试");
    }
  };

  const copyLink = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      onToast(`${label}已复制：${url}`);
    } catch {
      onToast(`${label}：${url}`);
    }
  };

  return (
    <div className="settings-page">
      <div className="page-head">
        <h1>设置</h1>
        <p>偏好会自动保存在本机，下次打开继续生效</p>
      </div>

      <nav className="settings-chips" aria-label="设置分类">
        {SECTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={section === item.id ? "on" : ""}
            onClick={() => setSection(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {section === "canvas" ? (
        <>
          <SettingsGroup title="工具栏" accent="violet">
            <RailCustomizer
              railTools={settings.railTools}
              railPresets={settings.railPresets}
              onChange={onChange}
            />
          </SettingsGroup>

          <SettingsGroup title="画布显示" accent="blue">
            <SettingRow
              icon={<PaletteIcon />}
              title="外观"
              subtitle={
                settings.theme === "auto"
                  ? "跟随 MarginNote 的白天/夜间模式"
                  : settings.theme === "dark" ? "始终使用深色" : "始终使用浅色"
              }
              trailing={
                <Choice
                  label="外观"
                  value={settings.theme}
                  options={[
                    { value: "auto", label: "跟随" },
                    { value: "light", label: "浅色" },
                    { value: "dark", label: "深色" },
                  ]}
                  onChange={(theme) => onChange({ theme })}
                />
              }
            />
            <SettingRow
              icon={<GridIcon />}
              title="画布背景"
              subtitle={settings.canvasBg === "coord" ? "带网格与刻度，适合函数与几何" : "纯白纸面，适合随手演算"}
              trailing={
                <Choice
                  label="画布背景"
                  value={settings.canvasBg}
                  options={[
                    { value: "coord", label: "坐标系" },
                    { value: "blank", label: "空白" },
                  ]}
                  onChange={(canvasBg) => onChange({ canvasBg })}
                />
              }
            />
            <SettingRow
              icon={<GridIcon />}
              title="显示网格"
              subtitle="画布背景的参考网格"
              trailing={
                <Toggle
                  checked={settings.showGrid}
                  label="显示网格"
                  onChange={(showGrid) => onChange({ showGrid })}
                />
              }
            />
            <SettingRow
              icon={<RulerIcon />}
              title="显示刻度"
              subtitle="在坐标轴上标注数值"
              trailing={
                <Toggle
                  checked={settings.showTicks}
                  label="显示刻度"
                  onChange={(showTicks) => onChange({ showTicks })}
                />
              }
            />
            <SettingRow
              icon={<GridIcon />}
              title="网格密度"
              subtitle={`每格 ${settings.gridStep} 个单位`}
              trailing={
                <Choice
                  label="网格密度" value={settings.gridStep} options={GRID_STEPS}
                  onChange={(gridStep) => onChange({ gridStep })}
                />
              }
            />
            <SettingRow
              icon={<RulerIcon />}
              title="工具栏位置"
              subtitle="左侧竖排 / 左右上下四向停靠"
              trailing={
                <Choice
                  label="位置" value={settings.railPlacement}
                  options={[
                    { value: "left", label: "左" }, { value: "right", label: "右" },
                    { value: "top", label: "上" }, { value: "bottom", label: "下" },
                  ]}
                  onChange={(railPlacement) => onChange({ railPlacement: railPlacement as typeof settings.railPlacement })}
                />
              }
            />
            <SettingRow
              icon={<MinimizeIcon />}
              title="迷你条方向"
              subtitle="收起后浮条的排布"
              trailing={
                <Choice
                  label="方向" value={settings.miniOrientation}
                  options={[{ value: "h", label: "横向" }, { value: "v", label: "竖向" }]}
                  onChange={(miniOrientation) => onChange({ miniOrientation: miniOrientation as "h" | "v" })}
                />
              }
            />
            <div className="set-row">
              <span className="set-tile"><MinimizeIcon /></span>
              <span className="set-text">
                <b>迷你条按钮</b>
                <small>点选后按此顺序显示</small>
                <span className="chips">
                  {MINI_ACTIONS.map((a) => {
                    const required = MINI_REQUIRED_ACTIONS.includes(a.id);
                    const on = required || settings.miniActions.includes(a.id);
                    return (
                      <button key={a.id} type="button" className={`chip${on ? " on" : ""}`}
                        disabled={required}
                        title={required ? "固定保留：收起后靠它才打得开面板" : undefined}
                        onClick={() => {
                          if (required) return;
                          onChange({
                            miniActions: on
                              ? settings.miniActions.filter((x) => x !== a.id)
                              : [...settings.miniActions, a.id],
                          });
                        }}>{a.label.replace("快速", "")}</button>
                    );
                  })}
                </span>
              </span>
            </div>
          </SettingsGroup>

          <SettingsGroup title="绘制辅助" accent="blue">
            <SettingRow
              icon={<MagnetIcon />}
              title="吸附到点与网格"
              subtitle="自动对齐圆心、端点、已画图形与网格交点"
              trailing={
                <Toggle
                  checked={settings.snapEnabled}
                  label="吸附到点与网格"
                  onChange={(snapEnabled) => onChange({ snapEnabled })}
                />
              }
            />
            <SettingRow
              icon={<PenIcon />}
              title="手指触控作图"
              subtitle="关闭后手指不能画图（防误触），仅 Apple Pencil / 鼠标可作图；双指平移缩放保留"
              trailing={
                <Toggle
                  checked={settings.allowTouchDraw}
                  label="手指触控作图"
                  onChange={(allowTouchDraw) => onChange({ allowTouchDraw })}
                />
              }
            />
            <SettingRow
              icon={<ImageIcon />}
              title="插入卡片图时选择区域"
              subtitle="卡片长图可以只裁出题目区再插入；关掉则直接整张插入"
              trailing={
                <Toggle
                  checked={settings.askCardCrop}
                  label="插入卡片图时选择区域"
                  onChange={(askCardCrop) => onChange({ askCardCrop })}
                />
              }
            />
            <SettingRow
              icon={<MagnetIcon />}
              title="手掌防误触"
              subtitle="忽略大面积接触、笔在位时落下的手指，以及点一下就走的极短笔迹"
              trailing={
                <Toggle
                  checked={settings.palmReject}
                  label="手掌防误触"
                  onChange={(palmReject) => onChange({ palmReject })}
                />
              }
            />
          </SettingsGroup>
        </>
      ) : null}

      {section === "pen" ? (
        <>
          <SettingsGroup title="手写笔迹" accent="violet">
            <SliderRow
              icon={<PenIcon />}
              title="默认笔宽" value={settings.penWidth} min={1} max={12} unit=" px"
              onChange={(penWidth) => onChange({ penWidth })}
            />
            <SettingRow
              icon={<SmoothIcon />}
              title="笔迹平滑"
              subtitle="对采样点做加权平均，线条更顺滑"
              trailing={
                <Toggle
                  checked={settings.inkSmoothing}
                  label="笔迹平滑"
                  onChange={(inkSmoothing) => onChange({ inkSmoothing })}
                />
              }
            />
          </SettingsGroup>

          <SettingsGroup title="橡皮" accent="violet">
            <SliderRow
              icon={<EraserIcon />}
              title="橡皮命中半径" value={settings.eraserRadius} min={8} max={40} unit=" px"
              onChange={(eraserRadius) => onChange({ eraserRadius })}
            />
          </SettingsGroup>
        </>
      ) : null}

      {section === "shape" ? (
        <>
          <SettingsGroup title="图元样式" accent="amber">
            <SliderRow
              icon={<StrokeWidthIcon />}
              title="描边线宽" value={settings.strokeWidth} min={1} max={6} unit=" px"
              onChange={(strokeWidth) => onChange({ strokeWidth })}
            />
            <SettingRow
              icon={<AngleIcon />}
              title="角度吸附特殊角"
              subtitle="关闭时按点击位置取任意角度（默认）"
              trailing={
                <Toggle
                  checked={settings.specialAngleSnap}
                  label="角度吸附特殊角"
                  onChange={(specialAngleSnap) => onChange({ specialAngleSnap })}
                />
              }
            />
            <SettingRow
              icon={<PolygonIcon />}
              title="多边形默认边数"
              subtitle="切换到多边形工具时使用"
              trailing={
                <Stepper
                  label="多边形边数" value={settings.polygonSides} min={3} max={12}
                  onChange={(polygonSides) => onChange({ polygonSides })}
                />
              }
            />
          </SettingsGroup>

          <SettingsGroup title="默认颜色" accent="amber">
            <ColorRow
              icon={<PaletteIcon />}
              title="图元与画笔" value={settings.shapeColor} colors={PALETTE}
              onChange={(shapeColor) => onChange({ shapeColor })}
            />
          </SettingsGroup>
        </>
      ) : null}

      {section === "data" ? (
        <>
          <SettingsGroup title="模型文件" accent="blue">
            <SettingRow
              icon={<ImportIcon />}
              title="导入模型 JSON"
              subtitle="从「文件」App 选择之前导出的 .json"
              onClick={data.onImport}
            />
            <SettingRow
              icon={<ExportIcon />}
              title="导出模型 JSON"
              subtitle="图形、笔迹与视图范围，可再次导入"
              onClick={data.onExport}
            />
          </SettingsGroup>

          <SettingsGroup title="写入卡片" accent="teal">
            <SettingRow
              icon={<WriteIcon />}
              title="写入到卡片"
              subtitle={
                data.cards.length === 0
                  ? "当前学习集里没有可用卡片"
                  : data.canWriteImage
                    ? "已检测到图片写入能力"
                    : "以「批注 + 手动插入 PNG」方式落地"
              }
              trailing={
                <select
                  className="set-select"
                  value={data.targetCard}
                  aria-label="目标卡片"
                  onChange={(e) => data.onTargetCard(e.target.value)}
                >
                  {data.cards.length === 0 ? <option value="">（无可用卡片）</option> : null}
                  {data.cards.map((c) => (
                    <option key={c.noteid} value={c.noteid}>{c.title}</option>
                  ))}
                </select>
              }
            />
            <SettingRow
              icon={<WriteIcon />}
              title="写入构图说明"
              subtitle="把画布图形清单写进目标卡片批注；图片用「导出 PNG」手动插入（MN 未开放图片直写接口）"
              onClick={data.onWrite}
            />
          </SettingsGroup>
        </>
      ) : null}

      {section === "window" ? (
        <>
          <SettingsGroup title="窗口" accent="teal">
            <SettingRow
              icon={<WindowIcon />}
              title="跟随内容自动调整高度"
              subtitle="调用 mn.fit()，面板高度跟随内容自动伸缩"
              trailing={
                <Toggle
                  checked={settings.autoFitHeight}
                  label="跟随内容自动调整高度"
                  onChange={(autoFitHeight) => onChange({ autoFitHeight })}
                />
              }
            />
            <SettingRow icon={<MinimizeIcon />} title="默认以迷你条打开"
              subtitle="每次唤起插件先收成迷你浮条，点「展开」才进入完整画布"
              trailing={<Toggle checked={settings.openAsMini} label="默认以迷你条打开"
                onChange={(openAsMini) => onChange({ openAsMini })} />} />
            <SettingRow
              icon={<WindowIcon />}
              title="立即适应内容高度"
              subtitle="手动触发一次高度重算"
              onClick={onFitNow}
            />
            <SettingRow
              icon={<WindowIcon />}
              title="记住窗口尺寸"
              subtitle="下次打开恢复上次拖拽的大小"
              trailing={
                <Toggle
                  checked={settings.rememberWindowSize}
                  label="记住窗口尺寸"
                  onChange={(rememberWindowSize) => onChange({ rememberWindowSize })}
                />
              }
            />
            <SettingRow
              icon={<ResetIcon />}
              title="重置窗口大小"
              subtitle="恢复默认 420 × 620"
              onClick={onResetWindow}
            />
          </SettingsGroup>

          <SettingsGroup title="关于" accent="teal">
            <SettingRow
              icon={<InfoIcon />}
              title="Euclid Sketch"
              subtitle={`数学模型构图 · v${APP_VERSION} · MarginNote 场景插件`}
            />
            <SettingRow
              icon={<ExportIcon />}
              title="GitHub 仓库"
              subtitle={GITHUB_URL}
              onClick={() => { void copyLink(GITHUB_URL, "仓库地址"); }}
            />
            <SettingRow
              icon={<InfoIcon />}
              title="上下文诊断"
              subtitle="复制 /context 与 /ui-state 的原始返回，排查「目标卡不对」"
              onClick={() => { void onDiagnoseContext(); }}
              trailing={<ChevronIcon />}
            />
            <SettingRow
              icon={<ImageIcon />}
              title="检查更新"
              subtitle={`当前 v${APP_VERSION}`}
              onClick={() => { if (!update.checking) void onCheckUpdate(); }}
              trailing={update.checking ? <span className="set-badge">检查中…</span> : <ChevronIcon />}
            />
            {update.text ? (
              <p className={`update-status${update.bad ? " bad" : " ok"}`}>{update.text}</p>
            ) : null}
            {update.asset ? (
              <a
                className="set-row tappable"
                href={update.asset.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="set-tile"><ExportIcon /></span>
                <span className="set-text">
                  <b>下载更新包</b>
                  <small>{update.asset.name} · 模板包内含插件，导入后插件一起升级</small>
                </span>
                <span className="set-trail"><span className="set-chevron"><ChevronIcon /></span></span>
              </a>
            ) : null}            <CacheSection />
            <DebugSection
              version={APP_VERSION}
              debug={settings.debug}
              onChangeDebug={(debug) => onChange({ debug })}
            />
            <SettingRow
              icon={<InfoIcon />}
              title="更新日志"
              subtitle="CHANGELOG.md"
              onClick={() => { void copyLink(CHANGELOG_URL, "更新日志地址"); }}
            />
            <SettingRow
              icon={<ResetIcon />}
              title="恢复默认设置"
              subtitle="所有设置项回到初始值"
              danger
              onClick={onResetSettings}
            />
          </SettingsGroup>
        </>
      ) : null}
    </div>
  );
}
