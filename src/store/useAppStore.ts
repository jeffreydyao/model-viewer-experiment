import { create } from 'zustand';

import type { FolderEntry, PersistedLibraryState, StoredModel, ViewerPreferences } from '../types/library';
import {
  createFolder,
  deleteFolder,
  deleteModel,
  importFromDocumentPicker,
  loadState,
  moveModel,
  renameFolder,
  renameModel,
  setSelectedModel,
  subscribeLibraryChanges,
  updateViewerPreferences,
} from '../services/libraryService';
import { getLocalServerStatus, startLocalServer } from '../services/localServer';

interface AppStoreState {
  initialized: boolean;
  loading: boolean;
  error: string | null;
  state: PersistedLibraryState;
  serverStatus: ReturnType<typeof getLocalServerStatus>;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  importModels: (folderId?: string | null) => Promise<void>;
  selectModel: (modelId: string | null) => Promise<void>;
  setViewer: (viewer: ViewerPreferences) => Promise<void>;
  renameModel: (modelId: string, name: string) => Promise<void>;
  moveModel: (modelId: string, folderId: string | null) => Promise<void>;
  deleteModel: (modelId: string) => Promise<void>;
  createFolder: (name: string, parentId?: string | null) => Promise<void>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
}

const initialState: PersistedLibraryState = {
  version: 1,
  selectedModelId: null,
  models: [],
  folders: [],
  viewer: {
    sceneId: 'white',
    lightingId: 'balanced',
    showGrid: true,
    wireframe: false,
    autoRotate: false,
    showStats: true,
    showAxes: false,
  },
};

export const useAppStore = create<AppStoreState>((set, get) => ({
  initialized: false,
  loading: false,
  error: null,
  state: initialState,
  serverStatus: getLocalServerStatus(),

  initialize: async () => {
    if (get().initialized) {
      return;
    }

    set({ loading: true, error: null });

    try {
      const loaded = await loadState();
      const serverStatus = await startLocalServer();

      set({
        state: loaded,
        serverStatus,
        initialized: true,
        loading: false,
      });

      subscribeLibraryChanges(() => {
        void get().refresh();
      });
    } catch (error) {
      set({
        loading: false,
        initialized: true,
        error: error instanceof Error ? error.message : 'Failed to initialize app',
      });
    }
  },

  refresh: async () => {
    const loaded = await loadState();
    set({ state: loaded, serverStatus: getLocalServerStatus() });
  },

  importModels: async (folderId = null) => {
    set({ loading: true, error: null });
    try {
      await importFromDocumentPicker(folderId);
      const loaded = await loadState();
      set({ loading: false, state: loaded });
    } catch (error) {
      set({ loading: false, error: error instanceof Error ? error.message : 'Import failed' });
    }
  },

  selectModel: async (modelId) => {
    await setSelectedModel(modelId);
    const loaded = await loadState();
    set({ state: loaded });
  },

  setViewer: async (viewer) => {
    const nextState = await updateViewerPreferences(viewer);
    set({ state: nextState });
  },

  renameModel: async (modelId, name) => {
    const nextState = await renameModel(modelId, name);
    set({ state: nextState });
  },

  moveModel: async (modelId, folderId) => {
    const nextState = await moveModel(modelId, folderId);
    set({ state: nextState });
  },

  deleteModel: async (modelId) => {
    const nextState = await deleteModel(modelId);
    set({ state: nextState });
  },

  createFolder: async (name, parentId = null) => {
    await createFolder(name, parentId);
    const loaded = await loadState();
    set({ state: loaded });
  },

  renameFolder: async (folderId, name) => {
    const nextState = await renameFolder(folderId, name);
    set({ state: nextState });
  },

  deleteFolder: async (folderId) => {
    try {
      const nextState = await deleteFolder(folderId);
      set({ state: nextState, error: null });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Unable to delete folder' });
    }
  },
}));

export function getSelectedModel(models: StoredModel[], selectedModelId: string | null) {
  return models.find((model) => model.id === selectedModelId) ?? null;
}

export function getRecentModels(models: StoredModel[]) {
  return [...models].sort((left, right) => {
    const leftScore = left.lastViewedAt ?? left.createdAt;
    const rightScore = right.lastViewedAt ?? right.createdAt;
    return rightScore.localeCompare(leftScore);
  });
}

export function getFoldersByParent(folders: FolderEntry[], parentId: string | null) {
  return folders.filter((folder) => folder.parentId === parentId);
}
