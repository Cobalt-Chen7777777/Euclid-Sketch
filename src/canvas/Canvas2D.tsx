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
import { createPrimitiveByDrag, getHandles, hitTest, type Handle } from "../model/geometry";
import { smoothPoints } from "../model/ink";
import type { CircleShape, InkShape, Point2, PrimitiveType, Shape } from "../model/types";
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

export type Tool = "select" | "compass" | "place" | "pen" | "eraser" | "angle" | "pan";

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
  /** place 工具要绘制的图元类型与边数 */
  placeType: PrimitiveType;
  placeSides: number;
  /** pen 工具笔宽（屏幕像素） */
  penWidth: number;
  /** 设置页下发的外观与行为开关 */
  options: CanvasOptions;
}

type DragState =
  | { kind: "none" }
  | { kind: "pan"; startScreen: Point2; startVp: Viewport }
  | { kind: "handle"; id: string; handle: Handle }
  | { kind: "compass"; center: Point2; current: Point2 }
  | { kind: "draw"; start: Point2; current: Point2 }
  | { kind: "ink"; points: Point2[] }
  | { kind: "erase" };

const SNAP_PX = 16;

export function Canvas2D(props: Props) {
  const {
    shapes, setShapes, viewport: v, setViewport, tool, color,
    lockRadius, lockedRadius, onLockedRadiusChange,
    svgRef, selectedId, onSelect, onToast, placeType, placeSides, penWidth, options,
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
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || typeof ResizeObserver !== "function") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let measured = false;

    const apply = () => {
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
  }, [setViewport, svgRef]);

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

  /** 橡皮擦：删除命中的图形（坐标系不可删），命中范围来自设置 */
  const eraseAt = useCallback((world: Point2) => {
    const tolWorld = (options.eraserRadius / v.width) * (v.xRange[1] - v.xRange[0]);
    const hit = [...shapes].reverse().find((s) => s.type !== "coord" && hitTest(s, world, tolWorld));
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

    if (tool === "pan") {
      setDrag({ kind: "pan", startScreen: sp, startVp: v });
      return;
    }

    const worldRaw = toWorld(sp, v);

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
        setShapes((prev) => [...prev, shape]);
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
        setViewport((prev) => zoomViewport(prev, center, factor));
        pinch.current = { dist, center };
      }
      return;
    }

    if (tool === "angle") {
      setHoverWorld(toWorld(sp, v));
      return;
    }

    setDrag((d) => {
      switch (d.kind) {
        case "pan": {
          const dx = (sp.x - d.startScreen.x) / v.width;
          const dy = (sp.y - d.startScreen.y) / v.height;
          const spanX = d.startVp.xRange[1] - d.startVp.xRange[0];
          const spanY = d.startVp.yRange[1] - d.startVp.yRange[0];
          setViewport({
            ...d.startVp,
            xRange: panRange(d.startVp.xRange, -dx * spanX),
            yRange: panRange(d.startVp.yRange, dy * spanY),
          });
          return d;
        }
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

    if (drag.kind === "compass" && !lockRadius) {
      const r = Math.hypot(drag.current.x - drag.center.x, drag.current.y - drag.center.y);
      if (r > 0.15) {
        setShapes((prev) => [...prev, {
          id: newId("circle"), type: "circle", cx: drag.center.x, cy: drag.center.y, r, color,
        } as CircleShape]);
        onLockedRadiusChange(r);
        onToast?.(`圆规画圆 r=${r.toFixed(2)}`);
      }
    } else if (drag.kind === "draw") {
      const shape = createPrimitiveByDrag(placeType, drag.start, drag.current, color, placeSides);
      if (shape) {
        setShapes((prev) => [...prev, shape]);
        onSelect(shape.id);
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
    tool === "pan" ? "grab"
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
        <ShapeLayer
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
    </div>
  );
}
