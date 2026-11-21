// Backend URL: in docker compose it's the "backend" service, locally the port published by compose.
export default {
  '/api/**': {
    target: process.env.API_URL ?? 'http://localhost:8000',
  },
};
