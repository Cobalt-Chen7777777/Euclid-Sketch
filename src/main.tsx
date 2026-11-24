import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { installLogHooks } from "./debug/log";
import "./app.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("index.html 缺少 #root 挂载点");
}

/**
 * 主题宿主：只负责读「系统/MN 当前是不是深色」并往下传。
 * 真正的主题解析在 App 里（跟着设置走），样式只认 <main> 上的 class，
 * 全程不写 DOM 属性——脚手架不允许入口和组件直接改 document。
 */
function ThemeHost() {
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const mnTheme = typeof mn !== "undefined" ? mn.theme : null;
  return <App systemDark={systemDark} mnTheme={mnTheme} />;
}

installLogHooks();
createRoot(root).render(<ThemeHost />);
