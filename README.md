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
npm run backend
```

Vite forwards `/api/*` requests to the backend at `http://127.0.0.1:3000`.
Choose Admin or Employee, then upload `backend/sample-logs.csv` to populate
the dashboard. Use the institution buttons to see each bank's related records.
The dashboard starts empty, matching the original prototype.

The React app preserves role views, bank switching, search/outcome filters,
reports and risk-code drilldowns, investigation actions, knowledge-base content,
admin settings, theme switching, and the collapsible sidebar.
Use `?clawpilotTheme=dark` or `?clawpilotTheme=light` to select the initial theme;
otherwise it follows the system preference.

### Prototype boundaries

CSV uploads call the real prototype API. Role selection is not authentication,
and bank filtering is client-side, not an authorization boundary. Connector
status, source actions, thresholds, fraud simulation, and bank alert actions
are demo-only; they do not modify external systems or backend scoring policy.
Marking a case not fraud changes only the current browser session.
Frontend records and settings reset on refresh; backend data is also in memory.
Production use requires server-side authentication, tenant authorization,
durable storage, and real action endpoints.

### Build and checks

```bash
npm run build
npm test
npm test --prefix backend
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
cd backend
npm start
```

Then open `http://127.0.0.1:3000/health`.