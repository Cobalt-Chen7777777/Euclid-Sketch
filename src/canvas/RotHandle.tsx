/**
 * 画布上的旋转钮：白底 + 绿色环形箭头。
 * 抽出来单独一个文件，主渲染层不用为了它多背十几行 JSX。
 */
export function RotHandle({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={11} fill="var(--handle-bg, #fff)" stroke="var(--handle-accent, #10b981)" strokeWidth={1.8} />
      {/* 先缩放到 24 格坐标再居中：顺序反了图标会偏到圆外，看着就是个绿点 */}
      <g transform="scale(0.62) translate(-12 -12)" fill="none" stroke="var(--handle-accent, #10b981)"
        strokeWidth={2.9} strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
        <path d="M20.5 3.6v5.2h-5.2" />
      </g>
    </g>
  );
}
