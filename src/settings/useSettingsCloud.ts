/**
 * 设置的自动备份与恢复。
 *
 * 面板的 localStorage 在覆盖安装时可能被宿主清掉，所以每次改设置都把一份写进
 * 当前目标卡的插件字段；重装后首次启动若本地没有设置，就从焦点卡读回来。
 * 用户不需要手动导出/导入。
 */
import { useEffect, useRef } from "react";

import { loadSettingsFromCard, saveSettingsToCard } from "./cardBackup";
import { hasStoredSettings, normalizeSettings, type SketchSettings } from "./model";

interface Options {
  settings: SketchSettings;
  /** 当前目标卡（没有目标卡时不做备份） */
  targetCard: string;
  onRestore: (settings: SketchSettings) => void;
  onRestored?: () => void;
}

export function useSettingsCloud({ settings, targetCard, onRestore, onRestored }: Options): void {
  // 首次渲染不备份，避免刚打开就把默认值覆盖到卡片上
  const dirty = useRef(false);
  useEffect(() => {
    if (!dirty.current) { dirty.current = true; return; }
    if (!targetCard) return;
    const t = setTimeout(() => { void saveSettingsToCard(targetCard, JSON.stringify(settings)); }, 1500);
    return () => clearTimeout(t);
  }, [settings, targetCard]);

  // 本地没有设置（刚重装）时，尝试从当前焦点卡读回上一次的设置
  useEffect(() => {
    if (hasStoredSettings()) return;
    void (async () => {
      try {
        const st = await mn.api<{ state?: { focusnoteid?: string } }>("/ui-state");
        const nid = st?.state?.focusnoteid;
        if (!nid) return;
        const raw = await loadSettingsFromCard(nid);
        if (!raw) return;
        onRestore(normalizeSettings(JSON.parse(raw)));
        onRestored?.();
      } catch {
        // 读不到就用默认设置照常工作
      }
    })();
  }, [onRestore, onRestored]);
}
