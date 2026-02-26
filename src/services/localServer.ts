import * as Network from 'expo-network';
import { BridgeServer } from 'react-native-http-bridge-refurbished';
import Zeroconf, { ImplType } from 'react-native-zeroconf';

import {
  createFolder,
  deleteFolder,
  deleteModel,
  getFolderPath,
  importIncomingFiles,
  loadState,
  moveModel,
  renameFolder,
  renameModel,
  setSelectedModel,
} from './libraryService';
import { openApiSpec } from './openApiSpec';

const port = 18422;
const aliasHost = 'model-viewer.local';
const serviceName = 'model-viewer';

export interface LocalServerStatus {
  isRunning: boolean;
  port: number;
  aliasUrl: string;
  ipUrl: string | null;
  ipAddress: string | null;
  error: string | null;
}

let serverInstance: BridgeServer | null = null;
let zeroconf: Zeroconf | null = null;
let currentStatus: LocalServerStatus = {
  isRunning: false,
  port,
  aliasUrl: `http://${aliasHost}:${port}`,
  ipUrl: null,
  ipAddress: null,
  error: null,
};

function parseRequestData(raw: unknown) {
  if (!raw) {
    return null;
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw;
}

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function webUiHtml(status: LocalServerStatus) {
  const ipUrl = status.ipUrl ?? 'Unavailable (no LAN IP detected)';
  const errorMessage = status.error ? escapeHtml(status.error) : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Voxel Garden Viewer</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/@emotion/react@11/dist/emotion-react.umd.min.js"></script>
    <script crossorigin src="https://unpkg.com/@emotion/styled@11/dist/emotion-styled.umd.min.js"></script>
    <script crossorigin src="https://unpkg.com/@mui/material@5.16.14/umd/material-ui.production.min.js"></script>
    <style>
      body { margin: 0; font-family: Roboto, sans-serif; background: #f7f9fc; }
      #root { min-height: 100vh; }
      .dropzone { border: 2px dashed #90a4ae; border-radius: 12px; padding: 28px; text-align: center; background: #fff; }
      .dropzone.dragging { border-color: #1976d2; background: #e3f2fd; }
      .muted { color: #607d8b; font-size: 13px; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      const {
        AppBar,
        Alert,
        Box,
        Button,
        Card,
        CardContent,
        Chip,
        CircularProgress,
        Container,
        CssBaseline,
        Divider,
        List,
        ListItem,
        ListItemText,
        Stack,
        Tab,
        Tabs,
        TextField,
        Toolbar,
        Typography,
      } = MaterialUI;

      const apiBase = '';

      function App() {
        const [tab, setTab] = React.useState(0);
        const [loading, setLoading] = React.useState(true);
        const [library, setLibrary] = React.useState({ models: [], folders: [], selectedModelId: null });
        const [dragging, setDragging] = React.useState(false);
        const [folderName, setFolderName] = React.useState('');
        const [message, setMessage] = React.useState('');

        const refresh = React.useCallback(async () => {
          try {
            const res = await fetch(apiBase + '/api/library');
            const json = await res.json();
            setLibrary(json);
          } catch (err) {
            setMessage(String(err));
          } finally {
            setLoading(false);
          }
        }, []);

        React.useEffect(() => {
          refresh();
          const interval = setInterval(refresh, 2000);
          return () => clearInterval(interval);
        }, [refresh]);

        const uploadFiles = React.useCallback(async (fileList) => {
          const files = await Promise.all(Array.from(fileList).map((file) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = String(reader.result || '');
                const base64 = result.includes(',') ? result.split(',')[1] : result;
                resolve({ name: file.name, base64 });
              };
              reader.onerror = reject;
              reader.readAsDataURL(file);
            })
          ));

          await fetch(apiBase + '/api/import-base64', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files }),
          });
          setMessage('Files imported.');
          await refresh();
        }, [refresh]);

        const createFolder = React.useCallback(async () => {
          if (!folderName.trim()) return;
          await fetch(apiBase + '/api/folders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: folderName.trim() }),
          });
          setFolderName('');
          await refresh();
        }, [folderName, refresh]);

        const renameModel = React.useCallback(async (id, current) => {
          const name = prompt('Rename model', current);
          if (!name) return;
          await fetch(apiBase + '/api/models/' + id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
          await refresh();
        }, [refresh]);

        const deleteModel = React.useCallback(async (id) => {
          if (!confirm('Delete this model?')) return;
          await fetch(apiBase + '/api/models/' + id, { method: 'DELETE' });
          await refresh();
        }, [refresh]);

        const renameFolder = React.useCallback(async (id, current) => {
          const name = prompt('Rename folder', current);
          if (!name) return;
          await fetch(apiBase + '/api/folders/' + id, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          });
          await refresh();
        }, [refresh]);

        const deleteFolder = React.useCallback(async (id) => {
          if (!confirm('Delete this folder? It must be empty.')) return;
          const res = await fetch(apiBase + '/api/folders/' + id, { method: 'DELETE' });
          if (!res.ok) {
            const json = await res.json().catch(() => ({}));
            alert(json.error || 'Could not delete folder');
          }
          await refresh();
        }, [refresh]);

        return React.createElement(React.Fragment, null,
          React.createElement(CssBaseline),
          React.createElement(AppBar, { position: 'static' },
            React.createElement(Toolbar, null,
              React.createElement(Typography, { variant: 'h6', sx: { flexGrow: 1 } }, 'Voxel Garden Viewer LAN')
            )
          ),
          React.createElement(Container, { maxWidth: 'md', sx: { py: 3 } },
            React.createElement(Stack, { spacing: 2 },
              ${errorMessage ? "React.createElement(Alert, { severity: 'warning' }, 'mDNS status: " + errorMessage + "')," : ''}
              React.createElement(Card, null,
                React.createElement(CardContent, null,
                  React.createElement(Stack, { direction: 'row', spacing: 1, flexWrap: 'wrap' },
                    React.createElement(Chip, { label: 'Alias: ${escapeHtml(status.aliasUrl)}', color: 'primary' }),
                    React.createElement(Chip, { label: 'IP: ${escapeHtml(ipUrl)}' }),
                    React.createElement(Chip, { label: 'OpenAPI: /api/openapi.json' })
                  ),
                  React.createElement(Typography, { variant: 'body2', sx: { mt: 1 } }, 'Use your browser to upload .obj/.mtl pairs, organize folders, and rename/delete models. Changes live-reload in the app.')
                )
              ),
              React.createElement(Tabs, { value: tab, onChange: (_, v) => setTab(v) },
                React.createElement(Tab, { label: 'Upload' }),
                React.createElement(Tab, { label: 'Library' })
              ),
              tab === 0 && React.createElement(Stack, { spacing: 2 },
                React.createElement(Box, {
                  className: dragging ? 'dropzone dragging' : 'dropzone',
                  onDragOver: (e) => { e.preventDefault(); setDragging(true); },
                  onDragLeave: () => setDragging(false),
                  onDrop: (e) => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files); }
                },
                  React.createElement(Typography, { variant: 'h6' }, 'Drop model files here'),
                  React.createElement(Typography, { className: 'muted' }, 'Supports OBJ+MTL pairs and single GLTF/GLB files.'),
                  React.createElement(Button, {
                    sx: { mt: 2 },
                    variant: 'outlined',
                    component: 'label'
                  },
                    'Choose files',
                    React.createElement('input', {
                      type: 'file',
                      hidden: true,
                      multiple: true,
                      onChange: (e) => uploadFiles(e.target.files || [])
                    })
                  )
                ),
                React.createElement(Stack, { direction: 'row', spacing: 1 },
                  React.createElement(TextField, {
                    value: folderName,
                    onChange: (e) => setFolderName(e.target.value),
                    label: 'Create folder',
                    size: 'small'
                  }),
                  React.createElement(Button, { variant: 'contained', onClick: createFolder }, 'Add')
                )
              ),
              tab === 1 && React.createElement(Stack, { spacing: 2 },
                loading && React.createElement(CircularProgress),
                message && React.createElement(Alert, { severity: 'success' }, message),
                React.createElement(Card, null,
                  React.createElement(CardContent, null,
                    React.createElement(Typography, { variant: 'h6' }, 'Folders'),
                    React.createElement(List, null,
                      library.folders.map((folder) => React.createElement(ListItem, {
                        key: folder.id,
                        secondaryAction: React.createElement(Stack, { direction: 'row', spacing: 1 },
                          React.createElement(Button, { size: 'small', onClick: () => renameFolder(folder.id, folder.name) }, 'Rename'),
                          React.createElement(Button, { size: 'small', color: 'error', onClick: () => deleteFolder(folder.id) }, 'Delete')
                        )
                      },
                        React.createElement(ListItemText, { primary: folder.name, secondary: folder.parentId ? 'Subfolder' : 'Root folder' })
                      ))
                    )
                  )
                ),
                React.createElement(Card, null,
                  React.createElement(CardContent, null,
                    React.createElement(Typography, { variant: 'h6' }, 'Models'),
                    React.createElement(Divider, { sx: { my: 1 } }),
                    React.createElement(List, null,
                      library.models.map((model) => React.createElement(ListItem, {
                        key: model.id,
                        secondaryAction: React.createElement(Stack, { direction: 'row', spacing: 1 },
                          React.createElement(Button, { size: 'small', onClick: () => renameModel(model.id, model.name) }, 'Rename'),
                          React.createElement(Button, { size: 'small', color: 'error', onClick: () => deleteModel(model.id) }, 'Delete')
                        )
                      },
                        React.createElement(ListItemText, {
                          primary: model.name + ' (' + model.format + ')',
                          secondary: model.folderPath
                        })
                      ))
                    )
                  )
                )
              )
            )
          )
        );
      }

      ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
    </script>
  </body>
