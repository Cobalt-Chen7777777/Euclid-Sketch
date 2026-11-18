/**
 * 主题解析（纯函数，不碰 DOM）。
 *
 * MN 没有公开主题变更事件，面板也读不到除了 mn.theme 之外的宿主状态，
 * 所以优先用 mn.theme，其次用系统的 prefers-color-scheme，
 * 最后回落到用户的手动选择（自动 / 浅色 / 深色）。
 */
import type { ThemeMode } from "./settings/model";

export type ResolvedTheme = "light" | "dark";

export function resolveTheme(
  mode: ThemeMode,
  systemDark: boolean,
  mnTheme?: string | null,
): ResolvedTheme {
  if (mode === "light" || mode === "dark") return mode;
  // auto：MN 明确给了主题就听它的，否则跟随系统
  if (mnTheme === "dark") return "dark";
  if (mnTheme === "light") return "light";
  return systemDark ? "dark" : "light";
}
