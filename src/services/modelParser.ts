import * as FileSystem from 'expo-file-system/legacy';
import { toByteArray } from 'base64-js';
import { TextureLoader } from 'expo-three';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { OBJLoader } from 'three-stdlib';

import type { ModelStats, StoredModel } from '../types/library';

function getResourcePath(fileUri: string) {
  return fileUri.replace(/[^/]+$/, '');
}

function prepareObject(object: THREE.Object3D) {
  const clone = object.clone(true);
  const bounds = new THREE.Box3().setFromObject(clone);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  bounds.getCenter(center);
  bounds.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale = 2.4 / maxDim;

  clone.position.sub(center);
  clone.scale.setScalar(scale);
  clone.position.y += (size.y * scale) / 2;

  return clone;
}

export function collectModelStats(object: THREE.Object3D): ModelStats {
  let meshes = 0;
  let faces = 0;
  let vertices = 0;
  const materials = new Set<string>();

  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      meshes += 1;
      const mesh = child as THREE.Mesh;
      const geometry = mesh.geometry;

      const position = geometry.getAttribute('position');
      if (position) {
        vertices += position.count;
      }

      if (geometry.index) {
        faces += geometry.index.count / 3;
      } else if (position) {
        faces += position.count / 3;
      }

      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((item) => materials.add(item.uuid));
      } else if (material) {
        materials.add(material.uuid);
      }
    }
  });

  return {
    meshes,
    faces: Math.round(faces),
    vertices,
    materials: materials.size,
  };
}

interface ParsedMtlMaterial {
  color: THREE.Color;
  opacity: number;
  textureUri?: string;
}

const textureLoader = new TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

function getTexture(textureUri: string) {
  const cached = textureCache.get(textureUri);
  if (cached) {
    return cached;
  }

  try {
    const texture = textureLoader.load(
      textureUri,
      () => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
      },
      undefined,
      () => {
        console.warn('Texture failed to load', textureUri);
        textureCache.delete(textureUri);
      },
    );
    textureCache.set(textureUri, texture);
    return texture;
  } catch (error) {
    console.warn('Texture load threw', textureUri, error);
    return undefined;
  }
}

function parseMapPath(tokens: string[]) {
  if (tokens.length === 0) {
    return null;
  }

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    if (!token.startsWith('-')) {
      const rawPath = tokens.slice(index).join(' ').trim();
      return rawPath.replace(/^['"]|['"]$/g, '');
    }

    if (token === '-o' || token === '-s' || token === '-t') {
      index += 4;
    } else if (token === '-mm') {
      index += 3;
    } else {
      index += 2;
    }
  }

  return null;
}

function normalizeTextureKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveMtlTextureUri(modelFiles: StoredModel['files'], mapPath: string) {
  const cleaned = mapPath.trim().replace(/\\/g, '/');
  if (!cleaned) {
    return undefined;
  }

  const relativeName = cleaned.split('/').pop() ?? cleaned;
  const decodedRelativeName = decodeURIComponent(relativeName);
  const relativeNameLower = decodedRelativeName.toLowerCase();
  const relativeExt = (relativeNameLower.split('.').pop() ?? '').trim();
  const relativeBaseKey = normalizeTextureKey(relativeNameLower.replace(/\.[^.]+$/, ''));

  const exact = modelFiles.find((file) => file.name.toLowerCase() === relativeNameLower);
  if (exact) {
    return exact.uri;
  }

  const fuzzy = modelFiles.find((file) => {
    const fileNameLower = file.name.toLowerCase();
    const fileExt = (fileNameLower.split('.').pop() ?? '').trim();
    if (relativeExt && fileExt && fileExt !== relativeExt) {
      return false;
    }

    const fileBaseKey = normalizeTextureKey(fileNameLower.replace(/\.[^.]+$/, ''));
    return fileBaseKey === relativeBaseKey;
  });

  return fuzzy?.uri;
}

function getSingleImageTextureUri(modelFiles: StoredModel['files']) {
  const images = modelFiles.filter((file) => {
    const ext = file.ext.toLowerCase();
    return ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp';
  });
  if (images.length === 1) {
    return images[0]?.uri;
  }
  return undefined;
}

function parseMtlMaterials(mtlText: string | null, modelFiles: StoredModel['files']): Map<string, ParsedMtlMaterial> {
  const materials = new Map<string, ParsedMtlMaterial>();
  if (!mtlText) {
    return materials;
  }

  const fallbackTextureUri = getSingleImageTextureUri(modelFiles);
  const lines = mtlText.split(/\r?\n/);
  let currentName: string | null = null;
  let currentColor = new THREE.Color(1, 1, 1);
  let currentOpacity = 1;
  let currentTextureUri: string | undefined;

  const commit = () => {
    if (!currentName) {
      return;
    }
    materials.set(currentName, {
      color: currentColor.clone(),
      opacity: Math.max(0, Math.min(1, currentOpacity)),
      textureUri: currentTextureUri ?? fallbackTextureUri,
    });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const [keyword, ...rest] = trimmed.split(/\s+/);
    const keywordLower = keyword.toLowerCase();

    if (keywordLower === 'newmtl') {
      commit();
      currentName = rest.join(' ');
      currentColor = new THREE.Color(1, 1, 1);
      currentOpacity = 1;
      currentTextureUri = undefined;
      continue;
    }

    if (keywordLower === 'kd' && rest.length >= 3) {
      const r = Number.parseFloat(rest[0]);
      const g = Number.parseFloat(rest[1]);
      const b = Number.parseFloat(rest[2]);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
        currentColor = new THREE.Color(r, g, b);
      }
      continue;
    }

    if (keywordLower === 'd' && rest.length >= 1) {
      const d = Number.parseFloat(rest[0]);
      if (Number.isFinite(d)) {
        currentOpacity = d;
      }
      continue;
    }

    if (keywordLower === 'tr' && rest.length >= 1) {
      const tr = Number.parseFloat(rest[0]);
      if (Number.isFinite(tr)) {
        currentOpacity = 1 - tr;
      }
      continue;
    }

    if (keywordLower === 'map_kd' && rest.length >= 1) {
      const mapPath = parseMapPath(rest);
      if (mapPath) {
        currentTextureUri = resolveMtlTextureUri(modelFiles, mapPath) ?? fallbackTextureUri;
      }
    }
  }

  commit();
  return materials;
}

