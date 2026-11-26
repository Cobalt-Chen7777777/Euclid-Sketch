/** 2D 画布：SVG 渲染 + 交互（选择 / 圆规 / 绘制 / 画笔 / 橡皮 / 套索 / 角度 / 曲线；滚轮与双指缩放）。 */
/* eslint-disable no-restricted-syntax -- SVG 画布的 touch-action/cursor 需内联样式，其余为声明式渲染 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { CurveDraft } from "./CurveDraft";
import { useHandleDrag } from "./useHandleDrag";

import { createAngle } from "../model/angle";
import { lassoSelect, shapeBBox, translateShape } from "../model/lasso";
import { isEraseable, isSelectable, sortForRender } from "../model/layers";
import { buildCurve } from "../model/curve";
import { snapWorld } from "../model/snap";
import { getHandles, hitTest, type Handle } from "../model/geometry";
import { createPrimitiveByDrag } from "../model/create";
import { smoothPoints } from "../model/ink";
import type { InkShape, Point2, PrimitiveType, Shape } from "../model/types";
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

export type Tool = "select" | "compass" | "place" | "pen" | "eraser" | "angle" | "lasso" | "curve";

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
  /** 曲线画完请求切回选择工具（避免继续加点造成误触） */
  onRequestTool?: (tool: Tool) => void;
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
  /** 新建图形归属的图层 */
  currentLayer: number;
}

type DragState =
  | { kind: "none" }
  | { kind: "lasso"; points: Point2[] }
  | { kind: "handle"; id: string; handle: Handle }
  | { kind: "draw"; start: Point2; current: Point2; raw: Point2 }
  | { kind: "ink"; points: Point2[] }
  | { kind: "curve"; points: Point2[]; tangents: (Point2 | undefined)[] }
  | { kind: "angleArm2"; v: Point2; arm1: Point2; current: Point2 }
  | { kind: "erase" }
  | { kind: "moveSel"; last: Point2; ids: string[] };

