/**
 * 画布自动保存 + 历史快照。
 * - doc：当前画布，防抖写入，关闭插件后重开能继续编辑
 * - snapshots：最近几次的完整存档（环形 40 条），可在「历史记录」里恢复
 */
import type { SketchDocument } from "../model/types";

const DOC_KEY = "mathsketch.doc.v2";
const SNAP_KEY = "mathsketch.snapshots.v2";
const MAX_SNAPS = 40;
/** 单条快照上限（字符），超了不入库，避免撑爆 localStorage */
const MAX_CHARS = 1_600_000;

export interface Snapshot {
  ts: number;
  count: number;
  doc: SketchDocument;
}

export function saveDoc(doc: SketchDocument) {
  try {
    const text = JSON.stringify(doc);
    if (text.length > MAX_CHARS) return;
    localStorage.setItem(DOC_KEY, text);
  } catch {
    // 配额满或隐私模式：静默失败，不影响作图
  }
}

export function loadDoc(): SketchDocument | null {
  try {
    const raw = localStorage.getItem(DOC_KEY);
    if (!raw) return null;
    const doc = JSON.parse(raw) as SketchDocument;
    return Array.isArray(doc?.shapes) ? doc : null;
  } catch {
    return null;
  }
}

export function listSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Snapshot[];
    return Array.isArray(arr) ? arr.filter((s) => s && Array.isArray(s.doc?.shapes)) : [];
  } catch {
    return [];
  }
}

/** 存一条快照；与最新一条内容相同则跳过（避免重复） */
export function pushSnapshot(doc: SketchDocument) {
  try {
    const list = listSnapshots();
    const last = list[0];
    const text = JSON.stringify(doc.shapes);
    if (last && JSON.stringify(last.doc.shapes) === text) return;
    if (text.length > MAX_CHARS) return;
    const next: Snapshot[] = [{ ts: Date.now(), count: doc.shapes.length, doc }, ...list].slice(0, MAX_SNAPS);
    localStorage.setItem(SNAP_KEY, JSON.stringify(next));
  } catch {
    // 忽略
  }
}

/** 删掉一条快照（历史记录弹窗里的「删除」） */
export function removeSnapshot(ts: number): Snapshot[] {
  try {
    const next = listSnapshots().filter((s) => s.ts !== ts);
    localStorage.setItem(SNAP_KEY, JSON.stringify(next));
    return next;
  } catch {
    return listSnapshots();
  }
}

/** 清空全部快照 */
export function clearSnapshots(): void {
  try {
    localStorage.removeItem(SNAP_KEY);
  } catch {
    // 忽略
  }
}
