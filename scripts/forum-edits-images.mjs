/** 第二批改动：插入 4 张新截图 + 替换下载段的附件占位符 */
const IMG = {
  canvas: "https://bbs.marginnote.com.cn/uploads/short-url/up17yFfCKijs7fOLTXGHvG57Pav.png",
  history: "https://bbs.marginnote.com.cn/uploads/short-url/93kDWZZLA5Ra8eXTWviCQcl1pxw.png",
  params: "https://bbs.marginnote.com.cn/uploads/short-url/m8JppcaiML1pvkEwA0M8PLjho8X.png",
  mini: "https://bbs.marginnote.com.cn/uploads/short-url/mMMRfdcykdmLXt4XPnBQYrTiehV.png",
};
const PKG = {
  tpl: "https://bbs.marginnote.com.cn/uploads/short-url/6PSJNzngFPeN18lqOamp7sd7ukC.mntemplate",
  addon: "https://bbs.marginnote.com.cn/uploads/short-url/zfMNg4J0GuHymIM4mVmy65dWSJp.mnaddon",
};

export const IMAGE_EDITS = [
  [
    "图①画布",
    /(- \*\*画布跨会话保留\*\*：关掉面板、切到别的卡片再回来，画布还在（本版起自动保存到本机）\n)/,
    `- **画布跨会话保留**：关掉面板、切到别的卡片再回来，画布还在（本版起自动保存到本机）

![画布](${IMG.canvas})
`,
  ],
  [
    "图③几何参数",
    /(- \*\*数值微调\*\*：选中线段输入精确长度[^\n]*只显示当前图形的项\n)/,
    `$1
![几何参数](${IMG.params})
`,
  ],
  [
    "图②历史记录",
    /(- \*\*缓存管理\*\*：设置 → 关于 → 缓存管理[^\n]*一键清除画布缓存（不动设置）\n)/,
    `$1
![历史记录](${IMG.history})
`,
  ],
  [
    "图④迷你条",
    /(- 工具栏可停靠左 \/ 右（竖排）或上 \/ 下（横排，超宽自动换行）\n)/,
    `$1
![迷你条](${IMG.mini})
`,
  ],
  [
    "附件·主推版本",
    /主推版本（建议装这一版）：\n\n\{\{ATTACH_CURRENT\}\}/,
    `主推版本（0.3.0-beta.1 测试版）：

- [Euclid Sketch-0.3.0-beta.1.mntemplate](${PKG.tpl}) (459.9 KB)
- [Euclid Sketch-0.3.0-beta.1.mnaddon](${PKG.addon}) (458.8 KB)`,
  ],
  [
    "附件·历史版本补 0.2.1",
    /历史版本（回退用，附件同样提供）：\n\n\{\{ATTACH_HISTORY\}\}/,
    `历史版本（回退用，附件同样提供）：

- [Euclid Sketch-0.2.1.mntemplate](https://bbs.marginnote.com.cn/uploads/short-url/4sLFPc9wzFzYiM9bteI0nzBvGDW.mntemplate) (450.8 KB)
- [Euclid Sketch-0.2.1.mnaddon](https://bbs.marginnote.com.cn/uploads/short-url/gTxHRiiAilxguKSvHOxlkz3irv3.mnaddon) (449.6 KB)
- [Euclid Sketch-0.2.0.mntemplate](https://bbs.marginnote.com.cn/uploads/short-url/mt7mcWEStNWloQfKLOR0grTW0Us.mntemplate) (441.2 KB)
- [Euclid Sketch-0.2.0.mnaddon](https://bbs.marginnote.com.cn/uploads/short-url/6s4F3CrjRmeXXrf8LqphrdVL48l.mnaddon) (440.1 KB)
- [Euclid Sketch-0.1.0.mntemplate](https://bbs.marginnote.com.cn/uploads/short-url/fWNPz8ZC1S9gSQO5R9iX64LY6MR.mntemplate) (420.0 KB)
- [Euclid Sketch-0.1.0.mnaddon](https://bbs.marginnote.com.cn/uploads/short-url/iNkrfJI0t8T2qCHIEEG2NDItnCv.mnaddon) (418.9 KB)`,
  ],
];
