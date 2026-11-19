/** 图形的一句话描述（图形列表与批注文本共用） */
import type { Shape } from "./types";

export function describeShape(s: Shape): string {
  switch (s.type) {
    case "coord": return "坐标系";
    case "circle": return s.source ? `圆 ${s.source}` : `圆 (${s.cx.toFixed(1)},${s.cy.toFixed(1)}) r=${s.r.toFixed(1)}`;
    case "ellipse": return `椭圆 (${s.cx.toFixed(1)},${s.cy.toFixed(1)}) a=${s.rx.toFixed(1)} b=${s.ry.toFixed(1)}`;
    case "arc": return `圆弧 r=${s.r.toFixed(1)} ${(s.startAngle * 180 / Math.PI).toFixed(0)}°~${(s.endAngle * 180 / Math.PI).toFixed(0)}°`;
    case "rect": return `矩形 (${s.x1.toFixed(1)},${s.y1.toFixed(1)})→(${s.x2.toFixed(1)},${s.y2.toFixed(1)})`;
    case "polygon": return `${s.sides}边形 r=${s.r.toFixed(1)}`;
    case "ray": return `射线 (${s.x1.toFixed(1)},${s.y1.toFixed(1)})→`;
    case "function": return `f(x) = ${s.expr}`;
    case "parametric": return `x=${s.xExpr}, y=${s.yExpr}`;
    case "point": return `点 (${s.x.toFixed(1)},${s.y.toFixed(1)})`;
    case "line": return "线段";
    case "ink": return `笔迹（${s.points.length} 点）`;
    case "poly": {
      const labels = { star: "星形", rhombus: "菱形", trapezoid: "梯形", arrow: "箭头" } as const;
      return labels[s.kind];
    }
    case "angle": {
      const a = Math.abs(((s.a2 - s.a1) * 180) / Math.PI);
      const deg = a > 180 ? 360 - a : a;
      return `角 ${deg.toFixed(1)}°`;
    }
    case "solid": return `立体模型 ${s.kind}`;
    default: return "图形";
  }
}

/** 批注正文：整份草图清单（写入卡片用）——分组结构化，函数带可复现公式 */
export function buildSketchReport(shapes: Shape[]): string {
  const total = shapes.filter((s) => s.type !== "coord").length;
  const lines: string[] = [`【Euclid Sketch 草图 · 共 ${total} 项】`];

  const section = (title: string, items: string[]) => {
    if (items.length === 0) return;
    lines.push("", `〔${title}〕`, ...items.map((t, i) => `${i + 1}. ${t}`));
  };

  const fns: string[] = [];
  const geos: string[] = [];
  const imgs: string[] = [];
  const inks: string[] = [];
  const solids: string[] = [];
  for (const s of shapes) {
    if (s.type === "coord") continue;
    if (s.type === "function") {
      fns.push(`f(x) = ${s.source || s.expr}（可在插件函数面板复现）`);
    } else if (s.type === "parametric") {
      fns.push(`参数方程 x=${s.xExpr}, y=${s.yExpr}`);
    } else if (s.type === "image") {
      imgs.push(`题目/素材底图（${Math.round(s.w)}×${Math.round(s.h)} 世界单位${s.locked ? "，已锁定" : ""}）`);
    } else if (s.type === "ink") {
      inks.push(`手写笔迹（${s.points.length} 个采样点）`);
    } else if (s.type === "solid") {
      solids.push(`${describeShape(s)} ${JSON.stringify(s.params)}`);
    } else {
      geos.push(describeShape(s));
    }
  }
  section("函数曲线（可在插件中复现）", fns);
  section("几何图形", geos);
  section("图片", imgs);
  section("手写笔迹", inks);
  section("立体模型", solids);

  lines.push("", "草图配图：请用插件「导出 PNG」保存，再在 MN 里作为图片或子卡插图插入。");
  return lines.join("\n");
}
