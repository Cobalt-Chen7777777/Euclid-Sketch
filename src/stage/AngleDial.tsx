/* eslint-disable no-restricted-globals, no-restricted-syntax -- 拖动时要挂 window 级 pointermove，指针角度是运行时数值只能用内联 style */
/**
 * 角度旋钮：一个小圆盘，指针指向当前角度，按住拖一圈就是自由调角度。
 * 比滑杆直观（能直接看到朝向），也比 ±15° 按钮灵活。
 */
import { useCallback, useEffect, useRef } from "react";

import { blockHostTouch } from "../touchGuard";

interface Props {
  /** 当前角度（度，0–360，顺时针为正） */
  deg: number;
  onChange: (deg: number) => void;
  /** 无障碍标签 */
  label?: string;
}

export function AngleDial({ deg, onChange, label = "旋转角度" }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);

  const apply = useCallback((clientX: number, clientY: number) => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    // 屏幕坐标 y 向下：atan2 正好是「顺时针为正」
    let a = (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
    if (a < 0) a += 360;
    onChange(Math.round(a));
  }, [onChange]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!drag.current) return;
      e.preventDefault();
      apply(e.clientX, e.clientY);
    };
    const up = () => { drag.current = false; cleanup.current?.(); cleanup.current = null; };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [apply]);

  const start = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // 拦住宿主手势：否则拖旋钮时面板会跟着走
    cleanup.current?.();
    cleanup.current = blockHostTouch(e.currentTarget);
    drag.current = true;
    apply(e.clientX, e.clientY);
  };

  return (
    <div
      ref={box}
      className="angle-dial"
      role="slider"
      aria-label={label}
      aria-valuenow={Math.round(deg)}
      aria-valuemin={0}
      aria-valuemax={360}
      tabIndex={0}
      onPointerDown={start}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onChange((Math.round(deg) - 5 + 360) % 360); }
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onChange((Math.round(deg) + 5) % 360); }
      }}
    >
      <span className="angle-dial-needle" style={{ transform: `rotate(${deg}deg)` }} />
      <span className="angle-dial-pin" />
    </div>
  );
}
