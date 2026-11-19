/* eslint-disable no-restricted-globals, no-restricted-syntax -- 图片导出需要命令式 canvas 光栅化与下载 */
/** 导出工具：SVG / 3D canvas → PNG Blob / dataURL */
import type { SketchDocument } from "../model/types";

/** 把内联 <svg> 序列化为独立 SVG 字符串（带背景与字体） */
export function svgToDataURL(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  const xml = new XMLSerializer().serializeToString(clone);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

/** SVG dataURL → PNG dataURL（经 canvas 光栅化） */
export function svgToPng(svgDataUrl: string, scale = 2): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("无法获取 canvas 上下文"));
      ctx.fillStyle = "#fffdf8";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("SVG 转图片失败"));
    img.src = svgDataUrl;
  });
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const head = parts[0] ?? "";
  const body = parts[1] ?? "";
  const mime = head.match(/:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(body ?? "");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 导出模型 JSON 文件 */
export function downloadDocument(doc: SketchDocument, filename = "sketch.json"): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
  downloadBlob(blob, filename);
}

/** 渲染当前页面的导出图：3D 用抓帧回调，2D 用 SVG 转栅格 */
export async function renderExportDataUrl(
  tab: string,
  capture: (() => string) | null,
  svg: SVGSVGElement | null,
): Promise<{ dataUrl: string; name: string }> {
  if (tab === "3d" && capture) return { dataUrl: capture(), name: "solid-model.png" };
  if (svg) return { dataUrl: await svgToPng(svgToDataURL(svg), 2), name: "math-sketch.png" };
  throw new Error("没有可导出的画布");
}
