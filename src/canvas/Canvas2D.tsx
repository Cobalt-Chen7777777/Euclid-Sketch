/**
 * 2D 画布：SVG 渲染 + 交互。
 * 工具：
 *  - select 选择/拖拽（遍历图形控制点）
 *  - compass 圆规（点圆心→拖半径→松开成圆，可吸附，可锁定半径）
 *  - place 拖动绘制图元（按下→拖动决定大小→松开成图）
 *  - pen 自由画笔（草稿纸笔迹）
 *  - eraser 橡皮擦（点选/划过删除图形与笔迹）
 *  - pan 平移画布
 * 缩放：滚轮 / 双指捏合
 */
/* eslint-disable no-restricted-syntax -- SVG 画布的 touch-action/cursor 需内联样式，其余为声明式渲染 */
import { useCallback, useEffect, useRef, useState } from "react";

import { createAngle } from "../model/angle";
import { lassoSelect, shapeBBox, translateShape } from "../model/lasso";
import { createPrimitiveByDrag, getHandles, hitTest, type Handle } from "../model/geometry";
import { smoothPoints } from "../model/ink";
import type { CircleShape, InkShape, Point2, PrimitiveType, Shape } from "../model/types";
import { ImageLockBadges } from "./imageLock";
import { newId } from "../model/types";
import { ShapeLayer } from "./ShapeLayer";
import {
  fitViewport,
  panRange,
  toScreen,
  toWorld,
  zoomViewport,
  type Viewport,
} from "./viewport";

export type Tool = "select" | "compass" | "place" | "pen" | "eraser" | "angle" | "lasso";

/** 来自设置页的画布行为开关 */
export interface CanvasOptions {
  showGrid: boolean;
  showTicks: boolean;
  snapEnabled: boolean;
  gridStep: number;
  strokeWidth: number;
  eraserRadius: number;
  inkSmoothing: boolean;
  /** 画角度时第二条边吸附到特殊角（30/45/60/90…） */
  specialAngleSnap: boolean;
  /** 线型：画布样式开关——开启后画什么都画成虚线 */
  dashStyle: boolean;
  /** 手指触控作图：关闭后手指不能画图（双指平移缩放保留），仅 Apple Pencil / 鼠标可作图 */
  allowTouchDraw: boolean;
}

interface Props {
  shapes: Shape[];
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>;
  viewport: Viewport;
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>;
  tool: Tool;
  color: string;
  lockRadius: boolean;
  lockedRadius: number | null;
  onLockedRadiusChange: (r: number) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onToast?: (msg: string) => void;
  /** 图片锁定切换（锁定后橡皮擦不掉） */
  onToggleImageLock: (id: string) => void;
  /** 窗口拖动缩放中：冻结视口重算（SVG 自己拉伸，松手后一次算完），避免每帧全量重绘 */
  frozen?: boolean;
  /** place 工具要绘制的图元类型与边数 */
  /** 线型：画布样式开关——开启后画什么都画成虚线 */
  dashStyle: boolean;
  /** 套索/多选：当前选中的图形 id 集合 */
  selectionIds: string[];
  onSelectionChange: (ids: string[]) => void;
  placeType: PrimitiveType;
  placeSides: number;
  /** pen 工具笔宽（屏幕像素） */
  penWidth: number;
  /** 设置页下发的外观与行为开关 */
  options: CanvasOptions;
}

type DragState =
  | { kind: "none" }
  | { kind: "lasso"; points: Point2[] }
  | { kind: "handle"; id: string; handle: Handle }
  | { kind: "compass"; center: Point2; current: Point2 }
  | { kind: "draw"; start: Point2; current: Point2 }
  | { kind: "ink"; points: Point2[] }
  | { kind: "erase" }
  | { kind: "moveSel"; last: Point2 };

const SNAP_PX = 16;

