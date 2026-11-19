/**
 * 文档文件解析与导出构造。
 * 抛出的错误信息直接面向用户（导入失败的 toast）。
 */
import type { Viewport } from "../canvas/viewport";
import type { SketchDocument } from "../model/types";

export function readDocumentFile(file: File): Promise<SketchDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as SketchDocument;
        if (!parsed || !Array.isArray(parsed.shapes)) throw new Error("格式不正确");
        resolve(parsed);
      } catch (e) {
        reject(e instanceof Error ? e : new Error("无法解析该文件"));
      }
    };
    reader.onerror = () => reject(new Error("文件读取失败"));
    reader.readAsText(file);
  });
}

/** 导出前合成文档：坐标系网格用当前设置，视图区间用画布实际区间 */
export function toExportDoc(doc: SketchDocument, viewport: Viewport, gridStep: number): SketchDocument {
  return {
    ...doc,
    shapes: doc.shapes.map((s) => (s.type === "coord" ? { ...s, grid: gridStep } : s)),
    view: {
      xRange: viewport.xRange,
      yRange: viewport.yRange,
      grid: gridStep,
    },
  };
}
