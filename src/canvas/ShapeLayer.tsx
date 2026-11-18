/** 纯渲染：把 Shape[] 画成 SVG 元素。不含交互逻辑。 */
import { angleSpanDeg, drawRange } from "../model/angle";
import { sampleFunction, sampleParametric } from "../model/formula";
import { getHandles, polygonPoints } from "../model/geometry";
import type { AngleShape, ArcShape, PolyShape, EllipseShape, InkShape, PolygonShape, RayShape, RectShape, Shape } from "../model/types";
import {
  gridLines,
  radiusToScreen,
  toScreen,
  type Viewport,
} from "./viewport";

interface Props {
  shapes: Shape[];
  viewport: Viewport;
  /** 高亮（选中）的图形 id */
  highlightId?: string | null;
  /** 圆规预览圆（草稿预览用，与 previewShape 二选一） */
  preview?: { cx: number; cy: number; r: number } | null;
  /** 拖动绘制/笔迹的实时预览图形 */
  previewShape?: Shape | null;
  /** 显示网格（设置项） */
  showGrid?: boolean;
  /** 显示刻度数字（设置项） */
  showTicks?: boolean;
  /** 网格密度，覆盖坐标系自带的 grid（设置项） */
  gridStep?: number;
  /** 描边线宽（设置项） */
  strokeWidth?: number;
}

function pathFromPoints(points: { x: number; y: number }[], v: Viewport): string {
  if (points.length === 0) return "";
  let d = "";
  let penDown = false;
  for (const p of points) {
    const s = toScreen(p, v);
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) {
      penDown = false;
      continue;
    }
    d += `${penDown ? "L" : "M"}${s.x.toFixed(1)},${s.y.toFixed(1)} `;
    penDown = true;
  }
  return d.trim();
}

/** 屏幕半径：分别取 x/y 缩放，用于椭圆/圆弧的非等比投影 */
const sx = (v: Viewport) => v.width / (v.xRange[1] - v.xRange[0]);
const sy = (v: Viewport) => v.height / (v.yRange[1] - v.yRange[0]);

