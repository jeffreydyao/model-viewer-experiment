import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import type { FolderEntry, ModelFormat, PersistedLibraryState, StoredModel, StoredModelFile, ViewerPreferences } from '../types/library';

const appDir = `${FileSystem.documentDirectory ?? ''}voxel-garden-viewer/`;
const filesDir = `${appDir}models/`;
const statePath = `${appDir}state.json`;

const listeners = new Set<() => void>();

const defaultViewer: ViewerPreferences = {
  sceneId: 'white',
  lightingId: 'balanced',
  showGrid: true,
  wireframe: false,
  autoRotate: false,
  showStats: true,
  showAxes: false,
};

const emptyState: PersistedLibraryState = {
  version: 1,
  selectedModelId: null,
  models: [],
  folders: [],
  viewer: defaultViewer,
};

interface IncomingModelFile {
  name: string;
  sourceUri?: string;
  base64?: string;
}

function nowIso() {
  return new Date().toISOString();
}

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeExt(name: string) {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return (match?.[1] ?? '').toLowerCase();
}

function stripExt(name: string) {
  return name.replace(/\.[^/.]+$/, '');
}

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function dedupeName(baseName: string, used: Set<string>) {
  let nextName = baseName;
  let index = 2;
  while (used.has(nextName.toLowerCase())) {
    nextName = `${baseName} (${index})`;
    index += 1;
  }
  used.add(nextName.toLowerCase());
  return nextName;
}

function inferFormat(primaryExt: string, hasMtl: boolean): ModelFormat {
  if (primaryExt === 'obj' && hasMtl) {
    return 'obj-mtl';
  }
  if (primaryExt === 'obj') {
    return 'obj';
  }
  if (primaryExt === 'glb') {
    return 'glb';
  }
  if (primaryExt === 'gltf') {
    return 'gltf';
  }
  if (primaryExt === 'fbx') {
    return 'fbx';
  }
  return 'unknown';
}

function getGroupKey(fileName: string) {
  return stripExt(fileName).toLowerCase();
}

function parseMapPath(tokens: string[]) {
  if (tokens.length === 0) {
    return null;
  }

  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index] ?? '';
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

function normalizeLookupName(value: string) {
  return decodeURIComponent(value)
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    ?.toLowerCase()
    .trim() ?? '';
}

