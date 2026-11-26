/**
 * 从剪贴板插图：WebView 里 navigator.clipboard.read() 经常被拒（需要权限且部分宿主不给），
 * 所以留一条系统粘贴的后路——给一个真的可长按的输入框，用户在系统菜单里点「粘贴」，
 * 我们只从 paste 事件的 clipboardData 里取图片。
 */
interface Props {
  open: boolean;
  onClose: () => void;
  onImage: (file: File) => void;
}

export function PasteImageSheet({ open, onClose, onImage }: Props) {
  if (!open) return null;

  return (
    <div className="paste-mask" onClick={onClose}>
      <div className="paste-panel" onClick={(e) => e.stopPropagation()}>
        <b>从剪贴板插入</b>
        <p className="paste-hint">先在别处复制一张图片，然后在下面的框里<b>长按 →「粘贴」</b></p>
        <textarea
          className="paste-area"
          placeholder="在此长按 → 粘贴"
          autoFocus
          onPaste={(e) => {
            const items = e.clipboardData?.items ?? [];
            for (const item of items) {
              if (item.type.startsWith("image/")) {
                const file = item.getAsFile();
                if (file) {
                  e.preventDefault();
                  onImage(file);
                  return;
                }
              }
            }
            // 剪贴板里没有图片：不拦，让文字照常落进框里，用户能看出粘贴成功但没图
          }}
        />
        <div className="paste-actions">
          <button type="button" className="chip" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  );
}
