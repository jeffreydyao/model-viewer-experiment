import { useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import {
  Appbar,
  Button,
  Dialog,
  FAB,
  List,
  Menu,
  Portal,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';

import { getFolderPath } from '../services/libraryService';
import { getRecentModels, useAppStore } from '../store/useAppStore';
import type { StoredModel } from '../types/library';

interface ModelActionsProps {
  model: StoredModel;
  onRename: () => void;
  onDelete: () => void;
  onMove: () => void;
  onOpen: () => void;
}

function ModelActionsMenu({ model, onRename, onDelete, onMove, onOpen }: ModelActionsProps) {
  const [visible, setVisible] = useState(false);

  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <Button compact onPress={() => setVisible(true)}>
          Actions
        </Button>
      }
    >
      <Menu.Item
        onPress={() => {
          setVisible(false);
          onOpen();
        }}
        title={`Open ${model.name}`}
        leadingIcon="cube-outline"
      />
      <Menu.Item
        onPress={() => {
          setVisible(false);
          onMove();
        }}
        title="Move"
        leadingIcon="folder-move-outline"
      />
      <Menu.Item
        onPress={() => {
          setVisible(false);
          onRename();
        }}
        title="Rename"
        leadingIcon="pencil"
      />
      <Menu.Item
        onPress={() => {
          setVisible(false);
          onDelete();
        }}
        title="Delete"
        leadingIcon="delete-outline"
      />
    </Menu>
  );
}

