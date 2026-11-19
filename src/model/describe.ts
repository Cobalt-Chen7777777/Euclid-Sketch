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

/** 批注正文：整份构图清单（写入卡片用） */
export function buildSketchReport(shapes: Shape[]): string {
  const summaries = shapes
    .filter((s) => s.type !== "coord")
    .map((s) => (s.type === "solid" ? `立体模型：${s.kind} ${JSON.stringify(s.params)}` : describeShape(s)));
  return `【数学模型构图】\n${summaries.join("\n") || "（空）"}\n\n配图请从相册/文件手动插入已导出的 PNG。`;
}
