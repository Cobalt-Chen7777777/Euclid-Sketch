/**
 * 套索框选操作条：有选中时提供 复制/剪切/删除；
 * 剪贴板非空时保留「粘贴」——剪切或删除后选择清空，但内容仍可贴回。
 */
interface Props {
  count: number;
  clipCount: number;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onClear: () => void;
}

export function LassoBar({ count, clipCount, onCopy, onCut, onPaste, onDelete, onClear }: Props) {
  if (count === 0 && clipCount === 0) return null;
  return (
    <div className="lasso-bar" role="toolbar" aria-label="框选操作">
      <span className="lasso-count">{count > 0 ? `已选 ${count}` : `剪贴板 ${clipCount} 条`}</span>
      {count > 0 ? (
        <>
          <button type="button" onClick={onCopy}>复制</button>
          <button type="button" onClick={onCut}>剪切</button>
          <button type="button" className="danger" onClick={onDelete}>删除</button>
          <button type="button" onClick={onClear}>取消</button>
        </>
      ) : null}
      {clipCount > 0 ? (
        <button type="button" onClick={onPaste}>粘贴</button>
      ) : null}
    </div>
  );
}
