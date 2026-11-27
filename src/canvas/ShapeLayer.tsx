/** 纯渲染：把 Shape[] 画成 SVG 元素。不含交互逻辑。 */
import { memo, useMemo } from "react";

import { logEvent } from "../debug/log";
import { useRenderAudit } from "./useRenderAudit";

/** 已上报异常的曲线 id：同一条只报一次，避免每帧刷日志 */
const reportedInk = new Set<string>();
import { angleSpanDeg, drawRange } from "../model/angle";
import { sampleFunction, sampleParametric } from "../model/formula";
import { sampleImplicit } from "../model/implicit";
import { getHandles, polygonPoints } from "../model/geometry";
import { isVisible, sortForRender } from "../model/layers";
import { shapeBBox } from "../model/lasso";
import type { AngleShape, ArcShape, ImageShape, PolyShape, EllipseShape, InkShape, Point2, PolygonShape, RayShape, RectShape, Shape } from "../model/types";
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
  /** 套索多选（画包围盒虚线框） */
  selectionIds?: string[];
  /** 套索正在框选的轨迹（世界坐标） */
  lassoPoints?: Point2[] | null;
  /** 圆规预览圆（草稿预览用，与 previewShape 二选一） */
  preview?: { cx: number; cy: number; r: number } | null;
  /** 拖动绘制/笔迹的实时预览图形 */
  previewShape?: Shape | null;
  /** 拖动控制点缩放中的图形：只借它显示实时参数，不画半透明预览 */
  labelShape?: Shape | null;
  /** 显示网格（设置项） */
  showGrid?: boolean;
  /** 显示刻度数字（设置项） */
  showTicks?: boolean;
  /** 网格密度，覆盖坐标系自带的 grid（设置项） */
  gridStep?: number;
  /** 拖动缩放窗口期间：网格步长放大 4 倍，减少每帧重绘量（图形与坐标轴照常） */
  gridLite?: boolean;
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

/** 隐函数：一串独立短线段，逐段 M…L…（不做首尾连接） */
function pathFromSegments(segs: [Point2, Point2][], v: Viewport): string {
  let d = "";
  for (const [a, b] of segs) {
    const sa = toScreen(a, v);
    const sb = toScreen(b, v);
    if (!Number.isFinite(sa.x) || !Number.isFinite(sa.y) || !Number.isFinite(sb.x) || !Number.isFinite(sb.y)) continue;
    d += `M${sa.x.toFixed(1)},${sa.y.toFixed(1)}L${sb.x.toFixed(1)},${sb.y.toFixed(1)}`;
  }
  return d;
}

/** 绘制中的实时参数：按图形类型给出最有用的数值 */
function previewLabel(shape: Shape): string {
  const f = (n: number) => n.toFixed(2);
  switch (shape.type) {
    case "circle": return `r = ${f(shape.r)}`;
    case "ellipse": return `a ${f(shape.rx)} · b ${f(shape.ry)}`;
    case "rect": return `${f(Math.abs(shape.x2 - shape.x1))} × ${f(Math.abs(shape.y2 - shape.y1))}`;
    case "line": case "ray": return `长 ${f(Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1))}`;
    case "polygon": return `${shape.sides} 边 · r ${f(shape.r)}`;
    case "arc": return `r ${f(shape.r)} · ${Math.round(Math.abs(shape.endAngle - shape.startAngle) * 180 / Math.PI)}°`;
    case "point": return `(${f(shape.x)}, ${f(shape.y)})`;
    case "poly": {
      const bb = shapeBBox(shape);
      return `${f(bb.x2 - bb.x1)} × ${f(bb.y2 - bb.y1)}`;
    }
    default: return "";
  }
}

/**
 * Catmull-Rom → 三次贝塞尔：多点曲线工具的平滑路径。
 * 在屏幕坐标里算，缩放/平移时曲率观感稳定。
 */
