/**
 * 隐藏的文件选择入口：JSON 文档导入 + 本地图片导入。
 * 由设置页 / 选项抽屉里的按钮触发 click，选择结果回传给 App。
 */
import type { ReactNode } from "react";

interface Props {
  jsonInputRef: React.RefObject<HTMLInputElement | null>;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  onJsonFile: (file: File) => void;
  /** 图片可多选：按顺序回调，第二个参数是本批序号（0 起） */
  onImageFile: (file: File, index: number) => void;
}

export function HiddenFileInputs({ jsonInputRef, imageInputRef, onJsonFile, onImageFile }: Props): ReactNode {
  return (
    <>
      <input
        ref={jsonInputRef} type="file" accept="application/json,.json" hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onJsonFile(f);
          e.target.value = "";
        }}
      />
      <input
        ref={imageInputRef} type="file" accept="image/*" multiple hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          files.forEach((f, i) => onImageFile(f, i));
          e.target.value = "";
        }}
      />
    </>
  );
}
