# NeuroFocus

AI-powered, context-aware attention layer: **NeuroScore**, intent, attention prediction, **Notification DNA**, **NeuroAgent** queue, **NeuroFlows**, focus-exit intelligence, voice/command parsing, and analytics — delivered as a **React + Tailwind** dashboard, **Node** API, and **Chrome extension** stub.

## Quick start

```bash
cd server && npm install && npm run dev
```

In another terminal:

```bash
cd web && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The Vite dev server proxies `/api` to `http://localhost:3847`.

## Chrome extension

1. Open `chrome://extensions` → Developer mode → **Load unpacked** → select the `extension/` folder.
2. Ensure the API and web app are running for popup links and health check.

## Production build

```bash
cd web && npm run build
```

Serve `web/dist` behind your host; point `VITE_API_URL` or reverse-proxy `/api` to the Node server.

## Next steps (hackathon → product)

- **POST `/api/context/ingest`** — accept tab metrics from the extension; persist and drive NeuroScore + intent with real data.
- **LLM** — `OPENAI_API_KEY` or Gemini for notification classification, agent planning, and flow suggestions.
- **OAuth** — Gmail, Calendar, Slack for NeuroAgent actions.

Pitch line: *NeuroFocus is not another productivity tool — it is an AI layer that understands your brain and controls your digital world accordingly.*
