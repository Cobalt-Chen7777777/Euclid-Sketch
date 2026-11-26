/**
 * 卡片图选区裁剪。
 *
 * MN 的渲染接口只能出整张长图（参数只有 format / width），「只插入题目区」
 * 只能拿到图之后在本地区域裁剪，所以这里提供一个可拖动的选区框。
 *
 * 交互：默认给一个接近全图的框，拖框内部移动、拖四角改大小；点「整张插入」跳过裁剪。
 */
/* eslint-disable no-restricted-globals, no-restricted-syntax -- 拖框要挂 window 级 pointermove；选区位置是运行时数值，只能用动态 style */
import { useCallback, useEffect, useRef, useState } from "react";

import { blockHostTouch } from "../touchGuard";

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Props {
  src: string;
  onCancel: () => void;
  /** rect 为 null 表示整张插入；坐标是图片的自然像素 */
  onConfirm: (rect: CropRect | null) => void;
}

type DragKind = "move" | "nw" | "ne" | "sw" | "se" | null;

const MIN = 24;

export function CropDialog({ src, onCancel, onConfirm }: Props) {
  const imgRef = useRef<HTMLImageElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  /** 图片在屏幕上的实际显示区域（contain 之后的尺寸） */
  const [view, setView] = useState<{ w: number; h: number } | null>(null);
  /** 选区：0~1 的相对坐标，跟显示尺寸解耦 */
  const [rect, setRect] = useState({ x: 0.06, y: 0.06, w: 0.88, h: 0.88 });
  const drag = useRef<{ kind: DragKind; px: number; py: number; start: typeof rect } | null>(null);

  useEffect(() => {
    const onResize = () => {
      const el = imgRef.current;
      if (el && el.clientWidth > 0) setView({ w: el.clientWidth, h: el.clientHeight });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [src]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      const v = view;
      if (!d || !v) return;
      const dx = (e.clientX - d.px) / v.w;
      const dy = (e.clientY - d.py) / v.h;
      const s = d.start;
      const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
      let next = { ...s };
      if (d.kind === "move") {
        next.x = clamp01(Math.min(s.x + dx, 1 - s.w));
        next.y = clamp01(Math.min(s.y + dy, 1 - s.h));
      } else {
        const minW = MIN / v.w;
        const minH = MIN / v.h;
        let { x, y, w, h } = s;
        if (d.kind === "nw" || d.kind === "sw") {
          const nx = clamp01(Math.min(x + dx, x + w - minW));
          w = w + (x - nx);
          x = nx;
        }
        if (d.kind === "ne" || d.kind === "se") {
          w = Math.max(minW, Math.min(w + dx, 1 - x));
        }
        if (d.kind === "nw" || d.kind === "ne") {
          const ny = clamp01(Math.min(y + dy, y + h - minH));
          h = h + (y - ny);
          y = ny;
        }
        if (d.kind === "sw" || d.kind === "se") {
          h = Math.max(minH, Math.min(h + dy, 1 - y));
        }
        next = { x, y, w, h };
      }
      setRect(next);
    };
    const up = () => { drag.current = null; touchCleanup.current?.(); touchCleanup.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [view]);

  const touchCleanup = useRef<(() => void) | null>(null);
  const start = useCallback((kind: DragKind) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 拦住宿主原生手势：否则拖选区时面板会跟着走
    touchCleanup.current?.();
    touchCleanup.current = blockHostTouch(e.currentTarget as HTMLElement);
    drag.current = { kind, px: e.clientX, py: e.clientY, start: rect };
  }, [rect]);

  const confirm = () => {
    const img = imgRef.current;
    const nw = img?.naturalWidth ?? 0;
    const nh = img?.naturalHeight ?? 0;
    if (!nw || !nh) return onConfirm(null);
    onConfirm({
      x: Math.round(rect.x * nw),
      y: Math.round(rect.y * nh),
      w: Math.max(1, Math.round(rect.w * nw)),
      h: Math.max(1, Math.round(rect.h * nh)),
    });
  };

  return (
    <div className="crop-mask" onClick={onCancel}>
      <div className="crop-panel" onClick={(e) => e.stopPropagation()}>
        <div className="crop-head">
          <b>选择要插入的部分</b>
          <span className="crop-hint">拖动框选题目区；不要裁剪就点「整张插入」</span>
        </div>

        <div className="crop-stage" ref={boxRef}>
          <img
            ref={imgRef}
            src={src}
            alt="卡片长图"
            className="crop-img"
            onLoad={(e) => {
              const el = e.currentTarget;
              setView({ w: el.clientWidth, h: el.clientHeight });
            }}
          />
          {view ? (
            <div
              className="crop-box"
              style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }}
              onPointerDown={start("move")}
            >
              <span className="crop-h crop-nw" onPointerDown={start("nw")} />
              <span className="crop-h crop-ne" onPointerDown={start("ne")} />
              <span className="crop-h crop-sw" onPointerDown={start("sw")} />
              <span className="crop-h crop-se" onPointerDown={start("se")} />
            </div>
          ) : null}
        </div>

        <div className="crop-actions">
          <button type="button" className="chip" onClick={onCancel}>取消</button>
          <span className="crop-spacer" />
          <button type="button" className="chip" onClick={() => onConfirm(null)}>整张插入</button>
          <button type="button" className="chip primary" onClick={confirm}>插入选区</button>
        </div>
      </div>
    </div>
  );
}
