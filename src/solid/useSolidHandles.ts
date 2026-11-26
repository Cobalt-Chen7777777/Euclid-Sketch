/* eslint-disable no-restricted-syntax -- 3D 交互需要命令式访问 canvas 与 Three.js */
/**
 * 立体编辑手柄：拖端点/棱直接改尺寸，像 3D 建模那样在模型上操作。
 *
 * 做法：在手柄位置放小球；按下时从相机发射射线命中球，拖动时把射线投到
 * 「过手柄、正对相机」的平面上得到世界坐标，再换算成对应参数值回传。
 * 拖动期间禁用 OrbitControls，避免一边改尺寸一边转视角。
 */
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import type { SolidShape } from "../model/types";
import { buildHandles, resolveValue, type HandleSpec } from "./handles";

interface SceneRefs {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: { enabled: boolean };
  renderer: { domElement: HTMLCanvasElement };
}

interface Args {
  sceneRef: { current: SceneRefs | null };
  solid: SolidShape;
  onParam: ((key: string, value: number) => void) | undefined;
  enabled: boolean;
}

const HANDLE_R = 0.16;

export function useSolidHandles({ sceneRef, solid, onParam, enabled }: Args) {
  const meshesRef = useRef<{ mesh: THREE.Mesh; spec: HandleSpec }[]>([]);
  const dragRef = useRef<{ spec: HandleSpec; plane: THREE.Plane } | null>(null);
  // 场景由 SolidView 的 effect 命令式建好，这里轮询到位后再挂手柄
  const [refs, setRefs] = useState<SceneRefs | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const r = sceneRef.current;
      if (r) { setRefs(r); return; }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [sceneRef]);

  const scene = refs?.scene ?? null;
  const camera = refs?.camera ?? null;
  const dom = refs?.renderer.domElement ?? null;
  const controls = refs?.controls ?? null;

  // 手柄随参数变化重排
  useEffect(() => {
    if (!scene || !enabled || !onParam) return;
    const rs = HANDLE_R * 1.6;
    const handles = buildHandles(solid);
    const list = handles.map((spec) => {
      const geo = new THREE.SphereGeometry(HANDLE_R, 16, 12);
      const mat = new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.92 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...spec.pos);
      mesh.renderOrder = 10;
      // 外圈：点击热区更大，视觉上也更像「可抓」
      const halo = new THREE.Mesh(
        new THREE.RingGeometry(HANDLE_R * 1.15, rs, 20),
        new THREE.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.24, side: THREE.DoubleSide }),
      );
      mesh.add(halo);
      scene.add(mesh);
      return { mesh, spec };
    });
    meshesRef.current = list;

    return () => {
      for (const { mesh } of list) {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        for (const child of mesh.children) {
          const m = child as THREE.Mesh;
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
      }
      meshesRef.current = [];
    };
  }, [scene, solid, enabled, onParam]);

  useEffect(() => {
    if (!camera || !dom || !onParam || !enabled) return;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane();
    const hitPoint = new THREE.Vector3();
    const camDir = new THREE.Vector3();

    const toNdc = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    };

    const pickHandle = (e: PointerEvent) => {
      toNdc(e);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(meshesRef.current.map((m) => m.mesh), false);
      const first = hits[0];
      if (!first) return null;
      return meshesRef.current.find((m) => m.mesh === first.object) ?? null;
    };

    const onDown = (e: PointerEvent) => {
      const hit = pickHandle(e);
      if (!hit) return;
      camera.getWorldDirection(camDir);
      plane.setFromNormalAndCoplanarPoint(camDir, hit.mesh.position);
      dragRef.current = { spec: hit.spec, plane };
      if (controls) controls.enabled = false;
      dom.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      toNdc(e);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(drag.plane, hitPoint)) return;
      const v = resolveValue(drag.spec, { x: hitPoint.x, y: hitPoint.y, z: hitPoint.z });
      if (Math.abs(v - drag.spec.value) > 0.005) {
        drag.spec.value = v;
        onParam(drag.spec.key, v);
      }
    };

    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      if (controls) controls.enabled = true;
    };

    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointercancel", onUp);
    return () => {
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointercancel", onUp);
    };
  }, [camera, dom, controls, onParam, enabled]);
}