export function Canvas2D(props: Props) {
  const {
    shapes, setShapes, viewport: v, setViewport, tool, color,
    lockRadius, lockedRadius, onLockedRadiusChange,
    svgRef, selectedId, onSelect, onToast, placeType, placeSides, penWidth, options,
    selectionIds, onSelectionChange, onToggleImageLock, frozen = false,
  } = props;

  const [drag, setDrag] = useState<DragState>({ kind: "none" });
  // 角度工具的三步草稿：顶点 → 第一条边 → 第二条边
  const [angleDraft, setAngleDraft] = useState<{ v: Point2; arm1?: Point2; tool: Tool } | null>(null);
  const [hoverWorld, setHoverWorld] = useState<Point2 | null>(null);
  const pointers = useRef<Map<number, Point2>>(new Map());
  const pinch = useRef<{ dist: number; center: Point2 } | null>(null);


  // WKWebView 里只有非 passive 的 touchstart 才能拦住宿主原生手势（拖窗口/滚动）。
  // React 的 onTouchStart 是 passive 的，所以这里用原生监听补一道。
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof el.addEventListener !== "function") return;
    const block = (event: TouchEvent) => { event.preventDefault(); };
    el.addEventListener("touchstart", block, { passive: false });
    el.addEventListener("touchmove", block, { passive: false });
    return () => {
      el.removeEventListener("touchstart", block);
      el.removeEventListener("touchmove", block);
    };
  }, [svgRef]);

  // 画布铺满容器：直接量 svg 自身尺寸（不是带边框的父容器），
  // 否则 viewBox 与渲染尺寸有 1–2px 差，x/y 比例不一致会把角度画歪
  // 拖动窗口缩放期间冻结视口重算：
  // SVG preserveAspectRatio=none 会自行拉伸铺满，松手（frozen→false）时 effect 重跑，
  // 首次 schedule 立即 apply 一次——避免拖动中反复全量重绘网格与图形
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || typeof ResizeObserver !== "function") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let measured = false;

    const apply = () => {
      if (frozen) return;
      const rect = svgEl.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) return;
      setViewport((prev) => {
        if (Math.abs(prev.width - rect.width) < 0.5 && Math.abs(prev.height - rect.height) < 0.5) return prev;
        return fitViewport(prev, rect.width, rect.height);
      });
    };

    // 拖动窗口时尺寸每 70ms 变一次，逐次重排会让整个画布闪烁；
    // 这里等尺寸稳定 120ms 再重算，期间 SVG 自己按新尺寸拉伸。
    const schedule = () => {
      if (!measured) {
        measured = true;
        apply();
        return;
      }
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        apply();
      }, 120);
    };

    const observer = new ResizeObserver(schedule);
    observer.observe(svgEl);
    schedule();
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [setViewport, svgRef, frozen]);

  const localPoint = useCallback((e: { clientX: number; clientY: number }): Point2 => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (v.width / rect.width), y: (e.clientY - rect.top) * (v.height / rect.height) };
  }, [svgRef, v.width, v.height]);

  /** 吸附到已有点 / 圆心 / 控制点（设置里可关闭） */
  const snap = useCallback((world: Point2): Point2 => {
    if (!options.snapEnabled) return world;
    const sp = toScreen(world, v);
    let best: Point2 | null = null;
    let bestD = SNAP_PX;
    for (const s of shapes) {
      for (const h of getHandles(s)) {
        const hs = toScreen(h.at, v);
        const d = Math.hypot(hs.x - sp.x, hs.y - sp.y);
        if (d < bestD) { bestD = d; best = h.at; }
      }
    }
    return best ?? world;
  }, [shapes, v, options.snapEnabled]);

  /** 橡皮擦：删除命中的图形（坐标系与锁定图片不可删），命中范围来自设置 */
  const eraseAt = useCallback((world: Point2) => {
    const tolWorld = (options.eraserRadius / v.width) * (v.xRange[1] - v.xRange[0]);
    const hit = [...shapes].reverse().find((s) => {
      if (s.type === "coord") return false;
      if (s.type === "image" && s.locked) return false;
      return hitTest(s, world, tolWorld);
    });
    if (hit) {
      setShapes((prev) => prev.filter((s) => s.id !== hit.id));
      if (selectedId === hit.id) onSelect(null);
    }
  }, [shapes, v, setShapes, selectedId, onSelect, options.eraserRadius]);

  /** 命中选中图形的控制点（屏幕距离） */
  const hitHandle = useCallback((sp: Point2): { id: string; handle: Handle } | null => {
    if (!selectedId) return null;
    const shape = shapes.find((s) => s.id === selectedId);
    if (!shape) return null;
    for (const h of getHandles(shape)) {
      const hs = toScreen(h.at, v);
      if (Math.hypot(hs.x - sp.x, hs.y - sp.y) <= 14) return { id: shape.id, handle: h };
    }
    return null;
  }, [selectedId, shapes, v]);

  /** 命中已框选集合中的图形（整组拖动入口）：点在图形包围盒内即算（拖动比点选更宽松） */
  const hitSelected = useCallback((world: Point2): boolean => {
    if (selectionIds.length === 0) return false;
    const pad = (10 / v.width) * (v.xRange[1] - v.xRange[0]);
    return [...shapes]
      .reverse()
      .some((s) => {
        if (!selectionIds.includes(s.id)) return false;
        const b = shapeBBox(s);
        return world.x >= b.x1 - pad && world.x <= b.x2 + pad && world.y >= b.y1 - pad && world.y <= b.y2 + pad;
      });
  }, [selectionIds, shapes, v]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // 关键：画布上的拖拽必须只画图，不能让宿主把它当成「拖动面板窗口」。
    // preventDefault 让这次触摸不被宿主的原生手势接管，stopPropagation 断掉冒泡。
    e.preventDefault();
    e.stopPropagation();
    // 捕获挂在 svg 本身：捕获在子节点上时，预览重渲染可能把节点换掉导致捕获丢失
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const sp = localPoint(e);

    pointers.current.set(e.pointerId, sp);

    if (pointers.current.size === 2) {
      const vals = [...pointers.current.values()];
      const a = vals[0];
      const b = vals[1];
      if (a && b) {
        pinch.current = {
          dist: Math.hypot(a.x - b.x, a.y - b.y),
          center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        };
      }
      setDrag({ kind: "none" });
      return;
    }

    // 手指画图开关：关闭后手指触摸不画图（双指手势在上面已处理），只有笔/鼠标可作图
    if (e.pointerType === "touch" && !options.allowTouchDraw) return;

    const worldRaw = toWorld(sp, v);

    if (tool === "lasso") {
      // 已有框选结果时，按住其中任意图形 → 整组拖动；否则开始新框选
      if (hitSelected(worldRaw)) {
        setDrag({ kind: "moveSel", last: worldRaw });
        onToast?.("拖动移动选中图形");
        return;
      }
      setDrag({ kind: "lasso", points: [worldRaw] });
      return;
    }

    if (tool === "select") {
      // 按住已框选图形 → 整组拖动；按住未选图形 → 单选；空白 → 清空
      if (hitSelected(worldRaw)) {
        setDrag({ kind: "moveSel", last: worldRaw });
        return;
      }
      onSelectionChange([]);
    }

    if (tool === "eraser") {
      setDrag({ kind: "erase" });
      eraseAt(worldRaw);
      return;
    }

    if (tool === "pen") {
      setDrag({ kind: "ink", points: [worldRaw] });
      return;
    }

    if (tool === "angle") {
      // 点击推进草稿：第 1 下顶点，第 2 下定第一条边，第 3 下成角
      const world = snap(worldRaw);
      if (!angleDraft || angleDraft.tool !== tool) {
        setAngleDraft({ v: world, tool });
        onToast?.("已定顶点，再点一下定第一条边");
      } else if (!angleDraft.arm1) {
        setAngleDraft({ ...angleDraft, arm1: world });
        onToast?.("再点一下定第二条边，角度按你点的位置算");
      } else {
        const { shape, deg, snapped } = createAngle(
          angleDraft.v, angleDraft.arm1, world, color, options.specialAngleSnap,
        );
        const styled = options.dashStyle ? ({ ...shape, dashed: true } as Shape) : shape;
        setShapes((prev) => [...prev, styled]);
        onSelect(shape.id);
        setAngleDraft(null);
        onToast?.(`角度 ${deg.toFixed(1)}°${snapped ? "（已吸附特殊角）" : ""}`);
      }
      return;
    }

    if (tool === "place") {
      // 拖动绘制：按下定起点，拖动决定大小，松开成图（点类型仍是单击）
      const world = snap(worldRaw);
      if (placeType === "point") {
        const shape = createPrimitiveByDrag("point", world, world, color, placeSides);
        if (shape) {
          setShapes((prev) => [...prev, shape]);
          onSelect(shape.id);
        }
        return;
      }
      setDrag({ kind: "draw", start: world, current: world });
      return;
    }

    const world = snap(worldRaw);

    if (tool === "compass") {
      if (lockRadius && lockedRadius != null) {
        setShapes((prev) => [...prev, {
          id: newId("circle"), type: "circle", cx: world.x, cy: world.y, r: lockedRadius, color,
        } as CircleShape]);
        onToast?.(`已画圆 r=${lockedRadius.toFixed(2)}`);
        return;
      }
      setDrag({ kind: "compass", center: world, current: world });
      return;
    }

    // select：控制点优先，否则点选图形
    const hit = hitHandle(sp);
    if (hit) {
      setDrag({ kind: "handle", id: hit.id, handle: hit.handle });
      return;
    }
    const tolWorld = (14 / v.width) * (v.xRange[1] - v.xRange[0]);
    const hitShape = [...shapes].reverse().find((s) => hitTest(s, worldRaw, tolWorld));
    onSelect(hitShape ? hitShape.id : null);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const sp = localPoint(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, sp);

    if (pointers.current.size === 2 && pinch.current) {
      const vals = [...pointers.current.values()];
      const a = vals[0];
      const b = vals[1];
      if (a && b) {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const factor = pinch.current.dist / (dist || 1);
        const prevCenter = pinch.current.center;
        setViewport((prev) => {
          let next = zoomViewport(prev, center, factor);
          // 双指整体拖动：中心位移换算成世界平移，捏合与拖动可同时进行
          const spanX = next.xRange[1] - next.xRange[0];
          const spanY = next.yRange[1] - next.yRange[0];
          const dx = ((center.x - prevCenter.x) / v.width) * spanX;
          const dy = ((center.y - prevCenter.y) / v.height) * spanY;
          next = { ...next, xRange: panRange(next.xRange, -dx), yRange: panRange(next.yRange, dy) };
          return next;
        });
        pinch.current = { dist, center };
      }
      return;
    }

    if (drag.kind === "moveSel") {
      const world = toWorld(sp, v);
      const dx = world.x - drag.last.x;
      const dy = world.y - drag.last.y;
      if (dx !== 0 || dy !== 0) {
        const ids = new Set(selectionIds);
        setShapes((prev) => prev.map((s) => (ids.has(s.id) ? translateShape(s, dx, dy) : s)));
        setDrag({ kind: "moveSel", last: world });
      }
      return;
    }

    if (drag.kind === "lasso") {
      const world = toWorld(sp, v);
      setDrag((d) => {
        if (d.kind !== "lasso") return d;
        const last = d.points[d.points.length - 1];
        if (last && Math.hypot(world.x - last.x, world.y - last.y) < 0.15) return d;
        return { ...d, points: [...d.points, world] };
      });
      return;
    }

    if (tool === "angle") {
      setHoverWorld(toWorld(sp, v));
      return;
    }

    setDrag((d) => {
      switch (d.kind) {
        case "handle": {
          const world = snap(toWorld(sp, v));
          setShapes((prev) => prev.map((s) => (s.id === d.id ? d.handle.apply(s, world) : s)));
          return d;
        }
        case "compass": {
          let world = snap(toWorld(sp, v));
          if (lockRadius && lockedRadius != null) {
            const angle = Math.atan2(world.y - d.center.y, world.x - d.center.x);
            world = {
              x: d.center.x + lockedRadius * Math.cos(angle),
              y: d.center.y + lockedRadius * Math.sin(angle),
            };
          }
          return { ...d, current: world };
        }
        case "draw":
          return { ...d, current: snap(toWorld(sp, v)) };
        case "ink": {
          const world = toWorld(sp, v);
          const last = d.points[d.points.length - 1];
          // 距离阈值采样，避免点过密
          if (last && Math.hypot(world.x - last.x, world.y - last.y) < 0.04) return d;
          return { ...d, points: [...d.points, world] };
        }
        case "erase":
          eraseAt(toWorld(sp, v));
          return d;
        default:
          return d;
      }
    });
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;

    if (drag.kind === "lasso") {
      const ids = lassoSelect(shapes, drag.points);
      onSelectionChange(ids);
      onToast?.(ids.length > 0 ? `已框选 ${ids.length} 个图形` : "框选区域内没有图形");
    } else if (drag.kind === "compass" && !lockRadius) {
      const r = Math.hypot(drag.current.x - drag.center.x, drag.current.y - drag.center.y);
      if (r > 0.15) {
        setShapes((prev) => [...prev, {
          id: newId("circle"), type: "circle", cx: drag.center.x, cy: drag.center.y, r, color,
          dashed: options.dashStyle || undefined,
        } as CircleShape]);
        onLockedRadiusChange(r);
        onToast?.(`圆规画圆 r=${r.toFixed(2)}`);
      }
    } else if (drag.kind === "draw") {
      const shape = createPrimitiveByDrag(placeType, drag.start, drag.current, color, placeSides);
      if (shape) {
        const styled = options.dashStyle ? ({ ...shape, dashed: true } as Shape) : shape;
        setShapes((prev) => [...prev, styled]);
        onSelect(styled.id);
      }
    } else if (drag.kind === "ink") {
      if (drag.points.length >= 1) {
        const ink: InkShape = {
          id: newId("ink"),
          type: "ink",
          points: options.inkSmoothing ? smoothPoints(drag.points) : drag.points,
          color,
          width: penWidth,
        };
        setShapes((prev) => [...prev, ink]);
      }
    }
    setDrag({ kind: "none" });
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setViewport((prev) => zoomViewport(prev, localPoint(e), e.deltaY > 0 ? 1.1 : 0.9));
  };

  const preview = drag.kind === "compass"
    ? {
        cx: drag.center.x,
        cy: drag.center.y,
        r: Math.hypot(drag.current.x - drag.center.x, drag.current.y - drag.center.y),
      }
    : null;

  // 角度草稿预览：只定了顶点时显示一个点，定了一条边后实时预览角度
  const anglePreview: Shape | null = (() => {
    if (tool !== "angle" || !angleDraft || angleDraft.tool !== tool || !hoverWorld) return null;
    const v0 = angleDraft.v;
    if (!angleDraft.arm1) {
      return { id: "preview-angle-v", type: "point", x: v0.x, y: v0.y, color };
    }
    return createAngle(v0, angleDraft.arm1, hoverWorld, color, options.specialAngleSnap).shape;
  })();

  // 拖动绘制/笔迹的实时预览
  const previewShape: Shape | null = anglePreview ?? (
    drag.kind === "draw"
      ? createPrimitiveByDrag(placeType, drag.start, drag.current, color, placeSides)
      : drag.kind === "ink"
        ? ({
            id: "preview",
            type: "ink",
            points: options.inkSmoothing ? smoothPoints(drag.points) : drag.points,
            color,
            width: penWidth,
          } satisfies InkShape)
        : null);

  const cursor =
    tool === "lasso" ? "crosshair"
      : tool === "eraser" ? "cell"
      : tool === "pen" ? "crosshair"
      : tool === "compass" || tool === "place" || tool === "angle" ? "crosshair"
      : "default";

  return (
    <div className="canvas-stage">
      <svg
        ref={svgRef}
        className="canvas-svg"
        viewBox={`0 0 ${v.width} ${v.height}`}
        preserveAspectRatio="none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        style={{ touchAction: "none", cursor }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width={v.width} height={v.height} fill="var(--canvas-bg, #fffdf8)" />
        {drag.kind === "lasso" && drag.points.length > 1 ? (
          <polygon
            points={drag.points.map((q) => { const p2 = toScreen(q, v); return `${p2.x},${p2.y}`; }).join(" ")}
            fill="rgba(37, 99, 235, .08)"
            stroke="#2563eb"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
        ) : null}
        {selectionIds.map((id) => {
          const sh = shapes.find((q) => q.id === id);
          if (!sh) return null;
          const b = shapeBBox(sh);
          const p1 = toScreen({ x: b.x1, y: b.y2 }, v);
          const p2 = toScreen({ x: b.x2, y: b.y1 }, v);
          return (
            <rect key={`sel-${id}`} x={p1.x} y={p1.y} width={p2.x - p1.x} height={p2.y - p1.y}
              fill="none" stroke="#2563eb" strokeWidth={1.2} strokeDasharray="4 4" opacity={0.8} />
          );
        })}
        {/* 图片锁定徽标：点击切换橡皮保护 */}        <ShapeLayer
          shapes={shapes}
          viewport={v}
          highlightId={selectedId}
          preview={preview}
          previewShape={previewShape}
          showGrid={options.showGrid}
          showTicks={options.showTicks}
          gridStep={options.gridStep}
          strokeWidth={options.strokeWidth}
        />
      </svg>
      {/* 图片锁定徽标：HTML 覆盖层（SVG 内固定尺寸图形会随 viewBox 拉伸变形，锁会歪） */}
      <ImageLockBadges shapes={shapes} v={v} onToggle={onToggleImageLock} />
    </div>
  );
}
