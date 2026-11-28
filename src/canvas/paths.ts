/** 把点序列转成 SVG path 的几种写法（曲线/笔迹/隐函数共用） */
import { toScreen, type Viewport } from "./viewport";

/** 折线；breakOnJump 时，屏幕上纵向跳变超过半个画布就断开（渐近线处不拉竖线） */
export function pathFromPoints(points: { x: number; y: number }[], v: Viewport, breakOnJump = false): string {
  if (points.length === 0) return "";
  const jump = breakOnJump ? v.height * 0.9 : Number.POSITIVE_INFINITY;
  const narrowX = v.width * 0.02; // 只有「x 几乎没动、y 却飞了」才算渐近线，真正的陡坡不该断
  let d = "";
  let penDown = false;
  let prevY = Number.NaN;
  let prevX = Number.NaN;
  for (const p of points) {
    const s = toScreen(p, v);
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y)) { penDown = false; continue; }
    const tooFar = penDown && Number.isFinite(prevY) && Math.abs(s.y - prevY) > jump
      && Math.abs(s.x - prevX) < narrowX;
    d += `${penDown && !tooFar ? "L" : "M"}${s.x.toFixed(1)},${s.y.toFixed(1)} `;
    penDown = true;
    prevY = s.y;
    prevX = s.x;
  }
  return d.trim();
}

/** 手写笔迹：以采样点为控制点、相邻点中点为端点画二次贝塞尔（不会过冲） */
export function pathSmoothThrough(points: { x: number; y: number }[], v: Viewport): string {
  if (points.length === 0) return "";
  const sp = points.map((p) => toScreen(p, v)).filter((s) => Number.isFinite(s.x) && Number.isFinite(s.y));
  if (sp.length === 0) return "";
  if (sp.length === 1) return `M${sp[0]!.x.toFixed(1)},${sp[0]!.y.toFixed(1)}`;
  let d = `M${sp[0]!.x.toFixed(1)},${sp[0]!.y.toFixed(1)}`;
  for (let i = 1; i < sp.length - 1; i += 1) {
    const cur = sp[i]!;
    const next = sp[i + 1]!;
    d += ` Q${cur.x.toFixed(1)},${cur.y.toFixed(1)} ${((cur.x + next.x) / 2).toFixed(1)},${((cur.y + next.y) / 2).toFixed(1)}`;
  }
  const last = sp[sp.length - 1]!;
  return `${d} L${last.x.toFixed(1)},${last.y.toFixed(1)}`;
}
