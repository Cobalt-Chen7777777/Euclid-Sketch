/**
 * 复制草图到剪贴板（含失败降级）。
 *
 * Safari/WKWebView 要求 clipboard.write 在用户手势的同步栈内调用：
 * 因此点击当下就发起渲染 Promise，并立刻把 Blob Promise 交给 ClipboardItem，
 * 全程不 await——否则大草图渲染超过激活窗口会抛 NotAllowedError。
 */
import { useCallback, useState } from "react";

import { copyImageToClipboard, dataUrlToBlob, renderExportDataUrl } from "./export/image";

export interface PreviewState {
  src: string;
  reason: string | undefined;
}

export function useCopySketch(
  tab: string,
  captureRef: React.RefObject<(() => string) | null>,
  svgRef: React.RefObject<SVGSVGElement | null>,
  onResult: (ok: boolean) => void,
) {
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const copy = useCallback(() => {
    const dataUrlPromise = renderExportDataUrl(tab, captureRef.current, svgRef.current).then((r) => r.dataUrl);
    void copyImageToClipboard(dataUrlPromise.then(dataUrlToBlob)).then(async (res) => {
      if (res.ok) {
        onResult(true);
        return;
      }
      onResult(false);
      try {
        setPreview({ src: await dataUrlPromise, reason: res.reason });
      } catch {
        setPreview(null);
      }
    });
  }, [tab, captureRef, svgRef, onResult]);

  return { preview, copy, closePreview: () => setPreview(null) };
}
