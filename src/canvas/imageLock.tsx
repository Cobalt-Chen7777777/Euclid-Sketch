/* eslint-disable no-restricted-syntax -- 锁定徽标按图片位置动态内联渲染 */
/**
 * 图片锁定徽标：画布上每张图片左上角的小锁按钮。
 * - 锁定（蓝色）：橡皮擦不掉该图片，仍可拖动缩放；
 * - 解锁（半透明）：恢复可被橡皮擦除。
 * 渲染与点击热区判定都集中在这里，Canvas2D 只做调用。
 */
import { toScreen, type Viewport } from "./viewport";
import type { ImageShape, Point2, Shape } from "../model/types";

/** 点击热区判定：返回命中的图片（屏幕坐标下徽标 18px + 3px 余量） */
export function hitImageLockBtn(shapes: Shape[], v: Viewport, sp: Point2): ImageShape | null {
  for (const s of shapes) {
    if (s.type !== "image") continue;
    const p = toScreen({ x: s.x, y: s.y + s.h }, v);
    if (sp.x >= p.x - 3 && sp.x <= p.x + 21 && sp.y >= p.y - 3 && sp.y <= p.y + 21) return s;
  }
  return null;
}

/** 徽标渲染：图片左上角，锁定=蓝色锁，解锁=半透明开锁 */
export function ImageLockBadges({ shapes, v }: { shapes: Shape[]; v: Viewport }) {
  return (
    <>
      {shapes.filter((s) => s.type === "image").map((s) => {
        const img = s as ImageShape;
        const p = toScreen({ x: img.x, y: img.y + img.h }, v);
        const locked = img.locked === true;
        return (
          <g key={`lock-${img.id}`} className="img-lock" transform={`translate(${p.x + 2}, ${p.y + 2})`} style={{ cursor: "pointer" }}>
            <rect width={18} height={18} rx={5}
              fill={locked ? "rgba(37, 99, 235, .88)" : "rgba(120, 114, 105, .4)"} />
            <text x={9} y={13.5} fontSize={10.5} textAnchor="middle" fill="#fff">{locked ? "🔒" : "🔓"}</text>
          </g>
        );
      })}
    </>
  );
}