</html>`;
}

function jsonResponse(response: { json: (obj: object, code?: number) => void }, code: number, payload: object) {
  response.json(payload, code);
}

function parseRoute(url: string) {
  const [pathPart, queryPart] = url.split('?');
  const path = pathPart ?? '/';
  const segments = path.split('/').filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryPart ?? '').entries());
  return { path, segments, query };
}

function asString(input: unknown): string | null {
  return typeof input === 'string' ? input : null;
}

async function libraryPayload() {
  const state = await loadState();
  const folders = state.folders.map((folder) => ({
    ...folder,
    path: getFolderPath(folder.id, state.folders),
  }));
  const models = state.models.map((model) => ({
    ...model,
    folderPath: getFolderPath(model.folderId, state.folders),
  }));
  return {
    selectedModelId: state.selectedModelId,
    viewer: state.viewer,
    folders,
    models,
  };
}

async function routeRequest(request: { type: string; url: string; data: unknown }, response: { json: (obj: object, code?: number) => void; html: (html: string, code?: number) => void }) {
  const method = request.type.toUpperCase();
  const { path, segments, query } = parseRoute(request.url);

  if (method === 'GET' && path === '/') {
    response.html(webUiHtml(currentStatus), 200);
    return;
  }

  if (method === 'GET' && path === '/api/openapi.json') {
    jsonResponse(response, 200, openApiSpec as unknown as object);
    return;
  }

  if (method === 'GET' && path === '/api/health') {
    jsonResponse(response, 200, {
      status: 'ok',
      isRunning: currentStatus.isRunning,
      aliasUrl: currentStatus.aliasUrl,
      ipUrl: currentStatus.ipUrl,
      error: currentStatus.error,
    });
    return;
  }

  if (method === 'GET' && path === '/api/library') {
    jsonResponse(response, 200, await libraryPayload());
    return;
  }

  if (method === 'POST' && path === '/api/import-base64') {
    const body = parseRequestData(request.data) as
      | {
          folderId?: string | null;
          files?: { name: string; base64: string }[];
        }
      | null;

    if (!body || !Array.isArray(body.files) || body.files.length === 0) {
      jsonResponse(response, 400, { error: 'files[] is required' });
      return;
    }

    const imported = await importIncomingFiles(
      body.files.map((file) => ({
        name: file.name,
        base64: file.base64,
      })),
      body.folderId ?? null,
    );
    jsonResponse(response, 200, { imported });
    return;
  }

  if (method === 'POST' && path === '/api/folders') {
    const body = parseRequestData(request.data) as { name?: string; parentId?: string | null } | null;
    if (!body?.name) {
      jsonResponse(response, 400, { error: 'name is required' });
      return;
    }

    const folder = await createFolder(body.name, body.parentId ?? null);
    jsonResponse(response, 201, { folder });
    return;
  }

  if (segments[0] === 'api' && segments[1] === 'models' && segments[2]) {
    const modelId = segments[2];

    if (method === 'PATCH' || method === 'POST') {
      const body = parseRequestData(request.data) as { name?: string; folderId?: string | null; selected?: boolean } | null;
      const name = asString(body?.name) ?? asString(query.name);
      if (name) {
        await renameModel(modelId, name);
      }

      const hasFolderIdInBody = Object.prototype.hasOwnProperty.call(body ?? {}, 'folderId');
      const hasFolderIdInQuery = Object.prototype.hasOwnProperty.call(query, 'folderId');
      if (hasFolderIdInBody || hasFolderIdInQuery) {
        const folderIdRaw = hasFolderIdInBody ? body?.folderId : query.folderId;
        const folderId =
          folderIdRaw === null || folderIdRaw === undefined || folderIdRaw === '' || folderIdRaw === 'null'
            ? null
            : String(folderIdRaw);
        await moveModel(modelId, folderId);
      }

      const selected = body?.selected === true || query.selected === 'true';
      if (selected) {
        await setSelectedModel(modelId);
      }
      jsonResponse(response, 200, await libraryPayload());
      return;
    }

    if (method === 'DELETE') {
      await deleteModel(modelId);
      jsonResponse(response, 200, await libraryPayload());
      return;
    }
  }

  if (segments[0] === 'api' && segments[1] === 'folders' && segments[2]) {
    const folderId = segments[2];

    if (method === 'PATCH' || method === 'POST') {
      const body = parseRequestData(request.data) as { name?: string } | null;
      const name = asString(body?.name) ?? asString(query.name);
      if (!name) {
        jsonResponse(response, 400, { error: 'name is required' });
        return;
      }

      await renameFolder(folderId, name);
      jsonResponse(response, 200, await libraryPayload());
      return;
    }

    if (method === 'DELETE') {
      try {
        await deleteFolder(folderId);
        jsonResponse(response, 200, await libraryPayload());
      } catch (error) {
        jsonResponse(response, 409, { error: error instanceof Error ? error.message : 'Failed to delete folder' });
      }
      return;
    }
  }

  jsonResponse(response, 404, {
    error: 'Not found',
    path,
    method,
  });
}

async function resolveIpAddress() {
  try {
    const value = await Network.getIpAddressAsync();
    return value || null;
  } catch {
    return null;
  }
}

function publishMdns() {
  try {
    zeroconf = new Zeroconf();
    zeroconf.publishService('http', 'tcp', 'local.', serviceName, port, { path: '/' }, ImplType?.DNSSD);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'Could not publish mDNS service';
  }
}

export async function startLocalServer() {
  if (serverInstance) {
    return currentStatus;
  }

  const ipAddress = await resolveIpAddress();
  const ipUrl = ipAddress ? `http://${ipAddress}:${port}` : null;

  try {
    const server = new BridgeServer('voxel-garden-viewer', true);
    server.use(async (req, res) => {
      try {
        await routeRequest({ type: req.type, url: req.url, data: req.postData }, res);
      } catch (error) {
        jsonResponse(res, 500, { error: error instanceof Error ? error.message : 'Server error' });
      }
    });
    server.listen(port);
    serverInstance = server;

    const mdnsError = publishMdns();

    currentStatus = {
      isRunning: true,
      port,
      aliasUrl: `http://${aliasHost}:${port}`,
      ipUrl,
      ipAddress,
      error: mdnsError,
    };

    return currentStatus;
  } catch (error) {
    currentStatus = {
      isRunning: false,
      port,
      aliasUrl: `http://${aliasHost}:${port}`,
      ipUrl,
      ipAddress,
      error: error instanceof Error ? error.message : 'Failed to start local server',
    };
    return currentStatus;
  }
}

export function getLocalServerStatus() {
  return currentStatus;
}

export function stopLocalServer() {
  if (serverInstance) {
    serverInstance.stop();
    serverInstance = null;
  }
  if (zeroconf) {
    try {
      zeroconf.unpublishService(serviceName, ImplType?.DNSSD);
      zeroconf.stop(ImplType?.DNSSD);
      zeroconf.removeDeviceListeners();
    } catch {
      // best effort cleanup only
    }
    zeroconf = null;
  }

  currentStatus = {
    ...currentStatus,
    isRunning: false,
  };
}
