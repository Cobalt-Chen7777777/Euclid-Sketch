/**
 * 撤销 / 重做按钮组：与模式切换同排，随历史栈禁用。
 */
interface Props {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

export function HistoryButtons({ canUndo, canRedo, onUndo, onRedo }: Props) {
  return (
    <div className="hist-btns">
      <button type="button" className="hist-btn" disabled={!canUndo} onClick={onUndo}
        aria-label="撤销上一步" title="撤销（Ctrl+Z）">↶</button>
      <button type="button" className="hist-btn" disabled={!canRedo} onClick={onRedo}
        aria-label="重做下一步" title="重做（Ctrl+Shift+Z）">↷</button>
    </div>
  );
}
