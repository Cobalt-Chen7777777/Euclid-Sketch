/**
 * 图形历史栈：撤销 / 重做。
 *
 * 设计要点：
 * - past 存「每次变更前」的快照；redo 存撤销时被替换的状态。
 * - 连续变更合并：间隔 < MERGE_MS 的多次 setShapes 只共享同一条历史
 *   （控制点拖动是逐帧 setShapes，必须合并，否则拖一下就是几十步撤销）。
 * - 快照只存数组引用（形状对象不可变），内存开销极小；上限 60 步。
 * - canUndo / canRedo 用 state 暴露，供按钮禁用态渲染。
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { Shape } from "./model/types";

const MERGE_MS = 700;
const MAX_STEPS = 150;

interface HistoryApi {
  /** 包装后的 setShapes：所有会改图形的操作都走它 */
  commit: React.Dispatch<React.SetStateAction<Shape[]>>;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** 还能回退多少步 */
  historySteps: number;
  /** 一次回退 n 步（历史面板用） */
  jumpBack: (n: number) => void;
  /** 历史摘要：步号 + 该步的图形数量（供弹窗列表展示） */
  historyList: { step: number; count: number }[];
}

export function useHistoryShapes(
  shapes: Shape[],
  rawSetShapes: React.Dispatch<React.SetStateAction<Shape[]>>,
): HistoryApi {
  const pastRef = useRef<Shape[][]>([]);
  const futureRef = useRef<Shape[][]>([]);
  const lastCommitRef = useRef(0);
  // 锁定：undo/redo 本身产生的变更不能再次入栈
  const lockedRef = useRef(false);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [historySteps, setHistorySteps] = useState(0);
  const [historyList, setHistoryList] = useState<{ step: number; count: number }[]>([]);

  // shapesRef 始终指向最新数组，commit 时不依赖渲染时序
  const shapesRef = useRef(shapes);
  useEffect(() => { shapesRef.current = shapes; }, [shapes]);

  const syncFlags = useCallback(() => {
    setCanUndo(pastRef.current.length > 0);
    setCanRedo(futureRef.current.length > 0);
    setHistorySteps(pastRef.current.length);
    setHistoryList(pastRef.current.map((snap, i) => ({ step: i + 1, count: snap.length })));
  }, []);

  const commit = useCallback<React.Dispatch<React.SetStateAction<Shape[]>>>((updater) => {
    if (lockedRef.current) {
      // 撤销/重做回放：直接应用，不再记录
      lockedRef.current = false;
      rawSetShapes(updater);
      return;
    }
    const before = shapesRef.current;
    const now = Date.now();
    const nextLen = typeof updater === "function" ? updater(before).length : updater.length;
    // 增删图形属于结构性操作：不参与合并，否则连点几次只留一步
    const structural = nextLen !== before.length;
    if (structural || now - lastCommitRef.current > MERGE_MS) {
      pastRef.current = [...pastRef.current.slice(-(MAX_STEPS - 1)), before];
      futureRef.current = [];
    }
    lastCommitRef.current = now;
    syncFlags();
    rawSetShapes(updater);
  }, [rawSetShapes, syncFlags]);

  const undo = useCallback(() => {
    const past = pastRef.current;
    const prev = past[past.length - 1];
    if (!prev) return;
    pastRef.current = past.slice(0, -1);
    futureRef.current = [...futureRef.current, shapesRef.current];
    lastCommitRef.current = 0; // 下一次编辑总是新条目
    lockedRef.current = true;
    syncFlags();
    rawSetShapes(prev);
  }, [rawSetShapes, syncFlags]);

  const redo = useCallback(() => {
    const future = futureRef.current;
    const next = future[future.length - 1];
    if (!next) return;
    futureRef.current = future.slice(0, -1);
    pastRef.current = [...pastRef.current, shapesRef.current];
    lastCommitRef.current = 0;
    lockedRef.current = true;
    syncFlags();
    rawSetShapes(next);
  }, [rawSetShapes, syncFlags]);

  /** 一次回退 n 步：直接裁剪栈，避免连续 undo 因 ref 时序重复入栈 */
  const jumpBack = useCallback((n: number) => {
    const past = pastRef.current;
    if (past.length === 0 || n <= 0) return;
    const k = Math.min(n, past.length);
    const target = past[past.length - k];
    if (!target) return;
    futureRef.current = [...futureRef.current, ...past.slice(past.length - k + 1), shapesRef.current];
    pastRef.current = past.slice(0, past.length - k);
    lastCommitRef.current = 0;
    lockedRef.current = true;
    syncFlags();
    rawSetShapes(target);
  }, [rawSetShapes, syncFlags]);

  return { commit, undo, redo, canUndo, canRedo, historySteps, jumpBack, historyList };
}

/**
 * 撤销/重做快捷键：Ctrl/Cmd+Z、Ctrl/Cmd+Shift+Z、Ctrl+Y。
 * 监听挂在面板根元素上（脚手架禁止访问 window/document；
 * 面板是顶层文档，根元素能收到所有冒泡的键盘事件）。
 */
export function useUndoHotkeys(
  rootRef: React.RefObject<HTMLElement | null>,
  undo: () => void,
  redo: () => void,
): void {
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof el.addEventListener !== "function") return;
    const onKey = (e: Event) => {
      const ke = e as KeyboardEvent;
      if (!(ke.ctrlKey || ke.metaKey)) return;
      const key = ke.key.toLowerCase();
      if (key === "z" && !ke.shiftKey) {
        ke.preventDefault();
        undo();
      } else if ((key === "z" && ke.shiftKey) || key === "y") {
        ke.preventDefault();
        redo();
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [rootRef, undo, redo]);
}
