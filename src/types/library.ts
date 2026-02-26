export type ModelFormat = 'obj-mtl' | 'obj' | 'glb' | 'gltf' | 'fbx' | 'unknown';

export interface StoredModelFile {
  name: string;
  ext: string;
  uri: string;
}

export interface StoredModel {
  id: string;
  name: string;
  format: ModelFormat;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  lastViewedAt: string | null;
  primaryUri: string;
  mtlUri: string | null;
  files: StoredModelFile[];
}

export interface FolderEntry {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type SceneId = 'white' | 'black' | 'garden' | 'gray';
export type LightingId = 'balanced' | 'dramatic' | 'flat' | 'night';

export interface ViewerPreferences {
  sceneId: SceneId;
  lightingId: LightingId;
  showGrid: boolean;
  wireframe: boolean;
  autoRotate: boolean;
  showStats: boolean;
  showAxes: boolean;
}

export interface PersistedLibraryState {
  version: number;
  selectedModelId: string | null;
  models: StoredModel[];
  folders: FolderEntry[];
  viewer: ViewerPreferences;
}

export interface ModelStats {
  meshes: number;
  faces: number;
  vertices: number;
  materials: number;
}

export interface RuntimeStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  points: number;
  lines: number;
}
