# AGENTS.md

„Pole Widzenia / WodoStrażnik” — backend FastAPI (`backend/`) + frontend Angular 21 (`frontend/`).

## Zasady

- Małe, ukierunkowane zmiany; bez niezwiązanych refaktorów. Najpierw reużyj istniejący kod.
- Tylko darmowe/open source, bez kluczy API; nowe zależności tylko po uzgodnieniu.
- Logika biznesowa jest w backendzie — UI nie przelicza wyników.
- Teksty UI po polsku; dostępność obowiązkowa.
- Procesy > 2 s raportują postęp przez WebSocket ([`docs/LONG_RUNNING.md`](docs/LONG_RUNNING.md)).
- Commity/PR bez linii atrybucji narzędzi AI.

## Frontend

Zasady kodu: [`docs/FRONTEND_GUIDE_LLM.md`](docs/FRONTEND_GUIDE_LLM.md) (krótki; czytaj przy zmianach w `frontend/`). Produkt/UX: `docs/FRONTEND_REBUILD_PLAN.md` — tylko gdy potrzebne.

Weryfikacja na koniec: `cd frontend && npm run lint && npm test && npm run build`.
