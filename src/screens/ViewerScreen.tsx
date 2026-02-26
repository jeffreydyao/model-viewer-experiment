import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import {
  Appbar,
  Button,
  Dialog,
  Divider,
  List,
  Portal,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';

import { lightingPresets, scenePresets } from '../constants/presets';
import { getFolderPath } from '../services/libraryService';
import { getRecentModels, getSelectedModel, useAppStore } from '../store/useAppStore';
import { ModelViewerCanvas, ViewerEmptyState } from '../components/ModelViewerCanvas';
import { PerformanceOverlay } from '../components/PerformanceOverlay';
import type { LightingId, ModelStats, RuntimeStats, SceneId } from '../types/library';

export function ViewerScreen() {
  const state = useAppStore((store) => store.state);
  const loading = useAppStore((store) => store.loading);
  const importModels = useAppStore((store) => store.importModels);
  const selectModel = useAppStore((store) => store.selectModel);
  const setViewer = useAppStore((store) => store.setViewer);

  const [pickerVisible, setPickerVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [modelStats, setModelStats] = useState<ModelStats | null>(null);
  const [runtimeStats, setRuntimeStats] = useState<RuntimeStats | null>(null);
  const [search, setSearch] = useState('');

  const selected = useMemo(
    () => getSelectedModel(state.models, state.selectedModelId),
    [state.models, state.selectedModelId],
  );

  const recents = useMemo(() => getRecentModels(state.models).slice(0, 10), [state.models]);

  const filteredModels = useMemo(() => {
    if (!search.trim()) {
      return state.models;
    }
    const term = search.toLowerCase();
    return state.models.filter((model) => model.name.toLowerCase().includes(term));
  }, [search, state.models]);

  return (
    <View className="flex-1 bg-slate-950">
      <Appbar.Header>
        <Appbar.Content
          title={selected?.name ?? 'Viewer'}
          subtitle={selected ? `${selected.format.toUpperCase()} preview` : 'Import or select a model'}
        />
        <Appbar.Action icon="file-import-outline" onPress={() => void importModels(selected?.folderId ?? null)} />
        <Appbar.Action icon="view-list" onPress={() => setPickerVisible(true)} />
        <Appbar.Action icon="tune" onPress={() => setSettingsVisible(true)} />
      </Appbar.Header>

      {selected ? (
        <View className="flex-1 px-4 pb-4">
          <View className="relative flex-1">
            <ModelViewerCanvas
              model={selected}
              viewer={state.viewer}
              onModelStats={setModelStats}
              onRuntimeStats={setRuntimeStats}
            />
            {state.viewer.showStats ? (
              <PerformanceOverlay modelStats={modelStats} runtimeStats={runtimeStats} />
            ) : null}
          </View>
          <Text variant="bodySmall" style={{ paddingTop: 12, color: '#CBD5E1' }}>
            Gesture controls: one-finger orbit, two-finger pan, pinch to zoom.
          </Text>
        </View>
      ) : (
        <ViewerEmptyState
          loading={loading}
          message="Import an OBJ/MTL pair (or GLTF/GLB) from the toolbar, then open model picker to preview it."
        />
      )}

      <Portal>
        <Dialog visible={pickerVisible} onDismiss={() => setPickerVisible(false)} style={{ maxHeight: '80%' }}>
          <Dialog.Title>Switch Model</Dialog.Title>
          <Dialog.Content>
            <TextInput
              value={search}
              onChangeText={setSearch}
              mode="outlined"
              placeholder="Search models"
              style={{ marginBottom: 8 }}
            />
            <Text variant="labelMedium">Recent</Text>
            <ScrollView style={{ maxHeight: 150 }}>
              {recents.map((model) => (
                <List.Item
                  key={`recent-${model.id}`}
                  title={model.name}
                  description={getFolderPath(model.folderId, state.folders)}
                  onPress={() => {
                    void selectModel(model.id);
                    setPickerVisible(false);
                  }}
                  right={() =>
                    model.id === state.selectedModelId ? (
                      <Text style={{ alignSelf: 'center', color: '#4ADE80' }}>Active</Text>
                    ) : null
                  }
                />
              ))}
            </ScrollView>
            <Divider style={{ marginVertical: 8 }} />
            <Text variant="labelMedium">All Models</Text>
            <ScrollView style={{ maxHeight: 260 }}>
              {filteredModels.map((model) => (
                <List.Item
                  key={model.id}
                  title={model.name}
                  description={`${model.format.toUpperCase()} • ${getFolderPath(model.folderId, state.folders)}`}
                  onPress={() => {
                    void selectModel(model.id);
                    setPickerVisible(false);
                  }}
                />
              ))}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setPickerVisible(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={settingsVisible} onDismiss={() => setSettingsVisible(false)} style={{ maxHeight: '88%' }}>
          <Dialog.Title>Viewer Settings</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView>
              <View style={{ paddingHorizontal: 24, paddingBottom: 16, rowGap: 20 }}>
                <View>
                  <Text variant="labelLarge" style={{ paddingBottom: 8 }}>
                    Scene
                  </Text>
                  <SegmentedButtons
                    value={state.viewer.sceneId}
                    onValueChange={(value) =>
                      void setViewer({
                        ...state.viewer,
                        sceneId: value as SceneId,
                      })
                    }
                    buttons={Object.entries(scenePresets).map(([value, preset]) => ({
                      value,
                      label: preset.label,
                    }))}
                  />
                </View>

                <View>
                  <Text variant="labelLarge" style={{ paddingBottom: 8 }}>
                    Lighting
                  </Text>
                  <SegmentedButtons
                    value={state.viewer.lightingId}
                    onValueChange={(value) =>
                      void setViewer({
                        ...state.viewer,
                        lightingId: value as LightingId,
                      })
                    }
                    buttons={Object.entries(lightingPresets).map(([value, preset]) => ({
                      value,
                      label: preset.label,
                    }))}
                  />
                </View>

                <List.Item
                  title="Show debug overlay"
                  right={() => (
                    <Switch
                      value={state.viewer.showStats}
                      onValueChange={(value) => void setViewer({ ...state.viewer, showStats: value })}
                    />
                  )}
                />
                <List.Item
                  title="Show grid"
                  right={() => (
                    <Switch
                      value={state.viewer.showGrid}
                      onValueChange={(value) => void setViewer({ ...state.viewer, showGrid: value })}
                    />
                  )}
                />
                <List.Item
                  title="Show axes"
                  right={() => (
                    <Switch
                      value={state.viewer.showAxes}
                      onValueChange={(value) => void setViewer({ ...state.viewer, showAxes: value })}
                    />
                  )}
                />
                <List.Item
                  title="Wireframe"
                  right={() => (
                    <Switch
                      value={state.viewer.wireframe}
                      onValueChange={(value) => void setViewer({ ...state.viewer, wireframe: value })}
                    />
                  )}
                />
                <List.Item
                  title="Auto-rotate"
                  right={() => (
                    <Switch
                      value={state.viewer.autoRotate}
                      onValueChange={(value) => void setViewer({ ...state.viewer, autoRotate: value })}
                    />
                  )}
                />
              </View>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setSettingsVisible(false)}>Done</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
