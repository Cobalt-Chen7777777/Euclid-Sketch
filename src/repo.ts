/**
 * 仓库信息：插件里的「GitHub 仓库」「检查更新」「更新日志」都读这里。
 * 换账号或改仓库名时只改本文件即可。
 */
export const GITHUB_OWNER = "Cobalt-Chen7777777";
export const GITHUB_REPO = "euclid-sketch";

export const GITHUB_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`;
export const RELEASES_URL = `${GITHUB_URL}/releases`;
export const CHANGELOG_URL = `${GITHUB_URL}/blob/main/CHANGELOG.md`;

/** 未配置账号时不发请求，界面直接提示去配置 */
export const isRepoConfigured = !GITHUB_OWNER.startsWith("YOUR_");
