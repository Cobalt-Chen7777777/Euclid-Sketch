/** 可插入的图形类型清单（图形选择器与「按参数创建」共用） */
import type { PrimitiveType } from "../model/types";

export const PRIMITIVES: [PrimitiveType, string][] = [
  ["circle", "圆"], ["ellipse", "椭圆"], ["arc", "圆弧"], ["rect", "矩形"],
  ["polygon", "多边形"], ["star", "星形"], ["rhombus", "菱形"], ["trapezoid", "梯形"],
  ["arrow", "箭头"], ["ray", "射线"], ["line", "直线"], ["point", "点"], ["angle", "角度"],
];
