/* eslint-disable no-restricted-globals, no-restricted-syntax -- 图片导出需要命令式 canvas 光栅化与下载 */
/** 导出工具：SVG / 3D canvas → PNG Blob / dataURL */
import type { SketchDocument } from "../model/types";

/** 把 SVG 里 blob: 的 <image> 换成内联 dataURL（序列化后 blob 链接会失效） */
async function inlineBlobImages(svg: SVGSVGElement): Promise<SVGSVGElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const imgs = [...clone.querySelectorAll("image")];
  for (const el of imgs) {
    const href = el.getAttribute("href") ?? el.getAttributeNS("http://www.w3.org/1999/xlink", "href") ?? "";
    if (!href.startsWith("blob:")) continue;
    try {
      const blob = await (await fetch(href)).blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("图片读取失败"));
        reader.readAsDataURL(blob);
      });
      el.setAttribute("href", dataUrl);
      el.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", dataUrl);
    } catch {
      /* 单张图读不出来就不内联，别的照常导出 */
    }
  }
  return clone;
}

/** 把内联 <svg> 序列化为独立 SVG 字符串（带背景与字体） */
export function svgToDataURL(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  // 画布 svg 只有 viewBox、尺寸靠 CSS，序列化后没有 width/height ——
  // 这样 Image 会按默认的 300×150 栅格化，导出/复制到卡片就是糊的。这里补上真实尺寸。
  // 传进来的可能是已经克隆出来、还没挂到文档上的节点（getBoundingClientRect 恒为 0），
  // 这时退回 viewBox 的宽高，同样是画布的真实尺寸
  const box = svg.getBoundingClientRect();
  let w = Math.round(box.width);
  let h = Math.round(box.height);
  if (!(w > 0 && h > 0)) {
    const vb = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
    if (vb.length === 4 && vb[2]! > 0 && vb[3]! > 0) { w = Math.round(vb[2]!); h = Math.round(vb[3]!); }
  }
  if (w > 0 && h > 0) {
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
  }
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
  // 按长边目标像素决定倍率：插进卡片后是按原图像素显示的，
  // 之前固定 2× 只有面板那么大（~800px），放大就糊；这里保证长边至少 2400px
  if (svg) {
    const inlined = await inlineBlobImages(svg);
    const box = svg.getBoundingClientRect();
    const long = Math.max(box.width, box.height) || 800;
    const scale = Math.min(4, Math.max(2, 2400 / long));
    return { dataUrl: await svgToPng(svgToDataURL(inlined), scale), name: "math-sketch.png" };
  }
  throw new Error("没有可导出的画布");
}

/** 把图片 dataURL 写入剪贴板（用于直接粘贴进 MN 批注/卡片）；失败返回 false */
export async function copyImageToClipboard(
  blobPromise: Promise<Blob>,
): Promise<{ ok: boolean; reason: string | undefined }> {
  if (typeof navigator.clipboard?.write !== "function" || typeof ClipboardItem === "undefined") {
    return { ok: false, reason: "clipboard-unavailable" };
  }
  try {
    // 不做任何 await：保持用户手势有效（ClipboardItem 支持 Promise 值）
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
    return { ok: true, reason: undefined };
  } catch (e) {
    const reason = e instanceof DOMException ? e.name : e instanceof Error ? e.message : String(e);
    return { ok: false, reason };
  }
}
