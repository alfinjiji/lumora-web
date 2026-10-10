# Lumora Web

A React and TypeScript starter powered by Vite, with ESLint and a reproducible npm lockfile.

## Requirements

- Node.js 24 (the tested version is pinned in `.nvmrc`)
- npm 11

No environment variables, credentials, database, or backend service are required for the starter.

## Development

From the repository root:

```sh
npm ci
npm run dev
```

Open the server address printed by Vite. Opening the source `index.html` directly does not compile TypeScript or load the React application; it must be served by Vite.

Edit `src/App.tsx` to begin building the application. The starter includes an interactive counter to check React rendering and state updates.

## Validation and production build

```sh
npm run lint
npm run build
npm run preview
```

The build runs TypeScript checks and writes static assets to `dist/`. The preview command serves that build for local validation. There is no automated test suite configured yet.

## Codex cloud development

Use the existing checkout at `/workspace/lumora-web`; cloud tasks already run in isolated environments, so a separate Git worktree is unnecessary.

Use a writable npm cache when installing:

```sh
cd /workspace/lumora-web
npm ci --cache /workspace/.npm-cache
npm run dev -- --host 0.0.0.0 --port 5173 --strictPort
```

Dependency installation needs access to `registry.npmjs.org`. Live development server processes must be restarted in new tasks. For readiness, request the local server and verify that the Lumora heading renders and the counter increments in a browser.
