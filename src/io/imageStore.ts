/**
 * 图片库：原图按 Blob 存在 IndexedDB 里，画布只记一个 id。
 *
 * 之前图片是压成 dataURL 塞进图形数据、跟着文档写 localStorage 的——为了不撑爆 5MB 配额，
 * 只能压到 1200px + JPEG，插入后和原图差很多。现在原样存 Blob（不重编码、不缩尺寸），
 * 渲染时用 objectURL，导出时再临时转回 dataURL。
 */
const DB_NAME = "mathsketch-images";
const STORE = "blobs";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** 渲染用的 id → objectURL（同步读，供 ShapeLayer 用） */
export const imageUrls = new Map<string, string>();

/** 存一张原图，返回 id */
export async function putImage(blob: Blob): Promise<string> {
  const id = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const db = await openDb();
  if (!db) return id;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
  imageUrls.set(id, URL.createObjectURL(blob));
  return id;
}

/** 取 Blob（导出、裁剪时用） */
export async function getImageBlob(id: string): Promise<Blob | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** 确保这些 id 都有可渲染的 URL；有新的就返回 true（调用方据此重绘） */
export async function hydrateImageUrls(ids: string[]): Promise<boolean> {
  const missing = ids.filter((id) => id && !imageUrls.has(id));
  if (missing.length === 0) return false;
  let changed = false;
  for (const id of missing) {
    const blob = await getImageBlob(id);
    if (blob) {
      imageUrls.set(id, URL.createObjectURL(blob));
      changed = true;
    }
  }
  return changed;
}

/** 导出用：id → dataURL（SVG 序列化时 blob: 链接进不去） */
export async function imageDataUrl(id: string): Promise<string | null> {
  const blob = await getImageBlob(id);
  if (!blob) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}
