/**
 * 更新检查：读 GitHub 的 latest release，与内置版本比对。
 *
 * 场景插件的面板里可以正常发 fetch（GitHub API 允许跨域），
 * 因此不需要任何后端。失败一律降级成「无法检查」，不打扰使用。
 */
import { APP_VERSION } from "./version";
import { GITHUB_OWNER, GITHUB_REPO, isRepoConfigured } from "./repo";

export interface UpdateResult {
  ok: boolean;
  /** 最新版本号（tag 去掉前缀 v） */
  latest?: string | undefined;
  /** release 页面地址 */
  url?: string | undefined;
  /** 是否有新版本 */
  hasUpdate?: boolean | undefined;
  /** 可直接下载的安装包（Release 资产，模板包优先） */
  asset?: UpdateAsset | undefined;
  /** 失败原因（ok=false 时） */
  error?: string | undefined;
}

/** 把 v1.2.3 / 1.2 统一成数字数组，便于逐段比较 */
function parseVersion(tag: string): number[] {
  return tag
    .replace(/^v/i, "")
    .split(/[.\-+]/)
    .map((part) => Number.parseInt(part, 10))
    .filter((n) => Number.isFinite(n));
}

export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i += 1) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return false;
}

export async function checkUpdate(timeoutMs = 8000): Promise<UpdateResult> {
  if (!isRepoConfigured) {
    return { ok: false, error: "还没配置仓库地址（src/repo.ts）" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (res.status === 404) return { ok: false, error: "仓库不存在，或还没有发布 Release" };
    if (!res.ok) return { ok: false, error: `GitHub 返回 ${res.status}` };

    const data = (await res.json()) as { tag_name?: string; html_url?: string; assets?: ReleaseRow[] };
    const latest = (data.tag_name ?? "").replace(/^v/i, "");
    if (!latest) return { ok: false, error: "Release 缺少版本号" };

    return {
      ok: true,
      latest,
      url: data.html_url,
      hasUpdate: isNewer(latest, APP_VERSION),
    };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, error: aborted ? "请求超时（可能没联网）" : "无法连接 GitHub" };
  } finally {
    clearTimeout(timer);
  }
}

/** Release 里的安装包资产（优先模板包：导入模板会连带安装/替换插件） */
export interface UpdateAsset {
  url: string;
  name: string;
}

interface ReleaseRow {
  name?: string;
  browser_download_url?: string;
}

/** 从 release 资产中挑包：.mntemplate 优先，其次 .mnaddon */
export function pickUpdateAsset(assets: ReleaseRow[]): UpdateAsset | null {
  for (const ext of [".mntemplate", ".mnaddon"]) {
    const hit = assets.find((a) => a.name?.endsWith(ext) && a.browser_download_url);
    if (hit?.name && hit.browser_download_url) return { url: hit.browser_download_url, name: hit.name };
  }
  return null;
}

