/**
 * 调试区：版本号连点 5 次开关调试模式；开启后显示本机诊断日志。
 * 独立成文件是为了不让 SettingsPage.tsx 继续膨胀（已接近 500 行上限）。
 */
import { useEffect, useRef, useState } from "react";

import { clearLogs, exportLogs, logCount, recentLogs, logEvent } from "../debug/log";
import { ChevronIcon, InfoIcon } from "../icons";

interface Props {
  version: string;
  debug: boolean;
  onChangeDebug: (v: boolean) => void;
}

export function DebugSection({ version, debug, onChangeDebug }: Props) {
  const hits = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);
  const [liveCount, setLiveCount] = useState(() => logCount());
  const [recent, setRecent] = useState<string[]>(() => recentLogs(5));
  // 调试模式打开时每秒刷一次条数，否则「当前 0 条」会一直是 0
  useEffect(() => {
    if (!debug) return;
    const t = setInterval(() => { setLiveCount(logCount()); setRecent(recentLogs(5)); }, 1000);
    return () => clearInterval(t);
  }, [debug]);

  // 打开诊断时记一条，确认写入通道是通的（否则「0 条」分不清是没日志还是没埋点）
  useEffect(() => {
    if (debug) logEvent("debug", "打开诊断面板");
  }, [debug]);

  /** 1.2 秒内连点 5 次切换调试模式 */
  const tapVersion = () => {
    hits.current += 1;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { hits.current = 0; }, 1200);
    if (hits.current >= 5) {
      hits.current = 0;
      onChangeDebug(!debug);
    }
  };

  const copyLogs = async () => {
    const text = exportLogs();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <div className="set-row tappable" onClick={tapVersion}>
        <span className="set-tile"><InfoIcon /></span>
        <span className="set-text">
          <b>版本 {version}</b>
          <small>{debug ? "调试模式已开启 · 连点 5 次可关闭" : "连点 5 次开启调试模式"}</small>
        </span>
      </div>

      {debug ? (
        <>
          <div className="set-row tappable" onClick={() => { void copyLogs(); }}>
            <span className="set-tile"><InfoIcon /></span>
            <span className="set-text">
              <b>{copied ? "已复制到剪贴板" : "复制诊断日志"}</b>
              <small>当前 {liveCount} 条 · 含错误、警告与关键操作</small>
            </span>
            <span className="set-trail"><span className="set-chevron"><ChevronIcon /></span></span>
          </div>
          {recent.length > 0 ? (
            <div className="set-row">
              <span className="set-tile"><InfoIcon /></span>
              <span className="set-text">
                <b>最近 {recent.length} 条</b>
                <small className="debug-recent">{recent.join(" ｜ ")}</small>
              </span>
            </div>
          ) : null}
          <div className="set-row tappable" onClick={() => { clearLogs(); setCopied(false); }}>
            <span className="set-tile"><InfoIcon /></span>
            <span className="set-text">
              <b className="danger">清空日志</b>
              <small>只清本机记录，不影响画布内容</small>
            </span>
          </div>
        </>
      ) : null}
    </>
  );
}
