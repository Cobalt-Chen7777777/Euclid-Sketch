/**
 * 设置备份：把当前设置导成一段 JSON，重装插件后粘回来即可恢复。
 *
 * 为什么需要这个：场景插件的设置只能存在面板的 localStorage 里，
 * 而覆盖安装时宿主可能清掉这份存储（我们无法阻止），所以给一条手动备份通道。
 */
import { useState } from "react";

import { normalizeSettings, type SketchSettings } from "./model";

interface Props {
  settings: SketchSettings;
  onChange: (next: SketchSettings) => void;
}

export function SettingsBackup({ settings, onChange }: Props) {
  const [text, setText] = useState("");
  const [msg, setMsg] = useState("");

  const exportJson = () => {
    setText(JSON.stringify(settings));
    setMsg("已生成，长按文本框全选复制，自己存一份");
  };

  const importJson = () => {
    if (!text.trim()) {
      setMsg("先把备份内容粘进文本框");
      return;
    }
    try {
      onChange(normalizeSettings(JSON.parse(text)));
      setMsg("已导入");
    } catch {
      setMsg("这段内容不是有效的设置备份");
    }
  };

  return (
    <div className="set-row">
      <span className="set-tile"><span className="set-emoji">⤓</span></span>
      <span className="set-text">
        <b>设置备份</b>
        <small>覆盖安装会重置设置，可先导出这段文字存起来，装好再粘回来导入</small>
        <span className="chips">
          <button type="button" className="chip" onClick={exportJson}>导出当前设置</button>
          <button type="button" className="chip" onClick={importJson}>从文本导入</button>
        </span>
        <textarea
          className="set-backup-area"
          value={text}
          placeholder="点「导出当前设置」生成备份；恢复时把内容粘到这里再点「从文本导入」"
          onChange={(e) => setText(e.target.value)}
        />
        {msg ? <small className="cache-msg">{msg}</small> : null}
      </span>
    </div>
  );
}
