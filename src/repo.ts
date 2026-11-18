/**
 * 仓库信息：发布到 GitHub 前把 OWNER 改成你的账号即可，
 * 插件里的「GitHub 仓库」「检查更新」都读这里，不用改别处。
 */
export const GITHUB_OWNER = "YOUR_GITHUB_NAME";
export const GITHUB_REPO = "euclid-sketch";

export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const RELEASES_URL = `${GITHUB_URL}/releases`;
export const CHANGELOG_URL = `${GITHUB_URL}/blob/main/CHANGELOG.md`;

/** 还没填账号时不发请求，界面直接提示去配置 */
export const isRepoConfigured = !GITHUB_OWNER.startsWith("YOUR_");
