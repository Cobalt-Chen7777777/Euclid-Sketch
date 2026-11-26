/**
 * 默认以迷你条打开：面板一挂载就收成迷你条，点「展开」才进入完整画布。
 */
import { useEffect, useRef } from "react";

import { estimateMiniSize } from "./useMiniBarFit";
import type { SketchSettings } from "./settings/model";

export function useOpenAsMini(
  settings: SketchSettings,
  collapse: (size: { width: number; height: number }) => void,
  setCollapsed: (value: boolean) => void,
): void {
  const done = useRef(false);
  useEffect(() => {
    if (!settings.openAsMini || done.current) return;
    done.current = true;
    const bar = estimateMiniSize(settings.miniActions.length, settings.miniOrientation === "v");
    setCollapsed(true);
    collapse({ width: bar.w, height: bar.h });
  }, [settings.openAsMini, settings.miniActions.length, settings.miniOrientation, collapse, setCollapsed]);
}
