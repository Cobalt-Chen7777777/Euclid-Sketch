/**
 * 设置页：版式参考 CardLink 插件（分组卡片 + 图标行 + 胶囊式子导航）。
 * 所有开关都接到真实行为上，不做装饰性条目。
 */
import { useState } from "react";

import { checkUpdate } from "../update";
import { CHANGELOG_URL, GITHUB_URL } from "../repo";
import { APP_VERSION } from "../version";
import { RailCustomizer } from "./RailCustomizer";
import {
  AngleIcon, ChevronIcon, EraserIcon, ExportIcon, GridIcon, ImageIcon, ImportIcon, InfoIcon, MagnetIcon,
  PaletteIcon, PenIcon, PolygonIcon, ResetIcon, RulerIcon, SmoothIcon,
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
  { value: 0.5, label: "0.5" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
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
  const [update, setUpdate] = useState<{ checking: boolean; text: string; bad: boolean }>({
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
      setUpdate({ checking: false, text: `发现新版本 v${res.latest}，可在 GitHub Releases 下载`, bad: false });
      onToast(`发现新版本 v${res.latest}`);
      return;
    }
    setUpdate({ checking: false, text: `已是最新版本（v${APP_VERSION}）`, bad: false });
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
          </SettingsGroup>

          <SettingsGroup title="绘制辅助" accent="blue">
            <SettingRow
              icon={<MagnetIcon />}
              title="吸附到已有点"
              subtitle="自动对齐圆心、端点与已画图形"
              trailing={
                <Toggle
                  checked={settings.snapEnabled}
                  label="吸附到已有点"
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
              icon={<ImageIcon />}
              title="检查更新"
              subtitle={update.text || `当前 v${APP_VERSION}，点一下比对 GitHub 上的最新版本`}
              onClick={() => { if (!update.checking) void onCheckUpdate(); }}
              trailing={<ChevronIcon />}
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
