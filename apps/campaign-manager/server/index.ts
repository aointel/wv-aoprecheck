import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import routes from './routes.js';
import { appState } from './state.js';
import { isTaalkTokenConfigured } from './taalk-client.js';
import { ensureHealthTable, loadPersistedHealth } from './health-persist.js';

process.on('unhandledRejection', (err) => console.error('[unhandled]', err));
process.on('uncaughtException', (err) => console.error('[uncaught]', err));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '5050', 10);
const isProd = process.env.NODE_ENV === 'production';

const app = express();
// CORS — allow AOIrail to post health/command data
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
app.use(express.json());

// API routes
app.use('/api', routes);

// Built Vite client (must exist — Railway build must run `npm run build`)
const distPath = path.join(__dirname, '..', 'dist');
const indexHtml = path.join(distPath, 'index.html');
if (existsSync(indexHtml)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res, next) => {
    res.sendFile(indexHtml, (err) => (err ? next(err) : undefined));
  });
} else {
  console.error(
    `[FATAL] Missing ${indexHtml} — run "npm run build". Railway: set build to "npm install --include=dev && npm run build"`
  );
  app.get('/', (_req, res) => {
    res
      .status(503)
      .type('html')
      .send(
        '<h1>503 — client not built</h1><p>Deploy logs should show <code>npm run build</code> (vite). Try <a href="/api/health">/api/health</a>.</p>'
      );
  });
}

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('[express]', err);
    res.status(500).send('Internal server error');
  }
);

const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws: WebSocket) => {
  appState.wsClients.add(ws);
  console.log(`[WS] Client connected (${appState.wsClients.size} total)`);

  // Send current state immediately on connect
  ws.send(JSON.stringify({
    type: 'full_sync',
    data: {
      agents: appState.agents,
      mergedAgents: appState.getMergedAgents(),
      campaigns: appState.campaigns,
      stats: appState.stats,
      actionLog: appState.autoManager.getActionLog().slice(0, 50),
      activitySummary: appState.getActivitySummary(),
      activeCalls: appState.getActiveCalls(),
      completedTransfers: appState.getCompletedTransfers(),
      missedTransfers: appState.getMissedTransfers(),
      dialingCampaigns: appState.getDialingCampaigns(),
      queuePositions: appState.getQueuePositions(),
      agentHealth: appState.getAllAgentHealth(),
      credits: Object.fromEntries(appState.agentCredits),
    },
    timestamp: new Date().toISOString(),
  }));

  ws.on('close', () => {
    appState.wsClients.delete(ws);
    console.log(`[WS] Client disconnected (${appState.wsClients.size} total)`);
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
    appState.wsClients.delete(ws);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Campaign Manager running on port ${PORT}`);
  if (!isTaalkTokenConfigured()) {
    console.error(
      '\n⚠️  Taalk API token empty — set TAALK_API_TOKEN in server/hardcoded-config.ts\n'
    );
  }
  console.log(`   Dashboard: http://localhost:${PORT}`);
  console.log(`   API:       http://localhost:${PORT}/api`);
  console.log(`   WebSocket: ws://localhost:${PORT}/ws\n`);

  // Restore health reports from DB so AOI Command shows data immediately after restart
  ensureHealthTable().then(() => loadPersistedHealth()).then((reports) => {
    appState.loadHealthFromDB(reports);
  }).catch(() => {});

  // Start polling after server is up
  appState.startPolling();

  // Start the Reactor (agent scoring, ghost tracking, dial rate control) — always on unless import fails
  import('./reactor.js')
    .then(({ startReactor }) => {
      startReactor();
      console.log('⚛️  Reactor scheduler active (rank + dial rates to Taalk)');
    })
    .catch(e => console.error('Reactor failed to start:', e));
});
