# AGENTS.md

Projekt: „Pole Widzenia / WodoStrażnik” — backend (FastAPI, `backend/`) + frontend (Angular 21, `frontend/`).

## Frontend (`frontend/`)

**Przed pracą nad frontendem przeczytaj w całości [`docs/FRONTEND_GUIDE_LLM.md`](docs/FRONTEND_GUIDE_LLM.md)** — to obowiązujące zasady architektury, użycia bibliotek (Angular signals, PrimeNG, Tailwind 4, MapLibre, ECharts) i unikania spaghetti. Kontekst produktowy: `docs/FRONTEND_REBUILD_PLAN.md`.

Najważniejsze, skrótowo:

- Wersje bibliotek z `frontend/package.json` są nowsze niż Twoja wiedza — weryfikuj API w `node_modules` / dokumentacji, nie zgaduj.
- Najpierw szukaj istniejącego komponentu/serwisu i reużywaj; nie dodawaj zależności bez uzgodnienia.
- Warstwy: `features → shared → core`. HTTP tylko w `core/api/ApiService`, stan współdzielony w `core/state/*Store` (signals), mapa w `shared/map`, wykresy w `shared/charts`.
- Standalone + signals + `@if/@for`, bez `any`, bez NgModules, bez `HttpClient` w komponentach.
- Logika biznesowa jest w backendzie — nie przeliczaj wyników w UI.
- Teksty UI po polsku; dostępność (aria, kontrast, kolor+ikona+tekst) obowiązkowa.
- Na koniec: `cd frontend && npm run lint && npm test && npm run build`.

## Zasady ogólne

- Nie dodawaj do commitów ani opisów PR linii atrybucji narzędzi AI (`Co-Authored-By: …`, „Generated with …”).
- Procesy trwające > 2 s (analizy, raporty, budowa indeksów) muszą raportować postęp przez WebSocket. Zasady, wzorce i budżet czasu: [`docs/LONG_RUNNING.md`](docs/LONG_RUNNING.md).
- Małe, ukierunkowane zmiany; bez niezwiązanych refaktorów.
- Dane i biblioteki wyłącznie darmowe/open source, bez kluczy API.