function renderShape(shape: Shape, v: Viewport, selected: boolean, baseWidth = 2) {
  const stroke = "color" in shape ? shape.color : "#2563eb";
  const sw = selected ? baseWidth + 1 : baseWidth;
  switch (shape.type) {
    case "coord":
      return null;
    case "circle": {
      const c = toScreen({ x: shape.cx, y: shape.cy }, v);
      const r = radiusToScreen(shape.r, v);
      return <circle cx={c.x} cy={c.y} r={r} fill="none" stroke={stroke} strokeWidth={sw} />;
    }
    case "ellipse": {
      const e = shape as EllipseShape;
      const c = toScreen({ x: e.cx, y: e.cy }, v);
      return (
        <ellipse
          cx={c.x} cy={c.y}
          rx={Math.abs(e.rx * sx(v))} ry={Math.abs(e.ry * sy(v))}
          fill="none" stroke={stroke} strokeWidth={sw}
        />
      );
    }
    case "arc": {
      const a = shape as ArcShape;
      const rx = Math.abs(a.r * sx(v));
      const ry = Math.abs(a.r * sy(v));
      // SVG 弧线端点（用 y 翻转的世界角）
      const p1 = toScreen(
        { x: a.cx + a.r * Math.cos(a.startAngle), y: a.cy + a.r * Math.sin(a.startAngle) }, v,
      );
      const p2 = toScreen(
        { x: a.cx + a.r * Math.cos(a.endAngle), y: a.cy + a.r * Math.sin(a.endAngle) }, v,
      );
      let sweepAngle = a.endAngle - a.startAngle;
      while (sweepAngle <= 0) sweepAngle += Math.PI * 2;
      const largeArc = sweepAngle > Math.PI ? 1 : 0;
      // 世界系逆时针在屏幕 y 翻转后为 sweep-flag=0
      return (
        <path
          d={`M ${p1.x} ${p1.y} A ${rx} ${ry} 0 ${largeArc} 0 ${p2.x} ${p2.y}`}
          fill="none" stroke={stroke} strokeWidth={sw}
        />
      );
    }
    case "rect": {
      const r = shape as RectShape;
      const x = Math.min(r.x1, r.x2);
      const y = Math.min(r.y1, r.y2);
      const w = Math.abs(r.x2 - r.x1);
      const h = Math.abs(r.y2 - r.y1);
      const a = toScreen({ x, y: y + h }, v);
      return (
        <rect
          x={a.x} y={a.y}
          width={Math.abs(w * sx(v))} height={Math.abs(h * sy(v))}
          fill="none" stroke={stroke} strokeWidth={sw}
        />
      );
    }
    case "polygon": {
      const p = shape as PolygonShape;
      const d = pathFromPoints(polygonPoints(p), v);
      return <path d={`${d} Z`} fill="none" stroke={stroke} strokeWidth={sw} />;
    }
    case "ray": {
      const l = shape as RayShape;
      const ang = Math.atan2(l.y2 - l.y1, l.x2 - l.x1);
      const far = { x: l.x1 + 1000 * Math.cos(ang), y: l.y1 + 1000 * Math.sin(ang) };
      const a = toScreen({ x: l.x1, y: l.y1 }, v);
      const b = toScreen(far, v);
      return (
        <g>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} markerEnd="url(#arrow)" />
        </g>
      );
    }
    case "line": {
      const a = toScreen({ x: shape.x1, y: shape.y1 }, v);
      const b = toScreen({ x: shape.x2, y: shape.y2 }, v);
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} />;
    }
    case "point": {
      const p = toScreen({ x: shape.x, y: shape.y }, v);
      return <circle cx={p.x} cy={p.y} r={6} fill={stroke} />;
    }
    case "poly": {
      const p = shape as PolyShape;
      const d = pathFromPoints(p.points, v);
      return (
        <path
          d={p.closed ? `${d} Z` : d}
          fill="none" stroke={stroke} strokeWidth={sw}
          strokeLinejoin="round" strokeLinecap="round"
        />
      );
    }
    case "angle": {
      const a = shape as AngleShape;
      const { start, span } = drawRange(a);
      const at = (ang: number, len = a.r * 1.3) => toScreen({
        x: a.vx + len * Math.cos(ang),
        y: a.vy + len * Math.sin(ang),
      }, v);
      const vertex = toScreen({ x: a.vx, y: a.vy }, v);
      const p1 = at(start, a.r);
      const p2 = at(start + span, a.r);
      const reach1 = at(start);
      const reach2 = at(start + span);
      const deg = angleSpanDeg(a);
      const isRight = Math.abs(deg - 90) < 0.6;
      const label = Number.isInteger(Math.round(deg)) ? `${Math.round(deg)}°` : `${deg.toFixed(1)}°`;

      // 直角画方角标记，其余画弧
      const mark = isRight ? (() => {
        const d = a.r * 0.62;
        const ux1 = Math.cos(start), uy1 = Math.sin(start);
        const ux2 = Math.cos(start + span), uy2 = Math.sin(start + span);
        const c1 = toScreen({ x: a.vx + ux1 * d, y: a.vy + uy1 * d }, v);
        const c2 = toScreen({ x: a.vx + (ux1 + ux2) * d, y: a.vy + (uy1 + uy2) * d }, v);
        const c3 = toScreen({ x: a.vx + ux2 * d, y: a.vy + uy2 * d }, v);
        return (
          <path d={`M ${c1.x} ${c1.y} L ${c2.x} ${c2.y} L ${c3.x} ${c3.y}`}
            fill="none" stroke={stroke} strokeWidth={sw} />
        );
      })() : (
        <path
          d={`M ${p1.x} ${p1.y} A ${Math.abs(a.r * sx(v))} ${Math.abs(a.r * sy(v))} 0 0 0 ${p2.x} ${p2.y}`}
          fill="none" stroke={stroke} strokeWidth={sw}
        />
      );

      const mid = at(start + span / 2, a.r * 1.55);
      return (
        <g>
          <line x1={vertex.x} y1={vertex.y} x2={reach1.x} y2={reach1.y} stroke={stroke} strokeWidth={sw} />
          <line x1={vertex.x} y1={vertex.y} x2={reach2.x} y2={reach2.y} stroke={stroke} strokeWidth={sw} />
          {mark}
          <text x={mid.x} y={mid.y + 4} fontSize={11} fill={stroke} textAnchor="middle" fontWeight={600}>{label}</text>
        </g>
      );
    }
    case "ink": {
      const ink = shape as InkShape;
      return (
        <path
          d={pathFromPoints(ink.points, v)}
          fill="none" stroke={stroke} strokeWidth={ink.width}
          strokeLinecap="round" strokeLinejoin="round"
        />
      );
    }
    case "function": {
      const pts = sampleFunction(shape, 320);
      return <path d={pathFromPoints(pts, v)} fill="none" stroke={stroke} strokeWidth={sw} />;
    }
    case "parametric": {
      const pts = sampleParametric(shape, 360);
      return <path d={pathFromPoints(pts, v)} fill="none" stroke={stroke} strokeWidth={sw} />;
    }
    default:
      return null;
  }
}

