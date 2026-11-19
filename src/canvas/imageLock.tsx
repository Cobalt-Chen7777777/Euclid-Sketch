/* eslint-disable no-restricted-syntax -- 徽标 left/top 是随图片位置动态计算的百分比，无法写进静态 CSS */
/**
 *
 * 为什么不用 SVG 画：画布 svg 是 preserveAspectRatio="none"——viewBox 被拉伸时
 * SVG 内固定尺寸的图形会跟着变形（锁会歪）。HTML 层用百分比定位 + 固定像素尺寸，
 * 任何窗口比例下都不变形，天然居中。
 *
 * - 锁定（蓝色）：橡皮擦不掉该图片，仍可拖动缩放；
 * - 解锁（半透明）：恢复可被橡皮擦除。
 */
import type { ImageShape, Shape } from "../model/types";
import { toScreen, type Viewport } from "./viewport";

/** 徽标渲染：图片左上角。onToggle 由 Canvas2D 传入（直接切 locked） */
export function ImageLockBadges({
  shapes, v, onToggle,
}: { shapes: Shape[]; v: Viewport; onToggle: (id: string) => void }) {
  return (
    <>
      {shapes.filter((s) => s.type === "image").map((s) => {
        const img = s as ImageShape;
        const p = toScreen({ x: img.x, y: img.y + img.h }, v);
        const locked = img.locked === true;
        return (
          <button
            key={`lock-${img.id}`}
            type="button"
            className={`img-lock-btn${locked ? " locked" : ""}`}
            style={{
              left: `${(p.x / v.width) * 100}%`,
              top: `${(p.y / v.height) * 100}%`,
            }}
            onClick={(e) => { e.stopPropagation(); onToggle(img.id); }}
            onPointerDown={(e) => { e.stopPropagation(); }}
            aria-label={locked ? "解锁图片" : "锁定图片"}
            title={locked ? "已锁定：橡皮擦不掉，点击解锁" : "未锁定：点击锁定防误擦"}
          >
            <svg width={18} height={18} viewBox="0 0 18 18" aria-hidden="true">
              <rect width={18} height={18} rx={5}
                fill={locked ? "rgba(37, 99, 235, .88)" : "rgba(120, 114, 105, .45)"} />
              {/* 锁梁：锁定=完整拱形；解锁=右端抬起 */}
              <path
                d={locked ? "M6 8.2 V6.6 a3 3 0 0 1 6 0 V8.2" : "M6 8.2 V6.6 a3 3 0 0 1 6 0"}
                fill="none" stroke="#fff" strokeWidth={1.7} strokeLinecap="round"
              />
              {/* 锁体 */}
              <rect x={4.8} y={8.2} width={8.4} height={6} rx={1.5} fill="#fff" />
              {locked ? <circle cx={9} cy={11.2} r={1.15} fill="rgba(37, 99, 235, .9)" /> : null}
            </svg>
          </button>
        );
      })}
    </>
  );
}