function normalizeLookupBase(value: string) {
  return stripExt(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeLookupExt(value: string) {
  const normalized = normalizeLookupName(value);
  return normalizeExt(normalized);
}

function extractMtlTextureRefs(mtlText: string) {
  const refs = new Set<string>();
  for (const line of mtlText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const [keyword, ...rest] = trimmed.split(/\s+/);
    const keywordLower = keyword.toLowerCase();
    if (keywordLower !== 'map_kd') {
      continue;
    }

    const mapPath = parseMapPath(rest);
    if (mapPath) {
      refs.add(normalizeLookupName(mapPath));
    }
  }
  return [...refs];
}

function matchesTextureRef(fileName: string, textureRef: string) {
  const fileLookup = normalizeLookupName(fileName);
  const refLookup = normalizeLookupName(textureRef);
  if (!fileLookup || !refLookup) {
    return false;
  }

  if (fileLookup === refLookup) {
    return true;
  }

  const fileExt = normalizeLookupExt(fileLookup);
  const refExt = normalizeLookupExt(refLookup);
  if (fileExt && refExt && fileExt !== refExt) {
    return false;
  }

  return normalizeLookupBase(fileLookup) === normalizeLookupBase(refLookup);
}

async function resolveSiblingTextureUri(mtlSourceUri: string, textureRef: string) {
  const normalizedRef = textureRef.replace(/\\/g, '/').trim();
  if (!normalizedRef) {
    return undefined;
  }

  const sourceDir = mtlSourceUri.replace(/[^/]+$/, '');
  const decodedDir = decodeURIComponent(sourceDir);
  const decodedRef = decodeURIComponent(normalizedRef);
  const encodedRef = encodeURIComponent(decodedRef).replace(/%2F/g, '/');

  const candidates = [
    `${sourceDir}${normalizedRef}`,
    `${sourceDir}${encodedRef}`,
    `${decodedDir}${decodedRef}`,
  ];

  for (const candidate of candidates) {
    try {
      const info = await FileSystem.getInfoAsync(candidate);
      if (info.exists) {
        return candidate;
      }
    } catch {
      // continue
    }
  }

  return undefined;
}

async function resolveObjGroupFiles(groupedFiles: IncomingModelFile[], allFiles: IncomingModelFile[]) {
  const resolved = [...groupedFiles];
  const seen = new Set(groupedFiles);
  let missingTextureRefCount = 0;

  const mtlFiles = groupedFiles.filter((file) => normalizeExt(file.name) === 'mtl' && file.sourceUri);
  for (const mtlFile of mtlFiles) {
    if (!mtlFile.sourceUri) {
      continue;
    }

    let mtlText = '';
    try {
      mtlText = await FileSystem.readAsStringAsync(mtlFile.sourceUri);
    } catch {
      continue;
    }

    const refs = extractMtlTextureRefs(mtlText);
    for (const ref of refs) {
      const fromSelection = allFiles.find((file) => !seen.has(file) && matchesTextureRef(file.name, ref));
      if (fromSelection) {
        seen.add(fromSelection);
        resolved.push(fromSelection);
        continue;
      }

      const siblingUri = await resolveSiblingTextureUri(mtlFile.sourceUri, ref);
      if (!siblingUri) {
        missingTextureRefCount += 1;
        continue;
      }

      const siblingName = normalizeLookupName(ref);
      if (!siblingName) {
        continue;
      }

      const siblingFile: IncomingModelFile = {
        name: siblingName,
        sourceUri: siblingUri,
      };
      seen.add(siblingFile);
      resolved.push(siblingFile);
    }
  }

  if (missingTextureRefCount > 0) {
    const extraImages = allFiles.filter((file) => {
      if (seen.has(file)) {
        return false;
      }
      const ext = normalizeExt(file.name);
      return ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'webp';
    });

    if (extraImages.length === 1) {
      seen.add(extraImages[0]);
      resolved.push(extraImages[0]);
    }
  }

  return resolved;
}

export function getStatePaths() {
  return {
    appDir,
    filesDir,
    statePath,
  };
}

export function subscribeLibraryChanges(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emitLibraryChanged() {
  listeners.forEach((listener) => listener());
}

async function ensureDir(uri: string) {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(uri, { intermediates: true });
  }
}

export async function ensureInitialized() {
  await ensureDir(appDir);
  await ensureDir(filesDir);

  const stateInfo = await FileSystem.getInfoAsync(statePath);
  if (!stateInfo.exists) {
    await FileSystem.writeAsStringAsync(statePath, JSON.stringify(emptyState, null, 2));
  }
}

function normalizeState(state: Partial<PersistedLibraryState>): PersistedLibraryState {
  const merged: PersistedLibraryState = {
    ...emptyState,
    ...state,
    viewer: {
      ...defaultViewer,
      ...(state.viewer ?? {}),
    },
    folders: (state.folders ?? []).map((folder) => ({
      ...folder,
      parentId: folder.parentId ?? null,
    })),
    models: (state.models ?? []).map((model) => ({
      ...model,
      folderId: model.folderId ?? null,
      mtlUri: model.mtlUri ?? null,
      lastViewedAt: model.lastViewedAt ?? null,
    })),
  };

  if (merged.selectedModelId && !merged.models.some((model) => model.id === merged.selectedModelId)) {
    merged.selectedModelId = null;
  }

  return merged;
}

export async function loadState() {
  await ensureInitialized();
  const raw = await FileSystem.readAsStringAsync(statePath);
  const parsed = JSON.parse(raw) as Partial<PersistedLibraryState>;
  const normalized = normalizeState(parsed);
  if (JSON.stringify(parsed) !== JSON.stringify(normalized)) {
    await saveState(normalized);
  }
  return normalized;
}

export async function saveState(state: PersistedLibraryState) {
  await FileSystem.writeAsStringAsync(statePath, JSON.stringify(state, null, 2));
}

async function writeIncomingFile(targetUri: string, file: IncomingModelFile) {
  if (file.sourceUri) {
    await FileSystem.copyAsync({ from: file.sourceUri, to: targetUri });
    return;
  }
  if (file.base64) {
    await FileSystem.writeAsStringAsync(targetUri, file.base64, { encoding: FileSystem.EncodingType.Base64 });
    return;
  }
  throw new Error(`File ${file.name} has no content source.`);
}

async function createModelEntryFromFiles(args: {
  groupName: string;
  folderId: string | null;
  files: IncomingModelFile[];
  usedNames: Set<string>;
}) {
  const { groupName, files, folderId, usedNames } = args;
  const modelId = randomId();
  const modelDir = `${filesDir}${modelId}/`;
  await ensureDir(modelDir);

  const storedFiles: StoredModelFile[] = [];
  for (const incomingFile of files) {
    const safeName = sanitizeFileName(incomingFile.name);
    const targetUri = `${modelDir}${safeName}`;
    await writeIncomingFile(targetUri, incomingFile);
    storedFiles.push({
      name: safeName,
      ext: normalizeExt(safeName),
      uri: targetUri,
    });
  }

  const objFile = storedFiles.find((file) => file.ext === 'obj');
  const mtlFile = storedFiles.find((file) => file.ext === 'mtl') ?? null;
  const primary = objFile ?? storedFiles[0];
  const format = inferFormat(primary.ext, Boolean(objFile && mtlFile));

  const createdAt = nowIso();
  const model: StoredModel = {
    id: modelId,
    name: dedupeName(groupName, usedNames),
    folderId,
    format,
    createdAt,
    updatedAt: createdAt,
    lastViewedAt: null,
    primaryUri: primary.uri,
    mtlUri: mtlFile?.uri ?? null,
    files: storedFiles,
  };

  return model;
}

export async function importIncomingFiles(files: IncomingModelFile[], folderId: string | null = null) {
  if (files.length === 0) {
    return [] as StoredModel[];
  }

  const state = await loadState();
  const grouped = new Map<string, IncomingModelFile[]>();

  for (const file of files) {
    const key = getGroupKey(file.name);
    const next = grouped.get(key) ?? [];
    next.push(file);
    grouped.set(key, next);
  }

  const usedNames = new Set(state.models.map((model) => model.name.toLowerCase()));
  const imported: StoredModel[] = [];
  const consumed = new Set<IncomingModelFile>();

  for (const [groupKey, groupedFiles] of grouped.entries()) {
    if (groupedFiles.every((file) => normalizeExt(file.name) !== 'obj')) {
      continue;
    }

    const resolvedFiles = await resolveObjGroupFiles(groupedFiles, files);
    resolvedFiles.forEach((file) => consumed.add(file));

    const model = await createModelEntryFromFiles({
      groupName: stripExt(groupedFiles.find((file) => normalizeExt(file.name) === 'obj')?.name ?? groupKey),
      folderId,
      files: resolvedFiles,
      usedNames,
    });
    imported.push(model);
  }

  for (const [_, groupedFiles] of grouped.entries()) {
    for (const file of groupedFiles) {
      if (consumed.has(file)) {
        continue;
      }

      const model = await createModelEntryFromFiles({
        groupName: stripExt(file.name),
        folderId,
        files: [file],
        usedNames,
      });
      imported.push(model);
      consumed.add(file);
    }
  }

  const nextState: PersistedLibraryState = {
    ...state,
    models: [...imported, ...state.models],
  };
  if (!nextState.selectedModelId && imported[0]) {
    nextState.selectedModelId = imported[0].id;
  }

  await saveState(nextState);
  emitLibraryChanged();

  return imported;
}

export async function importFromDocumentPicker(folderId: string | null = null) {
  const result = await DocumentPicker.getDocumentAsync({
    multiple: true,
    copyToCacheDirectory: true,
    type: '*/*',
  });

  if (result.canceled) {
    return [] as StoredModel[];
  }

  const incoming = result.assets.map((asset) => ({
    name: asset.name,
    sourceUri: asset.uri,
  }));

  return importIncomingFiles(incoming, folderId);
}

export async function updateViewerPreferences(nextViewer: ViewerPreferences) {
  const state = await loadState();
  const nextState: PersistedLibraryState = {
    ...state,
    viewer: nextViewer,
  };
  await saveState(nextState);
  emitLibraryChanged();
  return nextState;
}

export async function setSelectedModel(modelId: string | null) {
  const state = await loadState();
  const model = modelId ? state.models.find((item) => item.id === modelId) : null;
  const nextModels = model
    ? state.models.map((item) =>
        item.id === model.id
          ? {
              ...item,
              lastViewedAt: nowIso(),
              updatedAt: nowIso(),
            }
          : item,
      )
    : state.models;
  const nextState: PersistedLibraryState = {
    ...state,
    selectedModelId: model?.id ?? null,
    models: nextModels,
  };

  await saveState(nextState);
  emitLibraryChanged();
  return nextState;
}

async function removeModelFiles(model: StoredModel) {
  const directory = model.primaryUri.replace(/[^/]+$/, '');
  const info = await FileSystem.getInfoAsync(directory);
  if (info.exists) {
    await FileSystem.deleteAsync(directory, { idempotent: true });
  }
}

export async function renameModel(modelId: string, name: string) {
  const state = await loadState();
  const nextModels = state.models.map((model) =>
    model.id === modelId
      ? {
          ...model,
          name,
          updatedAt: nowIso(),
        }
      : model,
  );
  const nextState: PersistedLibraryState = {
    ...state,
    models: nextModels,
  };
  await saveState(nextState);
  emitLibraryChanged();
  return nextState;
}

export async function moveModel(modelId: string, folderId: string | null) {
  const state = await loadState();
  const nextModels = state.models.map((model) =>
    model.id === modelId
      ? {
          ...model,
          folderId,
          updatedAt: nowIso(),
        }
      : model,
  );
  const nextState: PersistedLibraryState = {
    ...state,
    models: nextModels,
  };
  await saveState(nextState);
  emitLibraryChanged();
  return nextState;
}

export async function deleteModel(modelId: string) {
  const state = await loadState();
  const found = state.models.find((model) => model.id === modelId);
  if (!found) {
    return state;
  }
  await removeModelFiles(found);

  const nextModels = state.models.filter((model) => model.id !== modelId);
  const nextSelectedModelId =
    state.selectedModelId === modelId ? nextModels[0]?.id ?? null : state.selectedModelId;

  const nextState: PersistedLibraryState = {
    ...state,
    models: nextModels,
    selectedModelId: nextSelectedModelId,
  };
  await saveState(nextState);
  emitLibraryChanged();
  return nextState;
}

export async function createFolder(name: string, parentId: string | null = null) {
  const state = await loadState();
  const now = nowIso();
  const folder: FolderEntry = {
    id: randomId(),
    name,
    parentId,
    createdAt: now,
    updatedAt: now,
  };
  const nextState: PersistedLibraryState = {
    ...state,
    folders: [folder, ...state.folders],
  };
  await saveState(nextState);
  emitLibraryChanged();
  return folder;
}

export async function renameFolder(folderId: string, name: string) {
  const state = await loadState();
  const nextFolders = state.folders.map((folder) =>
    folder.id === folderId
      ? {
          ...folder,
          name,
          updatedAt: nowIso(),
        }
      : folder,
  );
  const nextState: PersistedLibraryState = {
    ...state,
    folders: nextFolders,
  };
  await saveState(nextState);
  emitLibraryChanged();
  return nextState;
}

export async function deleteFolder(folderId: string) {
  const state = await loadState();
  const hasChildFolder = state.folders.some((folder) => folder.parentId === folderId);
  if (hasChildFolder) {
    throw new Error('Folder has subfolders. Move or delete them first.');
  }
  const hasModels = state.models.some((model) => model.folderId === folderId);
  if (hasModels) {
    throw new Error('Folder has models. Move or delete them first.');
  }

  const nextState: PersistedLibraryState = {
    ...state,
    folders: state.folders.filter((folder) => folder.id !== folderId),
  };
  await saveState(nextState);
  emitLibraryChanged();
  return nextState;
}

export function getFolderPath(folderId: string | null, folders: FolderEntry[]) {
  if (!folderId) {
    return 'Root';
  }

  const path: string[] = [];
  let current = folders.find((folder) => folder.id === folderId);
  while (current) {
    path.unshift(current.name);
    current = folders.find((folder) => folder.id === current?.parentId);
  }

  return path.length === 0 ? 'Root' : path.join(' / ');
}
