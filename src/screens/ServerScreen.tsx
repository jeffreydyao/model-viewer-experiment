import { ScrollView, View } from 'react-native';
import { Appbar, Card, Divider, List, Text } from 'react-native-paper';

import { useAppStore } from '../store/useAppStore';

export function ServerScreen() {
  const serverStatus = useAppStore((state) => state.serverStatus);

  return (
    <View className="flex-1 bg-slate-950">
      <Appbar.Header>
        <Appbar.Content title="Local Server" subtitle={serverStatus.isRunning ? 'Running' : 'Stopped'} />
      </Appbar.Header>

      <ScrollView className="flex-1 px-4 py-4">
        <Card mode="contained" style={{ marginBottom: 16 }}>
          <Card.Title title="Connection" subtitle="Expose model uploads and API on your LAN" />
          <Card.Content>
            <Text variant="bodyLarge">Alias: {serverStatus.aliasUrl}</Text>
            <Text variant="bodyLarge">IP: {serverStatus.ipUrl ?? 'Unavailable (not connected to Wi-Fi/LAN)'}</Text>
            <Text variant="bodySmall" style={{ paddingTop: 8, color: '#CBD5E1' }}>
              The app starts this server automatically on launch. If mDNS is supported on your network, open the alias URL directly.
            </Text>
            {serverStatus.error ? (
              <Text variant="bodySmall" style={{ paddingTop: 8, color: '#FCD34D' }}>
                mDNS note: {serverStatus.error}
              </Text>
            ) : null}
          </Card.Content>
        </Card>

        <Card mode="contained" style={{ marginBottom: 16 }}>
          <Card.Title title="Browser UI" subtitle="Material UI upload + library manager" />
          <Card.Content>
            <Text variant="bodyMedium">1. Open a browser on the same network.</Text>
            <Text variant="bodyMedium">2. Visit alias URL first: {serverStatus.aliasUrl}</Text>
            <Text variant="bodyMedium">3. If alias fails, use IP URL shown above.</Text>
            <Text variant="bodyMedium">4. Drag and drop OBJ + MTL files to upload instantly.</Text>
          </Card.Content>
        </Card>

        <Card mode="contained">
          <Card.Title title="HTTP API" subtitle="OpenAPI discoverable for coding agents" />
          <Card.Content>
            <List.Item
              title="GET /api/openapi.json"
              description="OpenAPI 3.1 spec for all endpoints"
              left={(props) => <List.Icon {...props} icon="file-document-outline" />}
            />
            <Divider />
            <List.Item
              title="GET /api/library"
              description="List folders, models, selected model, and viewer prefs"
              left={(props) => <List.Icon {...props} icon="database-outline" />}
            />
            <Divider />
            <List.Item
              title="POST /api/import-base64"
              description="Upload one or more files encoded as base64"
              left={(props) => <List.Icon {...props} icon="upload-outline" />}
            />
            <Divider />
            <List.Item
              title="PATCH/DELETE /api/models/{id}"
              description="Rename/move/delete models"
              left={(props) => <List.Icon {...props} icon="cube-outline" />}
            />
            <Divider />
            <List.Item
              title="POST/PATCH/DELETE /api/folders"
              description="Create and manage folders"
              left={(props) => <List.Icon {...props} icon="folder-outline" />}
            />
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}
