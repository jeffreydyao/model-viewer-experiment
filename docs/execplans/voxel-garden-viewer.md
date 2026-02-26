# Build Voxel Garden Viewer (Expo SDK 55)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `docs/PLANS.md`.

## Purpose / Big Picture

Deliver a lightweight Expo app for game-asset preview where a developer can import MagicaVoxel OBJ/MTL models, persist and organize them on-device, render them in a touch-friendly Three.js scene, and manage the model library through both in-app UI and a local LAN web/API surface discoverable via OpenAPI. After completion, users can test rendering/performance quickly on iOS and Android devices without moving files manually into project source.

## Progress

- [x] (2026-02-26 00:00Z) Scaffolded Expo SDK 55 TypeScript project.
- [x] (2026-02-26 00:00Z) Added React Native Paper + NativeWind + navigation shell.
- [x] (2026-02-26 00:00Z) Implemented persistent model library service with import/rename/delete/folder management.
- [x] (2026-02-26 00:00Z) Implemented Three.js viewer with scene presets, lighting presets, touch orbit/pan/zoom, and performance overlay.
- [x] (2026-02-26 00:00Z) Implemented local HTTP server with Material UI web interface, mDNS alias publishing, and OpenAPI spec.
- [ ] (2026-02-26 00:00Z) Generate branded icon with imagegen skill and apply app assets.
- [ ] (2026-02-26 00:00Z) Validate on iOS and Android via mobilecli using latest Downloads OBJ/MTL pair.
- [ ] (2026-02-26 00:00Z) Finalize README with autonomous setup + device runbook; commit and push.

## Surprises & Discoveries

- Observation: `react-native-http-bridge` was outdated for modern RN; `react-native-http-bridge-refurbished` provided a maintained bridge server with request routing and typed APIs.
  Evidence: package README and exports showed `BridgeServer` helper and modern callback flow.

## Decision Log

- Decision: Use a JSON metadata file in app documents storage instead of introducing SQLite for model organization.
  Rationale: Simpler implementation and easier interoperability with local HTTP API without migrations; still durable across app restarts.
  Date/Author: 2026-02-26 / Codex

- Decision: Use `react-native-http-bridge-refurbished` and `react-native-zeroconf` for local API + `model-viewer.local` alias.
  Rationale: Expo JS runtime cannot host a pure Node HTTP server; native bridge and mDNS publication are required.
  Date/Author: 2026-02-26 / Codex

- Decision: Use OBJ/MTL + GLTF/GLB as preview-capable formats, while keeping import pipeline generic.
  Rationale: Satisfies core MagicaVoxel workflow and provides practical multi-format headroom without over-scoping parser support.
  Date/Author: 2026-02-26 / Codex

## Outcomes & Retrospective

Implementation is in progress. Core app architecture and feature set are in place, pending icon generation, cross-device validation, and final docs/commit work.

## Context and Orientation

The app root is `/Users/jeffrey/code/anywhere/model-viewer`. Runtime features are implemented under `src/`:

- `src/services/libraryService.ts`: persistent model/folder metadata, file import pipeline, and CRUD operations.
- `src/services/modelParser.ts`: OBJ/MTL and GLTF/GLB parse/load path into Three.js objects.
- `src/services/localServer.ts`: embedded HTTP server routing, Material UI web uploader page, mDNS alias publication, and OpenAPI serving.
- `src/store/useAppStore.ts`: state orchestration and app lifecycle startup.
- `src/screens/*.tsx`: Viewer, Library, Server, and Help user interfaces.
- `src/components/*.tsx`: Three canvas renderer and performance overlay.

Configuration lives in `app.json`, `package.json`, `babel.config.js`, `metro.config.js`, and `tailwind.config.js`.

## Plan of Work

Finalize branding assets with image generation, run native builds on iOS and Android, validate end-to-end import and rendering flow using the newest OBJ/MTL files in Downloads, verify local server UI and API behavior, then document setup/development/deployment in README and conclude with commit + push.

## Concrete Steps

From repo root:

1. Install dependencies and native config:
   npm install
   npx expo prebuild

2. Run iOS and Android builds:
   npm run ios
   npm run android

3. Validate LAN API:
   curl http://<device-ip>:18422/api/health
   curl http://<device-ip>:18422/api/openapi.json

4. Validate upload flow with latest Downloads OBJ/MTL pair via API.

5. Exercise app navigation and controls with mobilecli on both platforms.

## Validation and Acceptance

Accept when all of the following are true:

- iOS and Android app launches and renders Viewer/Library/Server/Help tabs.
- Importing an OBJ/MTL pair adds a persisted model visible after app restart.
- Viewer supports multitouch orbit/pan/zoom and settings toggles (scene/lighting/grid/wireframe/stats).
- Debug overlay reports live FPS plus geometry/render metrics.
- Library supports recent sorting, rename/delete/move, and folder CRUD.
- Local server starts automatically and displays both alias and IP instructions.
- Browser web UI (Material UI) supports drag/drop upload and management actions that live-refresh in app.
- OpenAPI endpoint is reachable and describes API.

## Idempotence and Recovery

- Re-running imports generates distinct model entries; cleanup is available through delete actions.
- If alias publication fails (no Wi-Fi/mDNS constraints), server remains available by IP and app remains stable.
- If selected model is deleted, the app auto-selects the next available model or clears selection.

## Artifacts and Notes

Key artifacts to preserve in final output:

- Icon asset path and prompt used via imagegen.
- Mobilecli screenshots/logs for both platforms.
- Example API request payload for `POST /api/import-base64`.

## Interfaces and Dependencies

Libraries:

- Expo SDK 55 core modules for native runtime and storage.
- React Native Paper (MD3) for app UI.
- NativeWind for utility styling.
- Three.js + React Three Fiber + Drei for rendering and camera controls.
- `react-native-http-bridge-refurbished` for embedded HTTP server.
- `react-native-zeroconf` for local mDNS alias publication.

Change note: Initial implementation pass created full feature skeleton and core functionality; remaining work is validation, branding assets, and release-quality docs/commit.
