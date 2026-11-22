// Backend dla `npm start`: domyślnie API uruchomione przez `docker compose up` (port publikowany 8080).
// Nadpisz przez API_URL, np. API_URL=http://127.0.0.1:8001 npm start.
const port = process.env.WODO_PORT ?? '8080';
const target = process.env.API_URL ?? `http://127.0.0.1:${port}`;

export default {
  '/api/ws/recommendation-email-test': {
    target,
    ws: true, // Zachowaj Host do sprawdzenia Origin przez API.
  },
  '/api/**': {
    target,
    changeOrigin: true,
    ws: true, // WebSocket postępu analizy: /api/ws/analysis
  },
};
