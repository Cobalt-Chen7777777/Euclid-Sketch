/* eslint-disable no-restricted-globals, no-restricted-syntax -- Three.js 需命令式挂载 canvas 与访问渲染 API */
/**
 * Three.js 立体模型视图。
 * 支持触控旋转/缩放（OrbitControls），参数变化时重建几何体，
 * 通过 onReady 暴露截图方法用于 PNG 导出。
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import type { SolidShape } from "../model/types";
import { useSolidHandles } from "./useSolidHandles";

/** ghost：半透明面 + 棱线；solid：不透明面 + 可见棱实线 + 隐藏棱虚线 */
export type SolidMode = "ghost" | "solid";

interface Props {
  solid: SolidShape;
  height?: number;
  onReady?: (capture: () => string) => void;
  /** 显示模式，默认半透明（能看到背面结构，符合几何图示习惯） */
  mode?: SolidMode;
  /** 变化时把相机复位到初始视角 */
  resetSignal?: number;
  /** 深色主题：场景底色、网格与坐标轴都要跟着变 */
  dark?: boolean;
  /** 拖动模型上的手柄改参数（不传则只看不能改） */
  onParam?: (key: string, value: number) => void;
  /** 是否显示可拖手柄 */
  editable?: boolean;
}

interface SceneRefs {
  scene: THREE.Scene;
  group: THREE.Group;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  renderer: THREE.WebGLRenderer;
}

function buildGeometry(solid: SolidShape): THREE.BufferGeometry {
  const p = solid.params;
  switch (solid.kind) {
    case "cone":
      return new THREE.ConeGeometry(p.r ?? 2, p.h ?? 3, Math.round(p.seg ?? 32));
    case "cylinder":
      return new THREE.CylinderGeometry(p.r ?? 1.5, p.r ?? 1.5, p.h ?? 3, Math.round(p.seg ?? 32));
    case "sphere":
      return new THREE.SphereGeometry(p.r ?? 2, Math.round(p.seg ?? 32), Math.round((p.seg ?? 32) / 2));
    case "pyramid":
      return new THREE.ConeGeometry(p.r ?? 2, p.h ?? 3, Math.round(p.sides ?? 4), 1);
    case "torus":
      return new THREE.TorusGeometry(p.r ?? 2, p.tube ?? 0.6, 16, Math.round(p.seg ?? 32));
    case "cube":
      return new THREE.BoxGeometry(p.a ?? 2, p.a ?? 2, p.a ?? 2);
    case "box":
      return new THREE.BoxGeometry(p.w ?? 3, p.h ?? 2, p.d ?? 1.6);
    case "frustum":
      return new THREE.CylinderGeometry(p.rTop ?? 1, p.r ?? 2, p.h ?? 3, Math.round(p.seg ?? 32));
    case "prismFrustum":
      return new THREE.CylinderGeometry(p.rTop ?? 0.9, p.r ?? 2, p.h ?? 3, Math.round(p.sides ?? 4), 1);
    case "hemisphere":
      return new THREE.SphereGeometry(p.r ?? 2, Math.round(p.seg ?? 32), Math.round((p.seg ?? 32) / 2), 0, Math.PI * 2, 0, Math.PI / 2);
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

export function SolidView({ solid, height = 320, onReady, mode = "ghost", resetSignal = 0, dark = false, onParam, editable = false }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneRefs | null>(null);
  const onReadyRef = useRef(onReady);
  const homeRef = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const [glError, setGlError] = useState(false);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  // 初始化场景（仅一次，依赖 height）
  useSolidHandles({ sceneRef, solid, onParam, enabled: editable && !!onParam });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(dark ? "#1f1d1a" : "#f7f5f0");

    const width = mount.clientWidth || 400;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(5, 4, 6);
    homeRef.current = { pos: camera.position.clone(), target: new THREE.Vector3(0, 0, 0) };

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    } catch {
      setTimeout(() => setGlError(true), 0);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = true;
    controls.target.set(0, 0, 0);
    controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(5, 8, 6);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0xffffff, 0.35);
    dir2.position.set(-5, 2, -4);
    scene.add(dir2);

    const grid = new THREE.GridHelper(20, 20, dark ? 0x4a453d : 0xbcb6aa, dark ? 0x39352f : 0xe0dcd2);
    grid.position.y = -2.6;
    scene.add(grid);

    // 三轴：x 偏红、y 偏绿、z 偏蓝，与数学习惯一致，但压低饱和度避免抢主体
    const axes = new THREE.AxesHelper(3.4);
    const axisMat = axes.material as THREE.LineBasicMaterial;
    axisMat.transparent = true;
    axisMat.opacity = dark ? 0.5 : 0.35;
    axes.position.y = -2.6;
    scene.add(axes);

    const group = new THREE.Group();
    scene.add(group);

    sceneRef.current = { scene, group, camera, controls, renderer };

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    onReadyRef.current?.(() => {
      controls.update();
      renderer.render(scene, camera);
      return renderer.domElement.toDataURL("image/png");
    });

    const observer = new ResizeObserver(() => {
      const w = mount.clientWidth || 400;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    });
    observer.observe(mount);


  return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      controls.dispose();
      group.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          const mat = obj.material;
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
          else mat.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [height, dark]);

  // 视角复位
  useEffect(() => {
    const refs = sceneRef.current;
    const home = homeRef.current;
    if (!refs || !home || resetSignal === 0) return;
    refs.camera.position.copy(home.pos);
    refs.controls.target.copy(home.target);
    refs.controls.update();
  }, [resetSignal]);

  // 参数/类型/颜色变化：重建几何体
  useEffect(() => {
    const refs = sceneRef.current;
    if (!refs) return;
    const { group } = refs;
    for (const child of [...group.children]) {
      group.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else mat.dispose();
      }
    }
    const geo = buildGeometry(solid);
    const ghost = mode === "ghost";
    // 立体几何用中性色：纸白/浅灰的面 + 深色棱线，不参与调色板
    const mat = new THREE.MeshStandardMaterial({
      color: ghost ? 0xf8f5ee : 0xfbf8f1,
      metalness: 0.02,
      roughness: 0.55,
      flatShading: solid.kind === "pyramid",
      transparent: ghost,
      opacity: ghost ? 0.42 : 1,
      depthWrite: !ghost,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const edges = new THREE.EdgesGeometry(geo, 20);
    const line = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x33302a, transparent: true, opacity: ghost ? 0.6 : 0.95 }),
    );
    geo.computeBoundingBox();
    if (geo.boundingBox) {
      const cy = (geo.boundingBox.min.y + geo.boundingBox.max.y) / 2;
      mesh.position.y = -cy;
      line.position.y = -cy;
    }
    group.add(mesh);

    // 实体模式下：先画一遍「全部棱线（虚线、不做深度测试）」再画一遍可见棱实线，
    // 这样被面挡住的棱呈现为虚线——教材里立体图的画法
    if (!ghost) {
      const hidden = new THREE.LineSegments(
        edges.clone(),
        new THREE.LineDashedMaterial({
          color: 0x33302a, transparent: true, opacity: 0.55,
          dashSize: 0.16, gapSize: 0.12, depthTest: false,
        }),
      );
      hidden.computeLineDistances();
      hidden.position.copy(line.position);
      group.add(hidden);
    }
    group.add(line);
  }, [solid, mode]);

  if (glError) {
    return <div className="solid-mount solid-error" style={{ height }}>当前设备不支持 WebGL，无法显示立体模型。可尝试更新 MarginNote 或使用 2D 构图。</div>;
  }
  return <div ref={mountRef} className="solid-mount" style={{ width: "100%", height }} />;
}
