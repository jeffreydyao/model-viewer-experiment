import { Card, Text } from 'react-native-paper';

import type { ModelStats, RuntimeStats } from '../types/library';

export function PerformanceOverlay({
  modelStats,
  runtimeStats,
}: {
  modelStats: ModelStats | null;
  runtimeStats: RuntimeStats | null;
}) {
  return (
    <Card
      mode="contained"
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        minWidth: 180,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
      }}
    >
      <Card.Content>
        <Text variant="labelLarge">Debug</Text>
        <Text variant="bodySmall">FPS: {runtimeStats?.fps ?? '-'}</Text>
        <Text variant="bodySmall">Draw Calls: {runtimeStats?.drawCalls ?? '-'}</Text>
        <Text variant="bodySmall">Triangles: {runtimeStats?.triangles ?? '-'}</Text>
        <Text variant="bodySmall">Faces: {modelStats?.faces ?? '-'}</Text>
        <Text variant="bodySmall">Vertices: {modelStats?.vertices ?? '-'}</Text>
        <Text variant="bodySmall">Meshes: {modelStats?.meshes ?? '-'}</Text>
        <Text variant="bodySmall">Materials: {modelStats?.materials ?? '-'}</Text>
      </Card.Content>
    </Card>
  );
}
