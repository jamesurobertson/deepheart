import { appendFileSync, mkdirSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

/** The play log on the dev server: the game posts lines to /__log and they're appended to logs/<date>.jsonl. */
const playLog = (): Plugin => ({
  name: 'play-log',
  configureServer(server) {
    server.middlewares.use('/__log', (req, res) => {
      if (req.method !== 'POST') {
        res.statusCode = 405;
        res.end();
        return;
      }
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const d = new Date();
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        mkdirSync('logs', { recursive: true });
        appendFileSync(`logs/${day}.jsonl`, body.endsWith('\n') ? body : `${body}\n`);
        res.statusCode = 204;
        res.end();
      });
    });
  },
});

// Relative base so the build works from any folder (e.g. jamesurobertson.com/deepheart/).
export default defineConfig({
  base: './',
  plugins: [playLog()],
  build: {
    rollupOptions: { input: { main: 'index.html', wiki: 'wiki/index.html' } },
  },
});
