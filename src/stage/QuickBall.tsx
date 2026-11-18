/**
 * 快捷浮球：面板左下的悬浮入口，点开就是一列主要功能的按钮。
 *
 * 说明：真正挂在 MN 界面上、能飘在画布外的「浮球」只有 native 层能创建
 * （main.js 里的 panel.showFloatingIn），纯面板插件拿不到。
 * 所以这里做的是面板内的悬浮入口：随手点开就能切到主要功能，
 * 收起面板时则退化成标题栏左侧的迷你条入口。
 */
import type { ReactNode } from "react";

import { BoltIcon, CloseIcon } from "../icons";

export interface QuickAction {
  id: string;
  label: string;
  icon: ReactNode;
  run: () => void;
}

interface Props {
  open: boolean;
  onToggle: () => void;
  actions: QuickAction[];
  /** 额外类名，用于按场景调整位置（如函数面板打开时上移） */
  className?: string;
}

export function QuickBall({ open, onToggle, actions, className = "" }: Props) {
  return (
    <div className={`quickball${open ? " open" : ""}${className ? ` ${className}` : ""}`}>
      {open ? (
        <div className="quickball-menu" role="menu" aria-label="快捷功能">
          {actions.map((action) => (
            <button
              key={action.id}
              type="button"
              role="menuitem"
              className="quickball-item"
              onClick={action.run}
            >
              <span className="qb-ico">{action.icon}</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        className="quickball-btn"
        aria-expanded={open}
        aria-label={open ? "收起快捷功能" : "快捷功能"}
        title={open ? "收起快捷功能" : "快捷功能（画笔 / 角度 / 图形 / 公式）"}
        onClick={onToggle}
      >
        {open ? <CloseIcon size={20} /> : <BoltIcon size={20} />}
      </button>
    </div>
  );
}
