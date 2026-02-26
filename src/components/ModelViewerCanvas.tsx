import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, PanResponder, type PanResponderGestureState, type LayoutRectangle, View } from 'react-native';
import { Canvas, useFrame, useThree } from '@react-three/fiber/native';
import * as THREE from 'three';
import { Card, Text } from 'react-native-paper';

import { lightingPresets, scenePresets } from '../constants/presets';
import { loadModelObject } from '../services/modelParser';
import type { ModelStats, RuntimeStats, StoredModel, ViewerPreferences } from '../types/library';

function GardenSet() {
  const trees = useMemo(() => {
    return [
      [-2.4, 0, -2.2],
      [2.1, 0, -1.4],
      [2.7, 0, 2.1],
      [-2.2, 0, 2.6],
      [0.1, 0, -3.1],
    ];
  }, []);

  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[8, 64]} />
        <meshStandardMaterial color="#6CBF75" />
      </mesh>
      {trees.map((tree, index) => (
        <group position={[tree[0], tree[1], tree[2]]} key={`tree-${index}`}>
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.05, 0.08, 0.6, 8]} />
            <meshStandardMaterial color="#7A4A2E" />
          </mesh>
          <mesh position={[0, 0.8, 0]}>
            <coneGeometry args={[0.35, 0.7, 8]} />
            <meshStandardMaterial color="#3F8F4A" />
          </mesh>
        </group>
      ))}
    </>
  );
}

function applyWireframe(material: THREE.Material, wireframe: boolean) {
  if ('wireframe' in material) {
    (material as THREE.MeshStandardMaterial).wireframe = wireframe;
  }
}

function RuntimeStatsSampler({ onStats }: { onStats: (stats: RuntimeStats) => void }) {
  const gl = useThree((state) => state.gl);
  const lastSampleAtRef = useRef(Date.now());
  const frameCountRef = useRef(0);

  useFrame(() => {
    frameCountRef.current += 1;
    const now = Date.now();
    const elapsed = now - lastSampleAtRef.current;
    if (elapsed >= 500) {
      const nextFps = (frameCountRef.current / elapsed) * 1000;
      onStats({
        fps: Math.round(nextFps),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        points: gl.info.render.points,
        lines: gl.info.render.lines,
      });
      lastSampleAtRef.current = now;
      frameCountRef.current = 0;
    }
  });

  return null;
}

interface CameraGestureState {
  target: THREE.Vector3;
  azimuth: number;
  polar: number;
  distance: number;
}

interface CameraGestureRigProps {
  gestureStateRef: React.MutableRefObject<CameraGestureState>;
  autoRotate: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function CameraGestureRig({ gestureStateRef, autoRotate }: CameraGestureRigProps) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const initializedRef = useRef(false);

  useFrame((_, delta) => {
    const controls = gestureStateRef.current;
    if (!initializedRef.current) {
      const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
      const distance = Math.max(offset.length(), 0.001);
      controls.distance = distance;
      controls.azimuth = Math.atan2(offset.x, offset.z);
      controls.polar = clamp(Math.acos(clamp(offset.y / distance, -1, 1)), 0.12, Math.PI - 0.12);
      initializedRef.current = true;
    }

    if (autoRotate) {
      controls.azimuth += delta * 0.45;
    }

    const sinPolar = Math.sin(controls.polar);
    const x = controls.target.x + controls.distance * sinPolar * Math.sin(controls.azimuth);
    const y = controls.target.y + controls.distance * Math.cos(controls.polar);
    const z = controls.target.z + controls.distance * sinPolar * Math.cos(controls.azimuth);

    camera.position.set(x, y, z);
    camera.lookAt(controls.target);
  });

  return null;
}

interface ModelMeshProps {
  model: StoredModel;
  wireframe: boolean;
  onStats: (stats: ModelStats) => void;
}

