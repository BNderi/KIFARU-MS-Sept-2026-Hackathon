# KIFARU-MS-Sept-2026-Hackathon

Kifaru prototype for centralized bank fraud validation.

## Run the React app

From the repository root:

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. In another terminal, start the validation API:

```bash
python -m pip install -r backend/requirements.txt
npm run server
```

Vite forwards `/api/*` requests to the backend at `http://127.0.0.1:8000`.
Choose Admin or Employee, then upload `backend/data/kifaru_events.csv` to populate
additional records. The dashboard loads persisted backend history, institutions,
thresholds, risk codes, and knowledge-base entries on startup. Use the institution
buttons to see each bank's related records.

The React app preserves role views, bank switching, search/outcome filters,
reports and risk-code drilldowns, read-only investigations, knowledge-base content,
admin settings, theme switching, and the collapsible sidebar.
Use `?clawpilotTheme=dark` or `?clawpilotTheme=light` to select the initial theme;
otherwise it follows the system preference.

### Prototype boundaries

CSV uploads call the real prototype API. Role selection is not authentication,
and bank filtering is client-side, not an authorization boundary. Connector
inventory is illustrative and does not contact external systems. Institution
threshold changes are persisted by the backend.
Backend records and institution thresholds persist in SQLite and reload on refresh.
Production use requires server-side authentication, tenant authorization,
durable storage, and real action endpoints.

### Build and checks

```bash
npm run build
npm test
python -m compileall -q backend/app backend/scripts
npm run preview
```

`npm run build` type-checks the app and produces `dist/`. Preview also proxies
`/api` to the separately running backend. A production host must provide its
own `/api` reverse proxy. Node 22.18+ (22.x) or Node 24+ is required.

## Contents

- `src/` - React + TypeScript components, state, API client, reference data, and styles.
- `fraud-soc-dashboard-prototype.html` - original interactive prototype, kept for reference.
- `backend/` - working backend API prototype for the Kifaru validation agent.
- `fraud-validation-agent-skill.md` - shareable AI-agent skill instructions.
- `kifaru-architecture.excalidraw` / `kifaru-architecture.png` - architecture diagram.

## Run the backend

```bash
python -m pip install -r backend/requirements.txt
npm run server
```

Then open `http://127.0.0.1:8000/health` or `http://127.0.0.1:8000/docs`.
The backend's full usage, replay, scoring, and API documentation is in
`backend/README.md`.