function smoothPath(points: { x: number; y: number }[], v: Viewport, tangents?: Point2[]): string {
  // 视口跨度异常时缩放会出无穷，所有控制点都会变 NaN → path 失效，曲线整条不显示
  const scale = v.width / (v.xRange[1] - v.xRange[0]);
  if (!Number.isFinite(scale) || scale <= 0) return pathFromPoints(points, v);

  // 过滤坏点的同时带上对应切线，避免索引错位（原来只过滤点，切线还按旧下标取，会取到 undefined）
  const nodes = points
    .map((p, i) => ({ p: toScreen(p, v), t: tangents?.[i] }))
    .filter((n) => Number.isFinite(n.p.x) && Number.isFinite(n.p.y));
  if (nodes.length < 2) return "";
  const ok = (n: number) => Number.isFinite(n);
  let d = `M${nodes[0]!.p.x.toFixed(1)},${nodes[0]!.p.y.toFixed(1)}`;

  for (let i = 0; i < nodes.length - 1; i += 1) {
    const a = nodes[i]!;
    const b = nodes[i + 1]!;
    let c1: { x: number; y: number };
    let c2: { x: number; y: number };
    if (nodes.some((n) => n.t)) {
      // 钢笔切线：手柄决定曲率；某点没有切线时用零向量（等价直线）
      const t1 = a.t ?? { x: 0, y: 0 };
      const t2 = b.t ?? { x: 0, y: 0 };
      c1 = { x: a.p.x + t1.x * scale, y: a.p.y + t1.y * scale };
      c2 = { x: b.p.x - t2.x * scale, y: b.p.y - t2.y * scale };
    } else {
      const p0 = nodes[i === 0 ? 0 : i - 1]!.p;
      const p3 = nodes[i + 2 < nodes.length ? i + 2 : nodes.length - 1]!.p;
      c1 = { x: a.p.x + (b.p.x - p0.x) / 6, y: a.p.y + (b.p.y - p0.y) / 6 };
      c2 = { x: b.p.x - (p3.x - a.p.x) / 6, y: b.p.y - (p3.y - a.p.y) / 6 };
    }
    // 任一控制点非法就退化为直线段，保证曲线整体仍可见
    if (!ok(c1.x) || !ok(c1.y) || !ok(c2.x) || !ok(c2.y)) {
      d += ` L${b.p.x.toFixed(1)},${b.p.y.toFixed(1)}`;
      continue;
    }
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${b.p.x.toFixed(1)},${b.p.y.toFixed(1)}`;
  }
  return d;
}

/** 屏幕半径：分别取 x/y 缩放，用于椭圆/圆弧的非等比投影 */
const sx = (v: Viewport) => v.width / (v.xRange[1] - v.xRange[0]);
const sy = (v: Viewport) => v.height / (v.yRange[1] - v.yRange[0]);

function renderShape(shape: Shape, v: Viewport, selected: boolean, baseWidth = 2) {
  const stroke = "color" in shape ? shape.color : "#2563eb";
  const sw = selected ? baseWidth + 1 : baseWidth;
  // 虚线线型：图形带 dashed 标记时描边用 dash
  const dashA = "dashed" in shape && shape.dashed ? "7 5" : undefined;
  switch (shape.type) {
    case "coord":
      return null;
    case "circle": {
      const c = toScreen({ x: shape.cx, y: shape.cy }, v);
      const r = radiusToScreen(shape.r, v);
      return <circle cx={c.x} cy={c.y} r={r} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dashA} />;
    }
    case "ellipse": {
      const e = shape as EllipseShape;
      const c = toScreen({ x: e.cx, y: e.cy }, v);
      return (
        <ellipse
          cx={c.x} cy={c.y}
          rx={Math.abs(e.rx * sx(v))} ry={Math.abs(e.ry * sy(v))}
          fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dashA}
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
          fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dashA}
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
          fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dashA}
        />
      );
    }
    case "polygon": {
      const p = shape as PolygonShape;
      const d = pathFromPoints(polygonPoints(p), v);
      return <path d={`${d} Z`} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dashA} />;
    }
    case "ray": {
      const l = shape as RayShape;
      const ang = Math.atan2(l.y2 - l.y1, l.x2 - l.x1);
      const far = { x: l.x1 + 1000 * Math.cos(ang), y: l.y1 + 1000 * Math.sin(ang) };
      const a = toScreen({ x: l.x1, y: l.y1 }, v);
      const b = toScreen(far, v);
      return (
        <g>
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} strokeDasharray={dashA} markerEnd="url(#arrow)" />
        </g>
      );
    }
    case "line": {
      const a = toScreen({ x: shape.x1, y: shape.y1 }, v);
      const b = toScreen({ x: shape.x2, y: shape.y2 }, v);
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={stroke} strokeWidth={sw} strokeDasharray={dashA} />;
    }
    case "point": {
      const p = toScreen({ x: shape.x, y: shape.y }, v);
      return <circle cx={p.x} cy={p.y} r={6} fill={stroke} />;
    }
    case "image": {
      const im = shape as ImageShape;
      const bl = toScreen({ x: im.x, y: im.y }, v);
      const tr = toScreen({ x: im.x + im.w, y: im.y + im.h }, v);
      return (
        <image
          href={im.src}
          x={bl.x}
          y={tr.y}
          width={tr.x - bl.x}
          height={bl.y - tr.y}
          preserveAspectRatio="none"
        />
      );
    }
    case "poly": {
      const p = shape as PolyShape;
      const d = pathFromPoints(p.points, v);
      return (
        <path
          d={p.closed ? `${d} Z` : d}
          fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dashA}
          strokeLinejoin="round" strokeLinecap="round"
        />
      );
    }
    case "angle": {
      const a = shape as AngleShape;
      const { start, span } = drawRange(a);
      const armLen = a.len ?? a.r * 1.3;
      const armLen2 = armLen;
      const at = (ang: number, len = armLen) => toScreen({
        x: a.vx + len * Math.cos(ang),
        y: a.vy + len * Math.sin(ang),
      }, v);
      const vertex = toScreen({ x: a.vx, y: a.vy }, v);
      const p1 = at(start, a.r);
      const p2 = at(start + span, a.r);
      const reach1 = at(start, armLen);
      const reach2 = at(start + span, armLen2);
      const deg = angleSpanDeg(a);
      // 直角符号和标签必须同源：之前 isRight 用 ±0.6° 判定、标签用四舍五入，
      // 89.4~89.5° 这段会同时命中「标签 89°」和「直角符号」，看起来就是 89° 却画了方角
      // 与标签四舍五入同一档：凡是会显示成 90° 的，才画直角符号
      const isRight = Math.abs(deg - 90) < 0.5;
      const shownDeg = isRight ? 90 : deg;
      const label = Number.isInteger(Math.round(shownDeg)) ? `${Math.round(shownDeg)}°` : `${shownDeg.toFixed(1)}°`;

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
            fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dashA} />
        );
      })() : (
        <path
          d={`M ${p1.x} ${p1.y} A ${Math.abs(a.r * sx(v))} ${Math.abs(a.r * sy(v))} 0 0 0 ${p2.x} ${p2.y}`}
          fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dashA}
        />
      );

      const mid = at(start + span / 2, a.r * 1.55);
      return (
        <g>
          <line x1={vertex.x} y1={vertex.y} x2={reach1.x} y2={reach1.y} stroke={stroke} strokeWidth={sw} strokeDasharray={dashA} />
          <line x1={vertex.x} y1={vertex.y} x2={reach2.x} y2={reach2.y} stroke={stroke} strokeWidth={sw} strokeDasharray={dashA} />
          {mark}
          <text x={mid.x} y={mid.y + 4} fontSize={11} fill={stroke} stroke="var(--canvas-bg, #fff)" strokeWidth={2.8}
            paintOrder="stroke" textAnchor="middle" fontWeight={600}>{label}</text>
        </g>
      );
    }
    case "ink": {
      const ink = shape as InkShape;
      const d = ink.smooth ? smoothPath(ink.points, v, ink.tangents) : pathFromPoints(ink.points, v);
      if (!d || d.includes("NaN")) {
        if (!reportedInk.has(ink.id)) {
          reportedInk.add(ink.id);
          logEvent("curve.empty", `id=${ink.id.slice(-6)} pts=${ink.points.length} smooth=${ink.smooth} d=${(d || "").slice(0, 40)}`);
        }
      } else {
        reportedInk.delete(ink.id);
      }
      return (
        <path
          d={d}
          fill="none" stroke={stroke} strokeWidth={ink.width}
          strokeLinecap="round" strokeLinejoin="round"
        />
      );
    }
    case "function": {
      const pts = sampleFunction(shape, 320);
      return <path d={pathFromPoints(pts, v)} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dashA} />;
    }
    case "parametric": {
      const pts = sampleParametric(shape, 360);
      return <path d={pathFromPoints(pts, v)} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dashA} />;
    }
    case "implicit": {
      const segs = sampleImplicit(shape);
      return <path d={pathFromSegments(segs, v)} fill="none" stroke={stroke} strokeWidth={sw} strokeDasharray={dashA} strokeLinecap="round" />;
    }
    default:
      return null;
  }
}

/**
 * 静态图形层（memo）：网格/刻度/已提交图形/控制点。
 * 拖动预览帧（圆规/绘制/笔迹）只有预览部分变化，静态层 props 引用不变即整层跳过重渲染——
 * 这是拖动流畅度的关键：每帧渲染成本从「全部图形」降到「单个预览元素」。
 */
interface ShapeNodeProps {
  shape: Shape;
  v: Viewport;
  selected: boolean;
  strokeWidth: number;
}

/**
 * 单个图形节点：memo 化后，拖动某个图形时只有它自己重算，
 * 其余图形（引用未变）直接命中缓存——大画布拖动明显更跟手。
 */
const ShapeNode = memo(function ShapeNode({ shape, v, selected, strokeWidth }: ShapeNodeProps) {
  return (
    <g opacity={shape.locked && shape.type !== "image" ? 0.45 : 1}>
      {renderShape(shape, v, selected, strokeWidth)}
    </g>
  );
});

const StaticLayer = memo(function StaticLayer({
  shapes, viewport: v, highlightId, selectionIds, lassoPoints,
  showGrid = true, showTicks = true, gridStep, strokeWidth = 2, gridLite = false,
}: Omit<Props, "preview" | "previewShape">) {
  // 「画不出来」要真的数出来：此前 renderedInk 直接传 ink 总数，drawn 恒等于 ink，
  // render.bad 永远不会触发，日志看不出曲线是否渲染失败
  const inkStats = useMemo(() => {
    let ink = 0;
    let bad = 0;
    for (const s of shapes) {
      if (s.type !== "ink") continue;
      ink += 1;
      const sh = s as InkShape;
      const d = sh.smooth ? smoothPath(sh.points, v, sh.tangents) : pathFromPoints(sh.points, v);
      if (!d || d.includes("NaN")) bad += 1;
    }
    return { ink, bad };
  }, [shapes, v]);
  useRenderAudit({ shapes, viewport: v, renderedInk: inkStats.ink - inkStats.bad });
  const coord = shapes.find((s) => s.type === "coord");
  const baseStep = gridStep ?? (coord && coord.type === "coord" ? coord.grid : 1);
  // 拖动缩放时降低网格密度：每帧重绘 240 条线是掉帧主因
  const step = gridLite ? baseStep * 4 : baseStep;
  const grid = gridLines(v, step);
  const selected = shapes.find((s) => s.id === highlightId);
  const handles = selected ? getHandles(selected) : [];

  return (
    <>
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
              return <text key={`tx-${x}`} x={p.x} y={p.y + 14} fontSize={11} fill="var(--tick-text, #8a8377)" textAnchor="middle">{x}</text>;
            })}
            {grid.y.map((y, i) => ({ y, i })).filter(({ y, i }) => Math.abs(y) > 1e-9 && i % everyY === 0).map(({ y }) => {
              const p = toScreen({ x: 0, y }, v);
              return <text key={`ty-${y}`} x={p.x - 5} y={p.y + 3} fontSize={11} fill="var(--tick-text, #8a8377)" textAnchor="end">{y}</text>;
            })}
          </>
        );
      })() : null}

      {/* 图形：锁定的图层淡化显示（一眼能看出哪些不可操作） */}
      {sortForRender(shapes).filter(isVisible).map((shape) => (
        <ShapeNode key={shape.id} shape={shape} v={v} selected={shape.id === highlightId} strokeWidth={strokeWidth} />
      ))}

      {/* 选中图形的控制点：缩放点用绿色 + 对角双箭头（与蓝色移动/端点区分），
          配色取自主题绿（成功/尺寸语义），白描边保证任何底色上清晰 */}
      {handles.map((h) => {
        const p = toScreen(h.at, v);
        const isResize = h.id === "resize";
        if (isResize) {
          return (
            <g key={h.id}>
              <circle cx={p.x} cy={p.y} r={12} fill="rgba(16, 185, 129, .14)" />
              <circle cx={p.x} cy={p.y} r={6.5} fill="#10b981" stroke="#fff" strokeWidth={1.8} />
              <path
                d={`M${p.x - 2.4},${p.y - 2.4} L${p.x + 2.4},${p.y + 2.4}`}
                stroke="#fff" strokeWidth={1.5} strokeLinecap="round"
              />
              <path
                d={`M${p.x - 1.1},${p.y - 2.4} L${p.x - 2.4},${p.y - 2.4} L${p.x - 2.4},${p.y - 1.1}
                    M${p.x + 1.1},${p.y + 2.4} L${p.x + 2.4},${p.y + 2.4} L${p.x + 2.4},${p.y + 1.1}`}
                fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
              />
            </g>
          );
        }
        // 曲线的切线手柄（h*）画成小空心点 + 与顶点的虚线引导线，顶点（k*）实心，便于区分
        if (h.id.startsWith("h")) {
          const k = handles.find((x) => x.id === `k${h.id.slice(1)}`);
          const kp = k ? toScreen(k.at, v) : null;
          return (
            <g key={h.id}>
              {kp ? (
                <line x1={kp.x} y1={kp.y} x2={p.x} y2={p.y} stroke="#2563eb" strokeWidth={1} strokeDasharray="3 3" opacity={0.55} />
              ) : null}
              <circle cx={p.x} cy={p.y} r={4.5} fill="#fff" stroke="#2563eb" strokeWidth={1.8} />
            </g>
          );
        }
        const isVertex = h.id.startsWith("k");
        return <circle key={h.id} cx={p.x} cy={p.y} r={isVertex ? 5 : 6}
          fill={isVertex ? "#2563eb" : "#fff"} stroke="#2563eb" strokeWidth={2} />;
      })}

      {/* 套索多选：每个选中图形画包围盒，框选时额外画轨迹（此前完全没有视觉反馈） */}
      {(selectionIds ?? []).map((id) => {
        const s0 = shapes.find((x) => x.id === id);
        if (!s0) return null;
        const b = shapeBBox(s0);
        const a = toScreen({ x: b.x1, y: b.y1 }, v);
        const c2 = toScreen({ x: b.x2, y: b.y2 }, v);
        return (
          <rect key={`sel-${id}`} x={Math.min(a.x, c2.x)} y={Math.min(a.y, c2.y)}
            width={Math.abs(c2.x - a.x)} height={Math.abs(c2.y - a.y)}
            fill="rgba(37, 99, 235, .10)" stroke="#2563eb" strokeWidth={1.4}
            strokeDasharray="5 4" pointerEvents="none" />
        );
      })}
      {lassoPoints && lassoPoints.length > 1 ? (
        <polyline
          points={lassoPoints.map((pt) => {
            const sp2 = toScreen(pt, v);
            return `${sp2.x.toFixed(1)},${sp2.y.toFixed(1)}`;
          }).join(" ")}
          fill="rgba(37, 99, 235, .08)" stroke="#2563eb" strokeWidth={1.5}
          strokeDasharray="6 4" pointerEvents="none" />
      ) : null}
    </>
  );
});

export function ShapeLayer({
  preview, previewShape, labelShape,
  ...rest
}: Props) {
  return (
    <g>
      <StaticLayer {...rest} />

      {/* 圆规预览 */}
      {preview ? (
        <circle
          cx={toScreen({ x: preview.cx, y: 0 }, rest.viewport).x}
          cy={toScreen({ x: 0, y: preview.cy }, rest.viewport).y}
          r={radiusToScreen(preview.r, rest.viewport)}
          fill="none" stroke="#dc2626" strokeWidth={2} strokeDasharray="6 4" opacity={0.8}
        />
      ) : null}

      {/* 拖动绘制 / 笔迹实时预览 */}
      {(() => {
        // 绘制中的实时参数：圆看半径、线段看长度、矩形看宽高、圆弧看半径与跨度……
        const shown = previewShape ?? labelShape ?? null;
        const label = shown ? previewLabel(shown) : preview ? `r = ${preview.r.toFixed(2)}` : "";
        if (!label) return null;
        const box = shown
          ? shapeBBox(shown)
          : { x1: (preview?.cx ?? 0) - (preview?.r ?? 0), y1: (preview?.cy ?? 0) - (preview?.r ?? 0),
              x2: (preview?.cx ?? 0) + (preview?.r ?? 0), y2: (preview?.cy ?? 0) + (preview?.r ?? 0) };
        const at = toScreen({ x: box.x2, y: box.y1 }, rest.viewport);
        return (
          <text
            className="preview-tip" x={at.x + 8} y={at.y - 6}
            fontSize={12} fontWeight={600} fill="var(--tip-fill, #b45309)" stroke="var(--tip-stroke, #fff)" strokeWidth={3}
            paintOrder="stroke" textAnchor="start"
          >
            {label}
          </text>
        );
      })()}
      {previewShape ? (
        <g opacity={0.65}>{renderShape(previewShape, rest.viewport, false, rest.strokeWidth ?? 2)}</g>
      ) : null}
    </g>
  );
}
