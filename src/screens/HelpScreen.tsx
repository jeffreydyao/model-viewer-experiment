import { ScrollView, View } from 'react-native';
import { Appbar, Card, List, Text } from 'react-native-paper';

export function HelpScreen() {
  return (
    <View className="flex-1 bg-slate-950">
      <Appbar.Header>
        <Appbar.Content title="Help" subtitle="Model import, controls, and troubleshooting" />
      </Appbar.Header>

      <ScrollView className="flex-1 px-4 py-4">
        <Card mode="contained" style={{ marginBottom: 16 }}>
          <Card.Title title="Supported files" />
          <Card.Content>
            <Text variant="bodyMedium">Primary workflow: MagicaVoxel OBJ + MTL pairs.</Text>
            <Text variant="bodyMedium">Also importable: GLTF/GLB (single-file previews).</Text>
            <Text variant="bodySmall" style={{ paddingTop: 8, color: '#CBD5E1' }}>
              Keep related textures beside the model before importing for best material loading.
            </Text>
          </Card.Content>
        </Card>

        <Card mode="contained" style={{ marginBottom: 16 }}>
          <Card.Title title="Touch controls" />
          <Card.Content>
            <List.Item title="Orbit" description="Drag with one finger" left={(props) => <List.Icon {...props} icon="gesture-tap-hold" />} />
            <List.Item title="Pan" description="Drag with two fingers" left={(props) => <List.Icon {...props} icon="gesture-swipe-horizontal" />} />
            <List.Item title="Zoom" description="Pinch in/out" left={(props) => <List.Icon {...props} icon="magnify-plus-outline" />} />
          </Card.Content>
        </Card>

        <Card mode="contained" style={{ marginBottom: 16 }}>
          <Card.Title title="Performance debugging" />
          <Card.Content>
            <Text variant="bodyMedium">
              Toggle the debug overlay in Viewer Settings to inspect live FPS, draw calls, faces, vertices, meshes, and materials.
            </Text>
            <Text variant="bodySmall" style={{ paddingTop: 8, color: '#CBD5E1' }}>
              Use White Studio and Flat lighting for neutral geometry checks. Use Garden and Night for stress testing shading and contrast.
            </Text>
          </Card.Content>
        </Card>

        <Card mode="contained">
          <Card.Title title="Local server tips" />
          <Card.Content>
            <Text variant="bodyMedium">If `model-viewer.local` does not resolve, open the IP URL from the Server tab.</Text>
            <Text variant="bodyMedium">Keep phone and workstation on the same Wi-Fi network.</Text>
            <Text variant="bodyMedium">Deleting the currently viewed model automatically selects another model (or none).</Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}
