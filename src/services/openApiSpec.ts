export const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'Voxel Garden Viewer Local API',
    version: '1.0.0',
    description:
      'Local LAN API exposed by the mobile app for importing, organizing, and managing preview models.',
  },
  servers: [
    {
      url: 'http://model-viewer.local:18422',
      description: 'mDNS alias (preferred)',
    },
  ],
  paths: {
    '/api/health': {
      get: {
        summary: 'Health check',
        responses: {
          '200': {
            description: 'Server health status',
          },
        },
      },
    },
    '/api/library': {
      get: {
        summary: 'List folders and models',
        responses: {
          '200': {
            description: 'Library content and selected model',
          },
        },
      },
    },
    '/api/import-base64': {
      post: {
        summary: 'Upload model files',
        description: 'Send one or more files (base64) including OBJ/MTL pairs.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  folderId: { type: ['string', 'null'] },
                  files: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        base64: { type: 'string' },
                      },
                      required: ['name', 'base64'],
                    },
                  },
                },
                required: ['files'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Imported models',
          },
        },
      },
    },
    '/api/models/{modelId}': {
      patch: {
        summary: 'Rename, move, or select a model',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  folderId: { type: ['string', 'null'] },
                  selected: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Fallback update for rename/move/select (iOS-compatible)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  folderId: { type: ['string', 'null'] },
                  selected: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
      delete: {
        summary: 'Delete a model',
      },
    },
    '/api/folders': {
      post: {
        summary: 'Create folder',
      },
    },
    '/api/folders/{folderId}': {
      patch: {
        summary: 'Rename folder',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
                required: ['name'],
              },
            },
          },
        },
      },
      post: {
        summary: 'Fallback rename for folder (iOS-compatible)',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                },
                required: ['name'],
              },
            },
          },
        },
      },
      delete: {
        summary: 'Delete folder (must be empty)',
      },
    },
  },
} as const;
