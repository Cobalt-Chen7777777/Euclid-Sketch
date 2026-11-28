/** 插件版本：与 mnaddon.json 的 version 保持一致 */
export const APP_VERSION = "0.3.0-beta.5";

/** 构建时间（打包时注入），用来确认设备上装的是哪一次构建 */
declare const __BUILD_TIME__: string | undefined;
export const BUILD_TIME = typeof __BUILD_TIME__ === "string" ? __BUILD_TIME__ : "";
