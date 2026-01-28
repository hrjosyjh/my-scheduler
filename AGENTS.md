# Repository Guide for Coding Agents

This repo is a small monorepo-style app:
- `client/`: React (Vite) frontend (ESM)
- `server/`: Node.js (Express) backend (CommonJS) + SQLite (`server/schedule.db`)
- Root `package.json`: runs client+server concurrently

Cursor/Copilot rules: none found (`.cursor/rules/`, `.cursorrules`, `.github/copilot-instructions.md`).

## Quick Commands

### Install
Preferred (repo-provided installer):
```bash
./install_scheduler.sh
```

Manual (equivalent intent):
```bash
npm install
npm install --prefix server
npm install --prefix client
```

### Run (dev)
Run both server + client together (root):
```bash
npm start
```

Run backend only:
```bash
npm run server --prefix server
```

Run frontend only:
```bash
npm run dev --prefix client
```

Alternate frontend command (same as `dev`):
```bash
npm run client --prefix client
```

Ports/URLs (as implemented):
- Backend: `http://localhost:3001` (see `server/server.js`)
- Frontend: `http://localhost:5173` (Vite default)
- Frontend talks to backend via `API_URL = 'http://localhost:3001/api'` (see `client/src/App.jsx`)

### Build
Client build:
```bash
npm run build --prefix client
```

Server: no build step (runs directly via Node).

### Lint
Client lint:
```bash
npm run lint --prefix client
```

Lint a single file (pass a path/glob to ESLint):
```bash
npm run lint --prefix client -- src/App.jsx
```

Auto-fix:
```bash
npm run lint --prefix client -- --fix
```

Server: no lint script/config is present.

### Tests
No tests are wired up in project scripts.
- Root: `npm test` is a placeholder (fails intentionally)
- Server: `npm test --prefix server` is a placeholder
- Client: no `test` script

If you add tests later, also add:
- `npm test --prefix client` and a single-test pattern (e.g. pass a file path)
- `npm test --prefix server` (if server tests exist)

## Code Structure
Frontend:
- Entry: `client/src/main.jsx`
- Main app: `client/src/App.jsx` (auth, calendar UI, to-do view, API calls)
- Styling: `client/src/index.css` (Tailwind import)
- Tooling: `client/vite.config.js`, `client/eslint.config.js`, `client/postcss.config.js`, `client/tailwind.config.js`

Backend:
- Entry: `server/server.js`
- DB file: `server/schedule.db`
- Schema + migrations live in `server/server.js` (tables: `users`, `events`, `external_calendars`)

## Style Guide (Observed Conventions)
### Languages / module systems

- Client code is ESM (`"type": "module"` in `client/package.json`): use `import`/`export`.
- Server code is CommonJS: use `require(...)`.

Do not mix module systems within a folder.

### Formatting
This repo is not currently standardized by a formatter (no Prettier/Biome config found).

Observed in repo code:
- Client config + entry (`client/eslint.config.js`, `client/src/main.jsx`) uses 2-space indent and no semicolons.
- Client app (`client/src/App.jsx`) uses semicolons in many places and mixes quote styles for UI strings.
- Server (`server/server.js`) uses 4-space indent and semicolons.

Rule of thumb: match the local file you are editing.
- If you touch `client/src/App.jsx`, keep its existing style.
- If you touch `server/server.js`, keep its existing style.

### Imports
- Client local imports may include the explicit extension (e.g. `import App from './App.jsx'` in `client/src/main.jsx`).
- Keep import order simple: external deps first, then local files, then CSS.

### Naming
- React components: `PascalCase` (e.g. `AuthScreen`, `MainSchedule`).
- Functions/variables: `camelCase`.
- Constants: `SCREAMING_SNAKE_CASE` is used for things like `API_URL`.
- SQLite columns are `snake_case` (e.g. `google_access_token`, `google_event_id`).

### Types
- Repo is JavaScript-first (JS/JSX). Avoid adding TypeScript unless you also add the project wiring.
- When dealing with DB booleans, note the existing conversion pattern:
  - SQLite uses `0/1`
  - API responses map to booleans in some places (see `server/server.js` in `/api/events`)

### Error handling
- Prefer early returns on error in Express handlers (`return res.status(...).json(...)`).
- Avoid silent failures: do not add empty `catch` blocks.
- Client-side requests use `try/catch` around axios calls; common pattern reads `err.response?.data?.error`.
- Auth middleware uses HTTP status codes `401` (missing token) / `403` (invalid token).

### Security / secrets
- Do not commit secrets.
- There is a `server/.env` in this workspace; treat it as sensitive.
- Server falls back to a default `SECRET_KEY` in code if env is missing (see `server/server.js`); do not rely on that for production.

## Practical Guidance for Changes
- When editing backend routes, keep all queries scoped to the authenticated user (`user_id = req.user.id`).
- When editing the client, ensure axios auth header handling stays consistent (token stored in `localStorage`, set via `axios.defaults.headers.common.Authorization`).
- Prefer minimal, focused edits: this codebase is small and not heavily modularized yet.
