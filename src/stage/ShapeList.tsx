/**
 * 图形清单：选中 / 隐藏 / 锁图 / 虚线 / 删除。
 * 从「绘图选项」里搬出来单独成一个浮层——它跟顶栏的历史记录不是一回事，
 * 也不该占着绘图参数的位置。
 */
/* eslint-disable no-restricted-syntax -- 色点按图形颜色动态内联背景，其余为声明式渲染 */
import { DASHABLE, type Shape } from "../model/types";
import { describeShape } from "../model/describe";

interface Props {
  shapes: Shape[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDeleteShape: (id: string) => void;
  onToggleDashed: (id: string) => void;
  onToggleImageLock: (id: string) => void;
  /** 隐藏 / 显示这个图形（不删，只是不渲染、不参与命中与导出） */
  onToggleHidden: (id: string) => void;
}

/** 眼睛图标：睁开＝显示，闭眼带斜杠＝已隐藏 */
function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.2 12S5.5 5.6 12 5.6 21.8 12 21.8 12 18.5 18.4 12 18.4 2.2 12 2.2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="M3.5 20.5 20.5 3.5" /> : null}
    </svg>
  );
}

export function ShapeList({ shapes, selectedId, onSelect, onDeleteShape, onToggleDashed, onToggleImageLock, onToggleHidden }: Props) {
  if (shapes.length === 0) {
    return <p className="drawer-hint">还没有图形。用画笔随手画，或用公式添加一条曲线。</p>;
  }
  return (
    <div className="shape-list">
      {shapes.map((s) => {
        const hidden = "hidden" in s && s.hidden;
        return (
          <div key={s.id} className={`shape-item${selectedId === s.id ? " sel" : ""}${hidden ? " off" : ""}`}>
            <button
              type="button"
              className="shape-pick"
              onClick={() => onSelect(s.id)}
              aria-label={`选中 ${describeShape(s)}`}
            >
              <span className="dot" style={{ background: "color" in s ? s.color : "#8a8377" }} />
              <span className="shape-label">{describeShape(s)}</span>
            </button>
            {/* 坐标系是画布的基准，不给隐藏 / 删除入口（与画布上的橡皮规则一致） */}
            {s.type === "coord" ? null : (
              <>
                <button
                  type="button"
                  className={`lock-btn${hidden ? " on" : ""}`}
                  onClick={() => onToggleHidden(s.id)}
                  aria-label={hidden ? "显示该图形" : "隐藏该图形"}
                  title={hidden ? "已隐藏：点击重新显示" : "隐藏：不显示、不可选、不导出"}
                >
                  <EyeIcon off={!!hidden} />
                </button>
                {s.type === "image" ? (
                  <button
                    type="button"
                    className={`lock-btn${"locked" in s && s.locked ? " on" : ""}`}
                    onClick={() => onToggleImageLock(s.id)}
                    aria-label={"locked" in s && s.locked ? "解锁图片" : "锁定图片"}
                    title={"locked" in s && s.locked ? "已锁定：橡皮擦不掉，点击解锁" : "未锁定：点击锁定防误擦"}
                  >
                    {/* 锁形用 SVG 画（emoji 在 WKWebView 里基线偏移会歪） */}
                    <svg width={13} height={13} viewBox="0 0 18 18" aria-hidden="true">
                      <path
                        d={"locked" in s && s.locked ? "M6 8.2 V6.6 a3 3 0 0 1 6 0 V8.2" : "M6 8.2 V6.6 a3 3 0 0 1 6 0"}
                        fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
                      />
                      <rect x={3.8} y={8.2} width={10.4} height={7.2} rx={2} fill="currentColor" />
                    </svg>
                  </button>
                ) : null}
                {DASHABLE.has(s.type) ? (
                  <button
                    type="button"
                    className={`dash-btn${"dashed" in s && s.dashed ? " on" : ""}`}
                    onClick={() => onToggleDashed(s.id)}
                    aria-label="切换虚线"
                    title="切换虚线 / 实线"
                  >┄</button>
                ) : null}
                <button type="button" className="del-btn" onClick={() => onDeleteShape(s.id)} aria-label="删除">✕</button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