export function ShapeLayer({
  shapes, viewport: v, highlightId, preview, previewShape,
  showGrid = true, showTicks = true, gridStep, strokeWidth = 2,
}: Props) {
  const coord = shapes.find((s) => s.type === "coord");
  const step = gridStep ?? (coord && coord.type === "coord" ? coord.grid : 1);
  const grid = gridLines(v, step);
  const selected = shapes.find((s) => s.id === highlightId);
  const handles = selected ? getHandles(selected) : [];

  return (
    <g>
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L0,6 L9,3 z" fill="#555" />
        </marker>
      </defs>

      {/* 网格 */}
      {showGrid ? grid.x.map((x) => {
        const px = toScreen({ x, y: 0 }, v).x;
        return (
          <line key={`gx-${x}`} x1={px} y1={0} x2={px} y2={v.height}
            stroke="var(--grid-line, #d8d3c8)" strokeWidth={Math.abs(x) < 1e-9 ? 1.4 : 0.6} opacity={Math.abs(x) < 1e-9 ? 1 : 0.7} />
        );
      }) : null}
      {showGrid ? grid.y.map((y) => {
        const py = toScreen({ x: 0, y }, v).y;
        return (
          <line key={`gy-${y}`} x1={0} y1={py} x2={v.width} y2={py}
            stroke="var(--grid-line, #d8d3c8)" strokeWidth={Math.abs(y) < 1e-9 ? 1.4 : 0.6} opacity={Math.abs(y) < 1e-9 ? 1 : 0.7} />
        );
      }) : null}

      {/* 刻度标签：按像素间距自动抽稀，避免面板拉高后数字挤成一片 */}
      {showTicks ? (() => {
        const pxX = v.width / (v.xRange[1] - v.xRange[0]);
        const pxY = v.height / (v.yRange[1] - v.yRange[0]);
        const everyX = Math.max(1, Math.ceil(28 / Math.max(1, pxX * step)));
        const everyY = Math.max(1, Math.ceil(28 / Math.max(1, pxY * step)));
        return (
          <>
            {grid.x.map((x, i) => ({ x, i })).filter(({ x, i }) => Math.abs(x) > 1e-9 && i % everyX === 0).map(({ x }) => {
              const p = toScreen({ x, y: 0 }, v);
              return <text key={`tx-${x}`} x={p.x} y={p.y + 14} fontSize={10} fill="var(--tick-text, #8a8377)" textAnchor="middle">{x}</text>;
            })}
            {grid.y.map((y, i) => ({ y, i })).filter(({ y, i }) => Math.abs(y) > 1e-9 && i % everyY === 0).map(({ y }) => {
              const p = toScreen({ x: 0, y }, v);
              return <text key={`ty-${y}`} x={p.x - 5} y={p.y + 3} fontSize={10} fill="var(--tick-text, #8a8377)" textAnchor="end">{y}</text>;
            })}
          </>
        );
      })() : null}

      {/* 图形 */}
      {shapes.map((shape) => (
        <g key={shape.id}>{renderShape(shape, v, shape.id === highlightId, strokeWidth)}</g>
      ))}

      {/* 选中图形的控制点 */}
      {handles.map((h) => {
        const p = toScreen(h.at, v);
        return <circle key={h.id} cx={p.x} cy={p.y} r={6} fill="#fff" stroke="#2563eb" strokeWidth={2} />;
      })}

      {/* 圆规预览 */}
      {preview ? (
        <circle
          cx={toScreen({ x: preview.cx, y: 0 }, v).x}
          cy={toScreen({ x: 0, y: preview.cy }, v).y}
          r={radiusToScreen(preview.r, v)}
          fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="6 4" opacity={0.8}
        />
      ) : null}

      {/* 拖动绘制 / 笔迹实时预览 */}
      {previewShape ? (
        <g opacity={0.65}>{renderShape(previewShape, v, false, strokeWidth)}</g>
      ) : null}
    </g>
  );
}
