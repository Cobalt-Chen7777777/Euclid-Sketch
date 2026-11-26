/**
 * 设置的「云端」副本：写进 MN 卡片自己的插件字段（addon-values）。
 *
 * 为什么需要：面板的 localStorage 在覆盖安装时可能被宿主清掉，重装后设置就回到默认。
 * 卡片插件字段存在 MN 的笔记库里，重装插件不会动它，所以用它做一次自动备份/恢复。
 *
 * 约定：只写当前目标卡，键名固定；读不到就静默返回 null（不打扰用户）。
 */
const KEY = "euclidSettingsJson";

export async function saveSettingsToCard(noteid: string, json: string): Promise<boolean> {
  try {
    const res = await mn.api("/notes/addon-values", {
      method: "POST",
      body: { noteIds: [noteid], values: { [KEY]: json }, confirm: true },
    });
    return !res?.error;
  } catch {
    return false;
  }
}

export async function loadSettingsFromCard(noteid: string): Promise<string | null> {
  try {
    const res = await mn.api<{ items?: { addonValues?: Record<string, unknown> }[] }>("/notes/batch-get", {
      method: "POST", body: { noteIds: [noteid] },
    });
    const item = (res?.items ?? [])[0];
    const value = item?.addonValues?.[KEY];
    return typeof value === "string" && value.length > 2 ? value : null;
  } catch {
    return null;
  }
}
