/**
 * 设置界面的基础控件。
 *
 * 版式参考 CardLink 插件的设置页：
 *   分组卡片（标题 + 若干行），每行 = 左侧圆角图标块 + 标题/副标题 + 右侧控件，
 *   行与行之间用内缩的细分割线，开关为 iOS 风格胶囊。
 */
/* eslint-disable no-restricted-syntax -- 色板需按用户选中的颜色动态内联背景，其余为声明式渲染 */
import type { ReactNode } from "react";

import { ChevronIcon } from "../icons";

/** 分组主题色：每组一个色系，图标块用同色浅底 */
export type Accent = "blue" | "violet" | "amber" | "teal";

interface GroupProps {
  title: string;
  accent: Accent;
  children: ReactNode;
}

export function SettingsGroup({ title, accent, children }: GroupProps) {
  return (
    <section className={`set-group accent-${accent}`}>
      <h2>{title}</h2>
      <div className="set-rows">{children}</div>
    </section>
  );
}

interface RowProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  /** 有 onClick 时整行可点，行尾自动显示箭头 */
  onClick?: () => void;
  /** 危险操作（如恢复默认）用红字 */
  danger?: boolean;
}

export function SettingRow({ icon, title, subtitle, trailing, onClick, danger = false }: RowProps) {
  const body = (
    <>
      <span className="set-tile">{icon}</span>
      <span className="set-text">
        <b className={danger ? "danger" : undefined}>{title}</b>
        {subtitle ? <small>{subtitle}</small> : null}
      </span>
      <span className="set-trail">
        {trailing ?? (onClick ? <span className="set-chevron"><ChevronIcon /></span> : null)}
      </span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="set-row tappable" onClick={onClick}>
        {body}
      </button>
    );
  }
  return <div className="set-row">{body}</div>;
}

interface ToggleProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch${checked ? " on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="knob" />
    </button>
  );
}

interface StepperProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  label: string;
  onChange: (next: number) => void;
}

export function Stepper({ value, min, max, step = 1, unit = "", label, onChange }: StepperProps) {
  return (
    <span className="stepper">
      <button
        type="button" aria-label={`${label}减少`} disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >−</button>
      <output>{value}{unit}</output>
      <button
        type="button" aria-label={`${label}增加`} disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >+</button>
    </span>
  );
}

interface SliderRowProps {
  icon: ReactNode;
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (next: number) => void;
}

/** 滑块独占一行：标题行 + 整行滑块，窄面板里比挤在右侧好用 */
export function SliderRow({ icon, title, value, min, max, step = 1, unit = "", onChange }: SliderRowProps) {
  return (
    <div className="set-row stacked">
      <span className="set-tile">{icon}</span>
      <span className="set-text">
        <b>{title}</b>
        <small>{value}{unit}</small>
      </span>
      <input
        className="set-range"
        type="range"
        min={min} max={max} step={step} value={value}
        aria-label={title}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
}

interface ChoiceProps<T extends string | number> {
  value: T;
  options: ChoiceOption<T>[];
  label: string;
  onChange: (next: T) => void;
}

/** 行尾分段选择：选项少时比下拉更省一次点击 */
export function Choice<T extends string | number>({ value, options, label, onChange }: ChoiceProps<T>) {
  return (
    <span className="choice" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={option.value === value ? "on" : ""}
          onClick={() => onChange(option.value)}
        >{option.label}</button>
      ))}
    </span>
  );
}

interface ColorRowProps {
  icon: ReactNode;
  title: string;
  value: string;
  colors: readonly string[];
  onChange: (next: string) => void;
}

export function ColorRow({ icon, title, value, colors, onChange }: ColorRowProps) {
  return (
    <div className="set-row stacked">
      <span className="set-tile">{icon}</span>
      <span className="set-text">
        <b>{title}</b>
        <small>{value.toUpperCase()}</small>
      </span>
      <div className="set-swatches">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            className={`set-swatch${color === value ? " on" : ""}`}
            style={{ background: color }}
            aria-label={`颜色 ${color}`}
            aria-pressed={color === value}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </div>
  );
}