export function LibraryScreen() {
  const state = useAppStore((store) => store.state);
  const error = useAppStore((store) => store.error);
  const importModels = useAppStore((store) => store.importModels);
  const selectModel = useAppStore((store) => store.selectModel);
  const renameModel = useAppStore((store) => store.renameModel);
  const deleteModel = useAppStore((store) => store.deleteModel);
  const moveModel = useAppStore((store) => store.moveModel);
  const createFolder = useAppStore((store) => store.createFolder);
  const renameFolder = useAppStore((store) => store.renameFolder);
  const deleteFolder = useAppStore((store) => store.deleteFolder);

  const [tab, setTab] = useState('all');
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [moveModelId, setMoveModelId] = useState<string | null>(null);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameTargetType, setRenameTargetType] = useState<'model' | 'folder'>('model');
  const [renameValue, setRenameValue] = useState('');

  const recent = useMemo(() => getRecentModels(state.models).slice(0, 12), [state.models]);

  const models = tab === 'recent' ? recent : state.models;

  return (
    <View className="flex-1 bg-slate-950">
      <Appbar.Header>
        <Appbar.Content
          title="Model Library"
          subtitle={`${state.models.length} model${state.models.length === 1 ? '' : 's'}`}
        />
        <Appbar.Action icon="file-import-outline" onPress={() => void importModels()} />
      </Appbar.Header>

      <View className="px-4 pt-3">
        <SegmentedButtons
          value={tab}
          onValueChange={setTab}
          buttons={[
            { value: 'all', label: 'All Models' },
            { value: 'recent', label: 'Recent' },
          ]}
        />
      </View>

      <ScrollView className="flex-1 px-4 pb-24 pt-3">
        {error ? <Text style={{ color: '#FCA5A5', paddingBottom: 12 }}>{error}</Text> : null}

        {tab === 'all' ? (
          <List.Section>
            <List.Subheader>Folders</List.Subheader>
            {state.folders.map((folder) => (
              <List.Item
                key={folder.id}
                title={folder.name}
                description={getFolderPath(folder.parentId, state.folders)}
                left={(props) => <List.Icon {...props} icon="folder-outline" />}
                right={() => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Button
                      compact
                      onPress={() => {
                        setRenameTargetType('folder');
                        setRenameTargetId(folder.id);
                        setRenameValue(folder.name);
                        setRenameDialogOpen(true);
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      compact
                      onPress={() => {
                        Alert.alert('Delete folder', 'Delete this folder? It must be empty.', [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => {
                              void deleteFolder(folder.id);
                            },
                          },
                        ]);
                      }}
                    >
                      Delete
                    </Button>
                  </View>
                )}
              />
            ))}
            {state.folders.length === 0 ? (
              <Text style={{ paddingHorizontal: 16, color: '#CBD5E1' }}>
                No folders yet. Create one to organize model groups.
              </Text>
            ) : null}
          </List.Section>
        ) : null}

        <List.Section>
          <List.Subheader>{tab === 'recent' ? 'Most Recent' : 'Models'}</List.Subheader>
          {models.map((model) => (
            <List.Item
              key={model.id}
              title={model.name}
              description={`${model.format.toUpperCase()} • ${getFolderPath(model.folderId, state.folders)}`}
              left={(props) => <List.Icon {...props} icon="cube-outline" />}
              right={() => (
                <ModelActionsMenu
                  model={model}
                  onOpen={() => {
                    void selectModel(model.id);
                  }}
                  onMove={() => {
                    setMoveModelId(model.id);
                    setMoveDialogOpen(true);
                  }}
                  onRename={() => {
                    setRenameTargetType('model');
                    setRenameTargetId(model.id);
                    setRenameValue(model.name);
                    setRenameDialogOpen(true);
                  }}
                  onDelete={() => {
                    Alert.alert('Delete model', `Delete ${model.name}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => {
                          void deleteModel(model.id);
                        },
                      },
                    ]);
                  }}
                />
              )}
            />
          ))}
          {models.length === 0 ? (
            <Text style={{ paddingHorizontal: 16, color: '#CBD5E1' }}>
              No models in this list. Import from the toolbar or use the local server web uploader.
            </Text>
          ) : null}
        </List.Section>
      </ScrollView>

      <FAB
        icon="folder-plus-outline"
        style={{ position: 'absolute', right: 24, bottom: 24 }}
        onPress={() => setFolderDialogOpen(true)}
      />

      <Portal>
        <Dialog visible={folderDialogOpen} onDismiss={() => setFolderDialogOpen(false)}>
          <Dialog.Title>Create folder</Dialog.Title>
          <Dialog.Content>
            <TextInput value={folderName} onChangeText={setFolderName} mode="outlined" label="Folder name" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setFolderDialogOpen(false)}>Cancel</Button>
            <Button
              onPress={() => {
                if (folderName.trim()) {
                  void createFolder(folderName.trim());
                  setFolderName('');
                  setFolderDialogOpen(false);
                }
              }}
            >
              Create
            </Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={moveDialogOpen} onDismiss={() => setMoveDialogOpen(false)}>
          <Dialog.Title>Move model</Dialog.Title>
          <Dialog.Content>
            <Text style={{ paddingBottom: 8 }}>Choose destination folder.</Text>
            <Button
              mode="outlined"
              style={{ marginBottom: 8 }}
              onPress={() => {
                if (moveModelId) {
                  void moveModel(moveModelId, null);
                }
                setMoveDialogOpen(false);
              }}
            >
              Move to Root
            </Button>
            {state.folders.map((folder) => (
              <Button
                key={`move-${folder.id}`}
                mode="outlined"
                style={{ marginBottom: 8 }}
                onPress={() => {
                  if (moveModelId) {
                    void moveModel(moveModelId, folder.id);
                  }
                  setMoveDialogOpen(false);
                }}
              >
                {folder.name}
              </Button>
            ))}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setMoveDialogOpen(false)}>Close</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={renameDialogOpen} onDismiss={() => setRenameDialogOpen(false)}>
          <Dialog.Title>{renameTargetType === 'model' ? 'Rename model' : 'Rename folder'}</Dialog.Title>
          <Dialog.Content>
            <TextInput value={renameValue} onChangeText={setRenameValue} mode="outlined" label="Name" />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setRenameDialogOpen(false)}>Cancel</Button>
            <Button
              onPress={() => {
                if (!renameTargetId || !renameValue.trim()) {
                  return;
                }
                if (renameTargetType === 'model') {
                  void renameModel(renameTargetId, renameValue.trim());
                } else {
                  void renameFolder(renameTargetId, renameValue.trim());
                }
                setRenameDialogOpen(false);
              }}
            >
              Save
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}
