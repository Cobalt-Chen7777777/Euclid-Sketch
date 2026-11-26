/**
 * 从剪贴板插入图片：先走 navigator.clipboard.read()（有权限时一步到位），
 * 宿主拒绝时退到系统粘贴面板（PasteImageSheet），那条路不依赖 Clipboard API。
 */
import { useCallback, useState } from "react";

interface Options {
  onFile: (file: File) => void;
  showToast: (msg: string) => void;
}

export function useClipboardImage({ onFile, showToast }: Options) {
  const [pasteOpen, setPasteOpen] = useState(false);

  const onInsertClipboardImage = useCallback(async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith("image/"));
        if (!type) continue;
        const blob = await item.getType(type);
        onFile(new File([blob], "clipboard.png", { type }));
        return;
      }
      showToast("剪贴板里没有图片，先复制一张再试");
    } catch {
      // 大多数 WebView 会走到这里：换成系统粘贴面板
      setPasteOpen(true);
    }
  }, [onFile, showToast]);

  return { pasteOpen, setPasteOpen, onInsertClipboardImage };
}
