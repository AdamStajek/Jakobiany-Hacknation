# Frontend — zasady (`frontend/`)

Angular 21, PrimeNG 21, Tailwind 4, MapLibre, ECharts, Terra Draw, Turf. Wersje są nowsze niż Twoja wiedza — przy wątpliwościach sprawdź `node_modules/<pakiet>/` (`.d.ts`), nie zgaduj API.

## Start

1. Znajdź istniejący odpowiednik w `shared/`, `core/`, `features/` i reużyj.
2. Naśladuj styl sąsiednich plików.
3. Typ/endpoint sprawdź w `core/api/types.ts` i `api.service.ts`.
4. Zmieniaj minimalny zakres.

## Architektura

```
src/app/  core/ (api, state, theme) · shared/ (ui, map, charts, experiments) · features/ · layout/shell.ts
```

- Zależności tylko w dół: `features → shared → core`. Zakaz: `core → shared/features`, `shared → features`, feature → feature.
- HTTP wyłącznie w `core/api/ApiService` (nowy endpoint = metoda + typ w `types.ts`).
- Stan współdzielony/asynchroniczny: `core/state/*.store.ts` (`providedIn:'root'`, signals). Lokalny: `signal` w komponencie.
- Błędy: `errorMessage()` z `core/api/errors.ts`, komunikat w UI (`role="alert"`), nie `alert()`.
- `shared/ui/*` — czysto prezentacyjne (`input()`/`output()`), bez API i store'ów.
- Opcje wykresów: funkcje czyste w `charts.ts`, start od `baseOptions()`/`palette()` z `shared/charts/chart-theme.ts`; nowy typ serii zarejestruj w `echarts-setup.ts`; pod wykresem dostęp do danych (tabela).
- Mapa: cały kod w `shared/map/`, komponent „głupi” (dane `input()`, zdarzenia `output()`), bez API. Typy `import type`, silnik ładowany leniwie, sprzątanie w `OnDestroy`. Współrzędne `[lon, lat]`, EPSG:4326; Turf pojedynczymi pakietami.
- Motyw: tylko `core/theme/theme.ts` (`darkMode`) i `AppPreset`; nie zmieniaj `--pw-*` ani kolejności warstw CSS.

## Układ (mobile-first)

- Projektuj od 390 px; jedyny breakpoint to `lg` (1024 px). Cele dotykowe ≥ 36–44 px.
- Główna nawigacja jest w `layout/shell.ts` (Start, Analizuj pole (`/sprawdz`), Moje pola, Jak to działa): desktop — pasek boczny `w-60`; telefon — górny pasek + dolna nawigacja. Dane działki to widok „Moich pól”, a eksperymenty są zakładką w „Jak to działa” (`/metody/eksperymenty`).
- Pełnoekranowe widoki: wysokość `100dvh - var(--shell-top) - var(--shell-bottom)`.
- Reużywaj `app-panel` (karta z nagłówkiem: `heading`, `icon`) i `app-segmented` (przełącznik widoków: `options`, `label`, `model()` `value`).
- Analiza (`features/analysis`): widoki `map`/`form`/`report` w signalu `view`; telefon — segmenty, desktop — panel „Dane” obok mapy/raportu. URL odtwarza działkę i raport.
- Nie twórz osobnych komponentów mobile/desktop — przełączaj klasami (`hidden`/`lg:flex`). Elementy ekranowe: `print:hidden`. Przewijanie: `pw-scroll`, karty: `pw-card`.

## Angular

- Standalone, selektor `app-*`, `inject()`, `@if/@for/@switch` (`@for` z `track`), bez NgModules i `*ngIf`.
- Signals: `signal`, `computed`, `effect`, `input()`, `output()`, `model()`. Stan pochodny = `computed`; `effect` tylko dla efektów ubocznych, zapisy do signali w `untracked`. Bez `BehaviorSubject`; `firstValueFrom` na granicy HTTP.
- Parametry trasy przez `withComponentInputBinding` (`input()`). Trasy lazy (`loadComponent`) z `title`.
- Formularze: typed Reactive Forms lub signals; bez nowych `[(ngModel)]`.
- Brak ciężkich wywołań w szablonie. Inline `template` do ~40 linii, większe → osobny `.html`/`.css`. Komponent > ~250 linii → rozbij.
- Zakaz `any`, `@ts-ignore`, `as unknown as`. Typy w `types.ts`.

## UI

- PrimeNG: importuj pojedyncze komponenty (`primeng/skeleton`); najpierw PrimeNG, potem własny.
- Tailwind: utility w szablonie, kolory przez tokeny (`bg-surface-0`, `text-muted-color`, `bg-primary`), bez hexów, `!important` i inline `style`. Ciemny motyw: `.app-dark` / `dark:`.
- Dostępność: `<button>`/`<a>`, `aria-label` bez tekstu, `aria-pressed`, `aria-hidden` na ikonach dekoracyjnych, kontrast AA, informacja = kolor + ikona + tekst, `prefers-reduced-motion`.
- Zawsze trzy stany: ładowanie (Skeleton), błąd, brak danych (`empty-state`). Niepewność i braki pokazuj jawnie (`confidence-chip`).
- Długie operacje (> 2 s): prawdziwy postęp z WebSocketu (`ApiService` + Store + pasek `aria-live`) — `docs/LONG_RUNNING.md`.

## Unikaj

God-componentów, kopiowania bloków zamiast `shared/ui`, logiki w szablonie, `setTimeout` jako synchronizacji, podwójnych źródeł prawdy dla stanu, martwego kodu, `console.log`.

## Komendy i zakończenie

```bash
cd frontend
npm start        # ng serve
npm run lint && npm test && npm run build
npm run gen:api  # typy z OpenAPI
npm run test:e2e # Playwright (wymaga działającej aplikacji)
```

Dodaj test (`*.spec.ts`) dla store'a/funkcji czystej; E2E gdy zmienia się główny przepływ. Przed zakończeniem uruchom lint, test, build; jeśli się nie dało — napisz to wprost.