export const Canvas2D = memo(function Canvas2D(props: Props) {
  const {
    shapes, setShapes, viewport: v, setViewport, tool, color, onRequestTool,
    lockRadius, lockedRadius, currentLayer,
    svgRef, selectedId, onSelect, onToast, placeType, placeSides, penWidth, options,
    selectionIds, onSelectionChange, onToggleImageLock, frozen = false,
  } = props;

  const [drag, setDrag] = useState<DragState>({ kind: "none" });
  // 角度工具的三步草稿：顶点 → 第一条边 → 第二条边
  const [angleDraft, setAngleDraft] = useState<{ v: Point2; arm1?: Point2; tool: Tool } | null>(null);
  const [hoverWorld, setHoverWorld] = useState<Point2 | null>(null);
  const lastCurveDown = useRef(0);
  const finishCurveRef = useRef<(() => void) | null>(null);
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
        // 小于 6px 的抖动不重算视口：切换设置导致的重排不该让画布看起来「自己缩放」
        if (Math.abs(prev.width - rect.width) < 6 && Math.abs(prev.height - rect.height) < 6) return prev;
        return fitViewport(prev, rect.width, rect.height);
      });
    };

    // 尺寸稳定 120ms 后才重算，期间 SVG 自己按新尺寸拉伸（避免逐帧闪烁）
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

  const snap = useCallback(
    (world: Point2, allowGrid = true) => snapWorld(world, { shapes, v, enabled: options.snapEnabled,
      showGrid: options.showGrid, gridStep: options.gridStep }, allowGrid),
    [shapes, v, options.snapEnabled, options.showGrid, options.gridStep]);


  /** 橡皮擦：删除命中图形（坐标轴 / 隐藏层 / 锁定图形不可删） */
  const eraseAt = useCallback((world: Point2) => {
    const tolWorld = (options.eraserRadius / v.width) * (v.xRange[1] - v.xRange[0]);
    const hit = sortForRender(shapes)
      .filter(isEraseable)
      .reverse()
      .find((s) => s.type !== "coord" && hitTest(s, world, tolWorld));
    if (hit) {
      setShapes((prev) => prev.filter((s) => s.id !== hit.id));
      if (selectedId === hit.id) onSelect(null);
    }
  }, [shapes, v, setShapes, selectedId, onSelect, options.eraserRadius]);

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

  /** 整组拖动命中：点在包围盒内即算（比点选宽松） */
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

  /** 切走角度工具就丢掉未画完的草稿，避免切回来时旧顶点「复活」 */
  useEffect(() => { if (tool !== "angle") setAngleDraft(null); }, [tool]);

  /** 控制点拖动：window 级监听（SVG 的 pointer capture 在 iOS 上不可靠） */
  const handleDrag = useHandleDrag({
    svgRef,
    toWorldAt: (sp, allowGrid) => (allowGrid ? snap(toWorld(sp, v), false) : toWorld(sp, v)),
    setShapes,
  });

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (tool !== "curve" && drag.kind === "curve") setDrag({ kind: "none" });
    // 关键：画布上的拖拽必须只画图，不能让宿主把它当成「拖动面板窗口」。
    // preventDefault 让这次触摸不被宿主的原生手势接管，stopPropagation 断掉冒泡。
    e.preventDefault();
    e.stopPropagation();
    // 捕获挂在 svg 本身：捕获在子节点上时，预览重渲染可能把节点换掉导致捕获丢失
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const sp = localPoint(e);

    if (e.isPrimary) { pointers.current.clear(); pinch.current = null; }
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
    // 手柄只在选择 / 曲线工具下抢：绘制工具优先画新图形，避免在旧图形上起笔时改到它
    if ((tool === "select" || tool === "curve") && selectedId) {
      const hh = hitHandle(sp);
      if (hh) { handleDrag.start(hh.id, hh.handle); return; }
    }

    if (tool === "lasso") {
      // 已有框选结果时，按住其中任意图形 → 整组拖动；否则开始新框选
      if (hitSelected(worldRaw)) {
        setDrag({ kind: "moveSel", last: worldRaw, ids: [...selectionIds] });
        return;
      }
      setDrag({ kind: "lasso", points: [worldRaw] });
      return;
    }

    if (tool === "select") {
      // 按住已框选 → 整组拖动；按住当前选中的图形 → 单图形拖动；否则清空多选并重新点选
      const tolW = (14 / v.width) * (v.xRange[1] - v.xRange[0]);
      const sel = selectedId ? shapes.find((s) => s.id === selectedId) : null;
      if (hitSelected(worldRaw)) { setDrag({ kind: "moveSel", last: worldRaw, ids: [...selectionIds] }); return; }
      if (sel && hitTest(sel, worldRaw, tolW)) { setDrag({ kind: "moveSel", last: worldRaw, ids: [sel.id] }); return; }
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

    if (tool === "curve") {
      // 曲线：每点一下加一个控制点；按下后拖动 = 该点的切线（钢笔手感）
      // 双击判定放在这里：第二次按下就直接收尾，避免先把一个重合点加进去再被去重删掉
      const now = Date.now();
      if (lastCurveDown.current && now - lastCurveDown.current < 320) {
        lastCurveDown.current = 0;
        finishCurveRef.current?.();
        return;
      }
      lastCurveDown.current = now;
      const w = snap(worldRaw);
      setDrag((d) => (d && d.kind === "curve"
        ? { ...d, points: [...d.points, w], tangents: [...d.tangents, undefined] }
        : { kind: "curve", points: [w], tangents: [undefined] }));
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
        // 第三次按下开始拖第二边：拖动实时预览，松手处即为边长（此前一按下就成角，拖动无效）
        setDrag({ kind: "angleArm2", v: angleDraft.v, arm1: angleDraft.arm1, current: world });
      }
      return;
    }

    if (tool === "place") {
      // 拖动绘制：按下定起点，拖动决定大小，松开成图（点类型仍是单击）
      const world = snap(worldRaw);
      // 锁定半径：点一下直接画等半径圆（原「圆规」能力已并入圆工具）
      if (placeType === "circle" && lockRadius && lockedRadius) {
        const shape = createPrimitiveByDrag("circle", world, { x: world.x + lockedRadius, y: world.y }, color, placeSides);
        if (shape) { setShapes((prev) => [...prev, { ...shape, layer: currentLayer }]); onSelect(shape.id); }
        return;
      }
      if (placeType === "point") {
        const shape = createPrimitiveByDrag("point", world, world, color, placeSides);
        if (shape) {
          setShapes((prev) => [...prev, { ...shape, layer: currentLayer }]);
          onSelect(shape.id);
        }
        return;
      }
      setDrag({ kind: "draw", start: world, current: world, raw: world });
      return;
    }


    const tolWorld = (14 / v.width) * (v.xRange[1] - v.xRange[0]);
    const hitShape = sortForRender(shapes).filter(isSelectable).reverse().find((s) => hitTest(s, worldRaw, tolWorld));
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
        // 双指几乎重合时 dist 极小，倍率会爆掉；限制单帧 [0.5, 2] 且过近不缩放
        const safePrev = Math.max(pinch.current.dist, 8);
        const safeNow = Math.max(dist, 8);
        const factor = Math.min(2, Math.max(0.5, safePrev / safeNow));
        const prevCenter = pinch.current.center;
        setViewport((prev) => {
          let next = zoomViewport(prev, center, factor);
          // 双指整体拖动：中心位移换算成世界平移，捏合与拖动可同时进行
          const spanX = next.xRange[1] - next.xRange[0];
          const spanY = next.yRange[1] - next.yRange[0];
          const dx = ((center.x - prevCenter.x) / prev.width) * spanX;
          const dy = ((center.y - prevCenter.y) / prev.height) * spanY;
          next = { ...next, xRange: panRange(next.xRange, -dx), yRange: panRange(next.yRange, dy) };
          return next;
        });
        pinch.current = { dist, center };
      }
      return;
    }

    if (drag.kind === "curve") {
      // 钢笔式：按下后拖出的方向/长度就是该点的出向切线，决定这一处曲率
      const world = toWorld(sp, v);
      const last = drag.points[drag.points.length - 1];
      if (!last) return;
      const tx = world.x - last.x;
      const ty = world.y - last.y;
      if (Math.hypot(tx, ty) <= 0.5) return;
      const tg = [...drag.tangents];
      tg[drag.points.length - 1] = { x: tx, y: ty };
      setDrag({ kind: "curve", points: drag.points, tangents: tg });
      return;
    }

    if (drag.kind === "angleArm2") {
      const world = snap(toWorld(sp, v));
      setDrag({ kind: "angleArm2", v: drag.v, arm1: drag.arm1, current: world });
      return;
    }

    if (drag.kind === "moveSel") {
      const world = toWorld(sp, v);
      const dx = world.x - drag.last.x;
      const dy = world.y - drag.last.y;
      if (dx !== 0 || dy !== 0) {
        const ids = new Set(drag.ids);
        setShapes((prev) => prev.map((s) => (ids.has(s.id) ? translateShape(s, dx, dy) : s)));
        setDrag({ kind: "moveSel", last: world, ids: drag.ids });
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
        case "draw": {
          const raw = toWorld(sp, v);
          return { ...d, raw, current: snap(raw) };
        }
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

    if (drag.kind === "curve") return; // 曲线逐点累积：抬笔不清空，双击才结束

    if (drag.kind === "angleArm2") {
      // 用拖动过程中最近一次已知位置成角：真机 pointerup 的坐标不可靠（常为 0）
      const world = drag.current;
      const { shape, deg, snapped } = createAngle(drag.v, drag.arm1, world, color, options.specialAngleSnap);
      const styled = options.dashStyle ? ({ ...shape, dashed: true } as Shape) : shape;
      setShapes((prev) => [...prev, { ...styled, layer: currentLayer }]);
      onSelect(shape.id);
      setAngleDraft(null);
      onToast?.(`角度 ${deg.toFixed(1)}°${snapped ? "（已吸附特殊角）" : ""}`);
      setDrag({ kind: "none" });
      return;
    }

    if (drag.kind === "lasso") {
      const ids = lassoSelect(shapes.filter(isSelectable), drag.points);
      onSelectionChange(ids);
      onToast?.(ids.length > 0 ? `已框选 ${ids.length} 个图形` : "框选区域内没有图形");
    } else if (drag.kind === "draw") {
      const shape = createPrimitiveByDrag(placeType, drag.start, drag.current, color, placeSides);
      if (shape) {
        const styled = options.dashStyle ? ({ ...shape, dashed: true } as Shape) : shape;
        setShapes((prev) => [...prev, { ...styled, layer: currentLayer }]);
        onSelect(styled.id);
      }
    } else if (drag.kind === "ink") {
      if (drag.points.length >= 1) {
        const ink: InkShape = {
          id: newId("ink"), type: "ink",
          points: options.inkSmoothing ? smoothPoints(drag.points) : drag.points,
          color, width: penWidth,
        };
        setShapes((prev) => [...prev, { ...ink, layer: currentLayer }]);
      }
    }
    setDrag({ kind: "none" });
  };

  /** 双击（或切走工具）结束曲线：去重后落成平滑笔迹 */
  const finishCurve = () => {
    const d = drag;
    if (!d || d.kind !== "curve") return;
    setDrag({ kind: "none" });
    // 双击结束会多落一个点：与上一个点几乎重合时丢掉，避免出现「一坨」控制点。
    // 但不能把点数降到 2 以下——否则整条曲线会被 buildCurve 判为无效而「消失」。
    const pts = [...d.points];
    const lastP = pts[pts.length - 1], prevP = pts[pts.length - 2];
    if (pts.length > 2 && lastP && prevP && Math.hypot(lastP.x - prevP.x, lastP.y - prevP.y) < 0.2) pts.pop();
    const ink = buildCurve(pts, color, penWidth, d.tangents);
    if (!ink) {
      onToast?.("曲线至少需要 2 个控制点，已取消");
      return;
    }
    onRequestTool?.("select");
    setShapes((prev) => [...prev, { ...ink, layer: currentLayer }]);
    onSelect(ink.id);
    onToast?.(`曲线完成：${ink.points.length} 个控制点，拖手柄调曲率`);
  };
  finishCurveRef.current = finishCurve;

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setViewport((prev) => zoomViewport(prev, localPoint(e), e.deltaY > 0 ? 1.1 : 0.9));
  };


  // 角度草稿预览：只定了顶点时显示一个点，定了一条边后实时预览角度
  const anglePreview: Shape | null = (() => {
    if (tool !== "angle" || !angleDraft || angleDraft.tool !== tool) return null;
    const v0 = angleDraft.v;
    if (!angleDraft.arm1) return { id: "preview-angle-v", type: "point", x: v0.x, y: v0.y, color };
    const end = drag.kind === "angleArm2" ? drag.current : hoverWorld;
    if (!end) return null;
    return createAngle(v0, angleDraft.arm1, end, color, options.specialAngleSnap).shape;
  })();

  // 拖动绘制/笔迹的实时预览
  const previewShape: Shape | null = anglePreview ?? (
    drag.kind === "draw"
      ? createPrimitiveByDrag(placeType, drag.start, drag.raw, color, placeSides)
      : drag.kind === "curve"
        ? ({ id: "preview-curve", type: "ink", points: drag.points, color, width: penWidth, smooth: true } as Shape)
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
        {/* 曲线草稿：锚点 + 切线手柄实时预览（钢笔手感的关键反馈） */}
        {drag.kind === "curve" ? (
          <CurveDraft points={drag.points} tangents={drag.tangents} viewport={v} color={color} />
        ) : null}
        {/* 图片锁定徽标：点击切换橡皮保护 */}        <ShapeLayer
          shapes={shapes}
          viewport={v}
          highlightId={selectedId}
          selectionIds={selectionIds}
          lassoPoints={drag.kind === "lasso" ? drag.points : null}
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
});
