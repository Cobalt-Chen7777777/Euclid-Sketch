<!--
使用说明（发帖人看，不要贴进正文）：
1. 打开 https://bbs.marginnote.com.cn/c/script/mod/55 （插件发布区）→ 右上角「+ 新建话题」
2. 标题栏粘贴下面的「标题」一行；正文区从「一句话介绍」开始粘贴到结尾
3. 图片是外链，Discourse 发帖后会自动抓取转存；若个别图没显示，把 docs/screenshots/ 里同名图片直接拖进编辑器即可
4. 建议把 release/Euclid Sketch-0.1.0.mntemplate 作为附件拖进帖子（也可只留文中的 Release 链接）
5. 正文里的签名状态「待签名」按实际情况修改
-->

# 标题（复制到标题栏）

【第三方MN插件】Euclid Sketch (0.1.0 待签名)——数学模型构图：把草稿纸搬进 MarginNote

# 正文（从这里开始复制）

![画布](https://cdn.jsdelivr.net/gh/Cobalt-Chen7777777/Euclid-Sketch@main/docs/screenshots/canvas.png)

## 一句话介绍

一个 **MarginNote 5 场景插件**：不用切走、不用截图——直接在 MN 里画函数曲线、建坐标系、量角度、插几何图形、转立体模型，画完写进卡片，改一个数字重画只要一下。

## 它解决什么问题

在 MN 里做数学笔记，最难受的是画图：遇到 `f(x)=sin(x)+x/2` 或者一个圆锥，得先去 GeoGebra / 手画 → 截图 → 插回卡片；想改个参数，整条流程再来一遍。图是死的，笔记也是死的。

Euclid Sketch 把那块「草稿纸」直接搬进了 MN——**图是活的**：函数是表达式，角度是三个点，立体是参数模型，全部可以随手改。

## 功能一览

### ✏️ 草稿纸画布
- 画笔 / 橡皮 / 14 色调色板，笔迹平滑，随手演算
- 画布铺满面板，拉多大画多大，网格是正方格、圆是真圆
- 两种背景：**坐标系**（带刻度，适合函数与几何）/ **空白画布**（随手涂）

![绘图选项](https://cdn.jsdelivr.net/gh/Cobalt-Chen7777777/Euclid-Sketch@main/docs/screenshots/options.png)

### 📐 任意角度 + 12 种图形
- **画角度**：点三下（顶点 → 两条边），度数直接标在弧上，直角自动画方角标记；想画标准角可打开「角度吸附特殊角」
- 插入图形 12 种：圆、椭圆、圆弧、矩形、正多边形、星形、菱形、梯形、箭头、射线、直线、点
- 圆规工具：吸附已有点、锁定半径画等圆

### 🖩 科学计算器
- 15 个函数键 + 20 键数字键盘，支持 `f(x)`、参数方程、圆 / 椭圆方程
- **代入求值**：`x = 2` 按 `=` 直接算，和绘图同一套求值器，能算的就能画
- 曲线列表可逐条删，或一键「清除全部函数」

![函数计算器](https://cdn.jsdelivr.net/gh/Cobalt-Chen7777777/Euclid-Sketch@main/docs/screenshots/calculator.png)

### 🧊 立体模型（10 种）
- 圆锥 / 圆柱 / 球 / 棱锥 / 圆环 / 正方体 / 长方体 / 圆台 / 棱台 / 半球
- **透明 / 实体**两种画法：透明能看到背面结构；实体模式下被挡住的棱自动画成虚线——教材画法
- 中性配色（纸白面 + 深色棱线），单指旋转、双指缩放、参数滑块实时调

![立体模型](https://cdn.jsdelivr.net/gh/Cobalt-Chen7777777/Euclid-Sketch@main/docs/screenshots/solid.png)

### 🌓 深色模式 & 窗口
- 深色模式**跟随 MN 的白天 / 夜间自动切换**，也可手动锁定浅色 / 深色
- 窗口右下角自由缩放，可收起成迷你浮条（含上一张 / 下一张卡片）
- 快捷浮球：画笔 / 橡皮 / 角度 / 图形 / 函数 / 设置一键切换

![深色模式](https://cdn.jsdelivr.net/gh/Cobalt-Chen7777777/Euclid-Sketch@main/docs/screenshots/settings-dark.png)

## 安装

**方式一（推荐）：模板包**
1. 下载 `Euclid Sketch-0.1.0.mntemplate`：[GitHub Release](https://github.com/Cobalt-Chen7777777/Euclid-Sketch/releases/tag/v0.1.0)，或直接用本帖附件
2. 存到 iPad「文件」App → MarginNote → **设置 → 场景模板 → 管理场景模板 → 导入**
3. 新建场景时选择本模板即可打开面板

**方式二：单独插件**
- 下载 `.mnaddon` → **设置 → 插件 → 导入**

> 适配 MarginNote 5（4.5.0+），iPad 实测为主。画过的图可从「设置 → 导出」存成 PNG 或 JSON 带走。

## 更新与反馈

- 插件内置「设置 → 窗口与关于 → 检查更新」，会自动比对 GitHub 最新 Release
- 用到什么场景、遇到什么问题，直接回帖告诉我；也可以去 GitHub 提 Issue

## 开源

全代码 MIT 开源，欢迎 PR 与 fork：

**GitHub**：https://github.com/Cobalt-Chen7777777/Euclid-Sketch

---

画图是数学笔记里最容易被「截图插入」打断的一环，希望这个插件能帮到同样在 MN 里啃数学的同学。用得不错的话去 GitHub 点个 Star，遇到 bug 优先回帖告诉我 🙌