function buildMeshMaterial(source: THREE.Material, parsed?: ParsedMtlMaterial) {
  const map = parsed?.textureUri ? getTexture(parsed.textureUri) : undefined;
  const opacity = parsed?.opacity ?? 1;
  const isTransparent = opacity < 1;

  if (map) {
    const textured = new THREE.MeshBasicMaterial({
      map,
      color: parsed?.color ?? new THREE.Color(1, 1, 1),
      side: THREE.DoubleSide,
      transparent: isTransparent,
      opacity,
    });
    textured.name = source.name;
    return textured;
  }

  const materialColor =
    parsed?.color ??
    ((source as THREE.MeshStandardMaterial).color?.clone?.() ?? new THREE.Color('#d7dbe2'));

  const lit = new THREE.MeshStandardMaterial({
    color: materialColor,
    roughness: 0.9,
    metalness: 0.02,
    side: THREE.DoubleSide,
    transparent: isTransparent,
    opacity,
  });
  lit.name = source.name;
  return lit;
}

function getParsedMaterialByName(parsedMaterials: Map<string, ParsedMtlMaterial>, name?: string) {
  const normalized = name?.trim();
  if (!normalized) {
    return undefined;
  }

  const exact = parsedMaterials.get(normalized);
  if (exact) {
    return exact;
  }

  const normalizedLower = normalized.toLowerCase();
  for (const [key, value] of parsedMaterials.entries()) {
    if (key.toLowerCase() === normalizedLower) {
      return value;
    }
  }
  return undefined;
}

function applyObjMtlMaterials(object: THREE.Object3D, parsedMaterials: Map<string, ParsedMtlMaterial>) {
  const fallbackMaterial = parsedMaterials.size === 1 ? parsedMaterials.values().next().value : undefined;

  object.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) {
      return;
    }

    const mesh = child as THREE.Mesh;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => {
        const parsed = getParsedMaterialByName(parsedMaterials, material.name) ?? fallbackMaterial;
        return buildMeshMaterial(material, parsed);
      });
    } else if (mesh.material) {
      const parsed = getParsedMaterialByName(parsedMaterials, mesh.material.name) ?? fallbackMaterial;
      mesh.material = buildMeshMaterial(mesh.material, parsed);
    }
  });
}

function parseObj(objText: string, mtlText: string | null, modelFiles: StoredModel['files']) {
  const object = new OBJLoader().parse(objText);
  applyObjMtlMaterials(object, parseMtlMaterials(mtlText, modelFiles));
  return object;
}

function parseGltf(gltfText: string, resourcePath: string) {
  return new Promise<THREE.Object3D>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(
      gltfText,
      resourcePath,
      (gltf) => resolve(gltf.scene),
      (error) => reject(error),
    );
  });
}

function parseGlb(glbBytes: Uint8Array, resourcePath: string) {
  return new Promise<THREE.Object3D>((resolve, reject) => {
    const loader = new GLTFLoader();
    const arrayBuffer = glbBytes.buffer.slice(
      glbBytes.byteOffset,
      glbBytes.byteOffset + glbBytes.byteLength,
    ) as ArrayBuffer;
    loader.parse(
      arrayBuffer,
      resourcePath,
      (gltf) => resolve(gltf.scene),
      (error) => reject(error),
    );
  });
}

export async function loadModelObject(model: StoredModel) {
  const ext = (model.primaryUri.split('.').pop() ?? '').toLowerCase();

  let raw: THREE.Object3D;

  if (ext === 'obj') {
    const objText = await FileSystem.readAsStringAsync(model.primaryUri);
    const mtlText = model.mtlUri ? await FileSystem.readAsStringAsync(model.mtlUri) : null;
    raw = parseObj(objText, mtlText, model.files);
  } else if (ext === 'gltf') {
    const gltfText = await FileSystem.readAsStringAsync(model.primaryUri);
    raw = await parseGltf(gltfText, getResourcePath(model.primaryUri));
  } else if (ext === 'glb') {
    const glbBase64 = await FileSystem.readAsStringAsync(model.primaryUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    raw = await parseGlb(toByteArray(glbBase64), getResourcePath(model.primaryUri));
  } else {
    throw new Error(`Unsupported preview format: ${ext}. This app currently previews OBJ/MTL and GLTF/GLB.`);
  }

  const prepared = prepareObject(raw);
  return {
    object: prepared,
    stats: collectModelStats(prepared),
  };
}
