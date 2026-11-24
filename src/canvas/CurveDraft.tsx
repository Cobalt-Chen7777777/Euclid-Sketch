/**
 * 曲线草稿预览（钢笔式）：
 * 已经确定的锚点连成折线，当前点拖出的切线画成手柄（虚线 + 圆点），
 * 让「拖多长、往哪个方向」能实时看见，松手后切线固化进曲线。
 */
import type { Point2 } from "../model/types";
import { toScreen, type Viewport } from "./viewport";

interface Props {
  points: Point2[];
  tangents: (Point2 | undefined)[];
  viewport: Viewport;
  color: string;
}

export function CurveDraft({ points, tangents, viewport: v, color }: Props) {
  if (points.length === 0) return null;
  const sp = points.map((p) => toScreen(p, v));
  const d = sp.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <g pointerEvents="none">
      {/* 锚点连线 */}
      {sp.length > 1 ? (
        <path d={d} fill="none" stroke={color} strokeWidth={1.4} strokeDasharray="4 4" opacity={0.75} />
      ) : null}
      {/* 锚点 */}
      {sp.map((p, i) => (
        <circle key={`a-${i}`} cx={p.x} cy={p.y} r={i === sp.length - 1 ? 4.5 : 3.5}
          fill={i === sp.length - 1 ? color : "#fff"} stroke={color} strokeWidth={1.8} />
      ))}
      {/* 当前点的切线手柄 */}
      {points.map((pt, i) => {
        const tg = tangents[i];
        if (!tg) return null;
        const anchor = sp[i];
        if (!anchor) return null;
        const tip = toScreen({ x: pt.x + tg.x, y: pt.y + tg.y }, v);
        return (
          <g key={`t-${i}`}>
            <line x1={anchor.x} y1={anchor.y} x2={tip.x} y2={tip.y}
              stroke="#2563eb" strokeWidth={1.4} strokeDasharray="3 3" />
            <circle cx={tip.x} cy={tip.y} r={3.6} fill="#fff" stroke="#2563eb" strokeWidth={1.6} />
            {/* 对称的入向手柄：提示「另一侧也会跟着弯」 */}
            <line x1={anchor.x} y1={anchor.y} x2={2 * anchor.x - tip.x} y2={2 * anchor.y - tip.y}
              stroke="#2563eb" strokeWidth={1.2} strokeDasharray="2 4" opacity={0.5} />
          </g>
        );
      })}
    </g>
  );
}
