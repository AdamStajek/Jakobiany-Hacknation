// Backend dla `npm start`: domyślnie API uruchomione przez `docker compose up` (port publikowany 8080).
// Nadpisz przez API_URL, np. API_URL=http://127.0.0.1:8001 npm start.
const port = process.env.WODO_PORT ?? '8080';

export default {
  '/api/**': {
    target: process.env.API_URL ?? `http://127.0.0.1:${port}`,
    changeOrigin: true,
    ws: true, // WebSocket postępu analizy: /api/ws/analysis
  },
};