function ModelMesh({ model, wireframe, onStats }: ModelMeshProps) {
  const [object, setObject] = useState<THREE.Object3D | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const loaded = await loadModelObject(model);
        if (!cancelled) {
          loaded.object.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              if (Array.isArray(mesh.material)) {
                mesh.material = mesh.material.map((material) => {
                  applyWireframe(material, wireframe);
                  return material;
                });
              } else if (mesh.material) {
                applyWireframe(mesh.material, wireframe);
              }
            }
          });
          setObject(loaded.object);
          onStats(loaded.stats);
        }
      } catch (error) {
        console.error('Failed to load model for preview', error);
        if (!cancelled) {
          setObject(null);
          onStats({
            meshes: 0,
            faces: 0,
            vertices: 0,
            materials: 0,
          });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [model, wireframe, onStats]);

  if (!object) {
    return null;
  }

  return <primitive object={object} />;
}

interface ModelViewerCanvasProps {
  model: StoredModel;
  viewer: ViewerPreferences;
  onModelStats: (stats: ModelStats) => void;
  onRuntimeStats: (stats: RuntimeStats) => void;
}

export function ModelViewerCanvas({ model, viewer, onModelStats, onRuntimeStats }: ModelViewerCanvasProps) {
  const scene = scenePresets[viewer.sceneId];
  const light = lightingPresets[viewer.lightingId];
  const layoutRef = useRef<LayoutRectangle>({ x: 0, y: 0, width: 1, height: 1 });
  const moveRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const activeTouchesRef = useRef(0);
  const pinchStartDistanceRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number | null>(null);
  const lastMidpointRef = useRef<{ x: number; y: number } | null>(null);
  const gestureStateRef = useRef<CameraGestureState>({
    target: new THREE.Vector3(0, 0.8, 0),
    azimuth: 0,
    polar: Math.PI / 3,
    distance: 6.4,
  });

  const rotateBy = (dx: number, dy: number) => {
    const controls = gestureStateRef.current;
    const width = Math.max(layoutRef.current.width, 1);
    const height = Math.max(layoutRef.current.height, 1);
    controls.azimuth -= (dx / width) * Math.PI * 1.6;
    controls.polar = clamp(controls.polar + (dy / height) * Math.PI * 1.2, 0.12, Math.PI - 0.12);
  };

  const panBy = (dx: number, dy: number) => {
    const controls = gestureStateRef.current;
    const distance = controls.distance;
    const scale = distance * 0.0025;

    const viewDirection = new THREE.Vector3(
      -Math.sin(controls.polar) * Math.sin(controls.azimuth),
      -Math.cos(controls.polar),
      -Math.sin(controls.polar) * Math.cos(controls.azimuth),
    ).normalize();
    const right = new THREE.Vector3().crossVectors(viewDirection, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, viewDirection).normalize();

    controls.target.addScaledVector(right, -dx * scale);
    controls.target.addScaledVector(up, dy * scale);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderGrant: (event, gestureState) => {
          const touches = event.nativeEvent.touches ?? [];
          const first = touches[0];
          moveRef.current = {
            x: first?.pageX ?? gestureState.moveX,
            y: first?.pageY ?? gestureState.moveY,
          };
          activeTouchesRef.current = touches.length > 0 ? touches.length : Math.max(gestureState.numberActiveTouches, 1);
          pinchStartDistanceRef.current = null;
          pinchStartZoomRef.current = null;
          lastMidpointRef.current = null;
        },
        onPanResponderMove: (event, gestureState: PanResponderGestureState) => {
          const touches = event.nativeEvent.touches ?? [];
          const touchCount = touches.length > 0 ? touches.length : Math.max(gestureState.numberActiveTouches, 1);

          let pointerX = gestureState.moveX;
          let pointerY = gestureState.moveY;
          if (touches.length >= 2) {
            pointerX = (touches[0]?.pageX ?? pointerX) + (touches[1]?.pageX ?? pointerX);
            pointerX /= 2;
            pointerY = (touches[0]?.pageY ?? pointerY) + (touches[1]?.pageY ?? pointerY);
            pointerY /= 2;
          } else if (touches.length === 1) {
            pointerX = touches[0]?.pageX ?? pointerX;
            pointerY = touches[0]?.pageY ?? pointerY;
          }

          if (touchCount !== activeTouchesRef.current) {
            activeTouchesRef.current = touchCount;
            moveRef.current = { x: pointerX, y: pointerY };
            pinchStartDistanceRef.current = null;
            pinchStartZoomRef.current = null;
            lastMidpointRef.current = null;
            return;
          }

          const dx = pointerX - moveRef.current.x;
          const dy = pointerY - moveRef.current.y;
          moveRef.current = { x: pointerX, y: pointerY };

          if (touchCount >= 2) {
            const first = touches[0];
            const second = touches[1];
            if (!first || !second) {
              panBy(dx, dy);
              return;
            }

            const distance = Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
            const midpoint = {
              x: (first.pageX + second.pageX) / 2,
              y: (first.pageY + second.pageY) / 2,
            };

            if (pinchStartDistanceRef.current == null || pinchStartZoomRef.current == null) {
              pinchStartDistanceRef.current = distance;
              pinchStartZoomRef.current = gestureStateRef.current.distance;
              lastMidpointRef.current = midpoint;
              return;
            }

            const scale = distance / Math.max(pinchStartDistanceRef.current, 0.0001);
            const nextDistance = (pinchStartZoomRef.current ?? gestureStateRef.current.distance) / Math.max(scale, 0.0001);
            gestureStateRef.current.distance = clamp(nextDistance, 1.2, 22);

            if (lastMidpointRef.current) {
              const panDx = midpoint.x - lastMidpointRef.current.x;
              const panDy = midpoint.y - lastMidpointRef.current.y;
              panBy(panDx, panDy);
            }

            lastMidpointRef.current = midpoint;
            return;
          }

          activeTouchesRef.current = 1;
          pinchStartDistanceRef.current = null;
          pinchStartZoomRef.current = null;
          lastMidpointRef.current = null;
          rotateBy(dx, dy);
        },
        onPanResponderRelease: () => {
          moveRef.current = { x: 0, y: 0 };
          activeTouchesRef.current = 0;
          pinchStartDistanceRef.current = null;
          pinchStartZoomRef.current = null;
          lastMidpointRef.current = null;
        },
        onPanResponderTerminate: () => {
          moveRef.current = { x: 0, y: 0 };
          activeTouchesRef.current = 0;
          pinchStartDistanceRef.current = null;
          pinchStartZoomRef.current = null;
          lastMidpointRef.current = null;
        },
      }),
    [],
  );

  return (
    <View className="flex-1 overflow-hidden rounded-2xl border border-slate-700">
      <View
        className="flex-1"
        onLayout={(event) => {
          layoutRef.current = event.nativeEvent.layout;
        }}
        {...panResponder.panHandlers}
      >
        <Canvas camera={{ fov: 45, position: [4, 3, 5], near: 0.1, far: 100 }}>
          <color attach="background" args={[scene.background]} />

          <ambientLight intensity={light.ambient} color={light.keyColor} />
          <directionalLight position={[4, 5, 6]} intensity={light.key} color={light.keyColor} />
          <directionalLight position={[-4, 2, -3]} intensity={light.fill} color={light.fillColor} />
          <directionalLight position={[0, 5, -5]} intensity={light.rim} color={light.rimColor} />

          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.001, 0]}>
            <planeGeometry args={[18, 18]} />
            <meshStandardMaterial color={scene.groundColor} />
          </mesh>

          {viewer.sceneId === 'garden' ? <GardenSet /> : null}

          {viewer.showGrid ? <gridHelper args={[16, 24, scene.accentColor, '#556070']} /> : null}
          {viewer.showAxes ? <axesHelper args={[2]} /> : null}

          <ModelMesh model={model} wireframe={viewer.wireframe} onStats={onModelStats} />
          <RuntimeStatsSampler onStats={onRuntimeStats} />
          <CameraGestureRig gestureStateRef={gestureStateRef} autoRotate={viewer.autoRotate} />
        </Canvas>
      </View>
    </View>
  );
}

export function ViewerEmptyState({
  loading,
  message,
}: {
  loading: boolean;
  message: string;
}) {
  return (
    <Card mode="contained" style={{ marginHorizontal: 16, marginVertical: 24 }}>
      <Card.Content>
        <Text variant="titleMedium">No model selected</Text>
        <Text variant="bodyMedium" style={{ marginTop: 8 }}>
          {message}
        </Text>
        {loading ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}
      </Card.Content>
    </Card>
  );
}
