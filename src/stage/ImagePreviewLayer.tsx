/**
 * 复制失败时的降级层：全屏展示草图大图，提示长按保存/拷贝。
 * iOS 长按图片自带「拷贝照片 / 存储到照片」，不依赖 Clipboard API。
 */
interface Props {
  src: string | null;
  reason: string | undefined;
  onClose: () => void;
  onExport: () => void;
}

const REASON_TEXT: Record<string, string> = {
  "clipboard-unavailable": "当前环境不支持剪贴板写入（系统版本偏低，或面板不在安全上下文）",
  NotAllowedError: "系统未允许写入剪贴板（可能手势已过期或需先允许一次粘贴）",
  SecurityError: "安全策略拦截了剪贴板写入",
};

export function ImagePreviewLayer({ src, reason, onClose, onExport }: Props) {
  if (!src) return null;
  const hint = (reason && REASON_TEXT[reason]) ?? (reason ? `剪贴板错误：${reason}` : "剪贴板不可用");
  return (
    <div className="preview-layer" role="dialog" aria-modal="true" aria-label="草图预览">
      <div className="preview-body">
        <img src={src} alt="草图" className="preview-img" />
        <p className="preview-hint">长按图片 →「拷贝」或「存储到照片」，再回卡片批注粘贴</p>
        <p className="preview-reason">{hint}</p>
      </div>
      <div className="preview-actions">
        <button type="button" className="chip" onClick={onExport}>导出 PNG</button>
        <button type="button" className="chip primary" onClick={onClose}>关闭</button>
      </div>
    </div>
  );
}
