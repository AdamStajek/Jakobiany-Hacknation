# Frontend — przewodnik pracy dla LLM i ludzi („Pole Widzenia”)

Ten dokument jest źródłem prawdy o tym, **jak pisać kod we `frontend/`**. Obowiązuje agentów (Codex, Claude Code, Copilot itp.) i ludzi. Cel: spójny kod, zero spaghetti. Plan produktowy i UX: `docs/FRONTEND_REBUILD_PLAN.md`.

## 1. Zanim cokolwiek napiszesz (obowiązkowa analiza)

1. Przeczytaj `frontend/package.json` — wersje bibliotek są źródłem prawdy (Angular 21, PrimeNG 21, Tailwind 4, MapLibre 6, ECharts 6, Terra Draw, Turf 7). **Nie zakładaj API z pamięci**: te wersje są nowsze niż większość danych treningowych. Gdy nie jesteś pewien API biblioteki, sprawdź `node_modules/<pakiet>/` (typy `.d.ts`, README) albo oficjalną dokumentację tej wersji.
2. Znajdź istniejący odpowiednik (`grep`/przeglądanie `shared/`, `core/`, `features/`). **Najpierw reużywaj, potem rozszerzaj, dopiero na końcu twórz nowe.**
3. Przeczytaj 1–2 sąsiednie pliki i naśladuj ich styl (formatowanie, nazewnictwo, struktura).
4. Sprawdź czy typ/endpoint już istnieje w `core/api/types.ts` i `core/api/api.service.ts`.
5. Zmieniaj minimalny zakres. Bez „przy okazji” refaktorów niezwiązanych z zadaniem.

## 2. Stack (wyłącznie darmowy/open source, bez kluczy API)

| Obszar | Biblioteka | Zasada |
|---|---|---|
| Framework | Angular 21: standalone, **signals**, lazy routes | Brak NgModules, brak `*ngIf/*ngFor` — używaj `@if/@for/@switch` |
| UI | PrimeNG 21 + preset w `core/theme/preset.ts` | Najpierw komponent PrimeNG, dopiero potem własny |
| Style | Tailwind 4 (+ `tailwindcss-primeui`) | Klasy utility w szablonie; własny CSS tylko gdy się nie da |
| Mapa | MapLibre GL, Terra Draw, Turf | Tylko w `shared/map/`; zakaz Leaflet/Mapbox/Google |
| Wykresy | ECharts przez `ngx-echarts` | Tylko w `shared/charts/` i `features/*/…charts.ts` |
| Dane | `HttpClient` w `ApiService` | Komponenty **nie** wołają `HttpClient` |
| Testy | Vitest (`*.spec.ts`), Playwright (`e2e/`) | |

Zabronione: Mapbox, Google Maps, płatne kafelki, Highcharts, Syncfusion, jQuery, nowe biblioteki UI obok PrimeNG. **Nowa zależność = osobna decyzja zespołu**, nie dodawaj jej samodzielnie.

## 3. Architektura i warstwy (kierunek zależności)

```
src/app/
  core/      api/ (ApiService, types, errors) · state/ (store'y na signals) · theme/
  shared/    ui/ (małe prezentacyjne komponenty, m.in. panel, segmented) · map/ · charts/
  features/  analysis/ · passport/ · methods/   ← strony i logika widoku
  layout/    shell.ts
```

Dozwolone zależności (strzałka = „może importować”):

`features → shared → core` oraz `features → core`. `layout → core/shared`.

**Zakazane:** `core → shared/features`, `shared → features`, feature → inny feature (wspólne rzeczy przenieś do `shared/` lub `core/`). Brak cyklicznych importów.

Podział odpowiedzialności — każda rzecz ma jedno miejsce:

| Co | Gdzie | Czego NIE robić |
|---|---|---|
| Wywołania HTTP | `core/api/api.service.ts` | `HttpClient` w komponencie/store |
| Typy odpowiedzi API | `core/api/types.ts` (docelowo generowane: `npm run gen:api` → `schema.d.ts`) | Ręczne duplikowanie typów w komponentach |
| Stan współdzielony, asynchroniczność, błędy | `core/state/*.store.ts` (`@Injectable({providedIn:'root'})`, signals) | Stan globalny w komponentach, `BehaviorSubject` |
| Mapowanie błędów na komunikat | `core/api/errors.ts` (`errorMessage`) | Własne `catch` z tekstami rozsianymi po UI |
| Prezentacja (bez logiki biznesowej) | `shared/ui/*` | Wołanie API, wstrzykiwanie store'ów |
| Strona / orkiestracja widoku | `features/<x>/*-page.ts` | Logika obliczeniowa i fetch w szablonie |
| Opcje wykresów | `features/*/dashboard/charts.ts` + `shared/charts/chart-theme.ts` | Wielkie obiekty `option` w komponencie |
| Motyw jasny/ciemny | `core/theme/theme.ts` (`darkMode` signal) | Własny przełącznik dark mode |

**Logika biznesowa (ryzyko, bilans wodny, rekomendacje) jest w backendzie.** Frontend wyświetla wyniki z API; nie przeliczaj ich ponownie po stronie klienta.

## 3a. Układ aplikacji: mobile-first (powłoka, panel, segmenty, widoki)

Interfejs projektuje się najpierw na telefon (390 px), a dopiero potem rozszerza na desktop. Jedyny punkt przełamania układu to breakpoint Tailwind `lg` (1024 px).

**Powłoka (`layout/shell.ts`, `app-shell`)** — jedyne miejsce z nawigacją główną. Cztery sekcje (`NAV`): Analiza działki (`/`), Paszporty pól (`/paszporty`), Eksperymenty (`/eksperymenty`), Jak to działa (`/metody`). Aktywna sekcja jest liczona z adresu (`computed` `section`; paszport działki pod `/dzialka/:id/paszport` należy do sekcji Paszport).
- Desktop (`lg` i więcej): stały pasek boczny po lewej (szerokość `w-60`, treść ma `lg:pl-60`) z logo, nawigacją, przełącznikiem motywu i stopką zespołu.
- Telefon: górny pasek (`h-14`, logo + przełącznik motywu) i dolna nawigacja z czterema pozycjami (`h-16`, uwzględnia `safe-area-inset-bottom`).
- Elementy powłoki mają `print:hidden`; link „Przejdź do treści” (`#tresc`) jest pierwszym fokusowalnym elementem. Aktywna pozycja ma `aria-current="page"`.
- Wysokości powłoki są zmiennymi CSS w `styles.css`: `--shell-top` (pasek górny) i `--shell-bottom` (dolna nawigacja); na desktopie obie równe `0px`. Pełnoekranowe widoki liczą wysokość jako `100dvh - var(--shell-top) - var(--shell-bottom)`. Nowa strona pełnoekranowa ma użyć tych zmiennych, a nie własnych stałych.

**`shared/ui/panel.ts` (`app-panel`)** — karta (`pw-card`) z opcjonalnym nagłówkiem. Wejścia: `heading` (tytuł, `h3`) i `icon` (klasa PrimeIcons, np. `pi-map`); treść przez `ng-content`. Używaj zamiast ręcznie powielanych kart z nagłówkiem. Komponent jest czysto prezentacyjny.

**`shared/ui/segmented.ts` (`app-segmented`)** — przełącznik widoków w stylu segmentów. Wejścia: `options` (lista `SegmentOption<T>`: `value`, `label`, opcjonalnie `icon`, `disabled`) i `label` (wymagana nazwa grupy dla czytników ekranu); stan przez dwukierunkowe `model()` `value`. Renderuje grupę przycisków (`role="group"`, `aria-pressed`), nie pasek kart/zakładek. Typ wartości jest generyczny (`Segmented<T extends string>`).

**Widoki analizy (`features/analysis/analysis-page.ts`)** — jedna trasa (`/`, `/dzialka/:id`, `/dzialka/:id/analiza/:analysisId`), trzy widoki w signalu `view`: `map` (Mapa), `form` (Dane: wybór działki + formularz analizy), `report` (Raport).
- Telefon: `app-segmented` u góry przełącza trzy pełnoekranowe widoki. Raport jest wyłączony (`disabled`), dopóki nie ma raportu ani trwającej analizy. Na mapie pływa pole wyszukiwania (`app-parcel-picker variant="search"`) oraz karta wybranej działki z przyciskiem „Dalej” (przejście do Danych).
- Desktop: panel „Dane” (`24rem`) jest zawsze obok, a prawa strona pokazuje Mapę albo Raport (segmenty Mapa/Raport; widok `form` mapuje się tam na mapę przez `pane`).
- Przepływ automatyczny: start analizy i pojawienie się raportu przełączają na Raport, a błąd bez raportu wraca do Danych. Adres URL odtwarza działkę i raport (efekty link ↔ stan z `untracked`).
- Druk: `print:hidden` ukrywa elementy ekranowe, a raport drukuje się bez wewnętrznego przewijania.
- Przewijane obszary używają klasy `pw-scroll` (`overscroll-behavior: contain`), karty klasy `pw-card` (`styles.css`).

Zasada dla nowych widoków: najpierw układ jednokolumnowy 390 px z dolną nawigacją i dużymi celami dotykowymi (min. ok. 36–44 px), potem rozszerzenie od `lg:`. Nie dodawaj osobnych komponentów „mobile” i „desktop” tej samej treści, jeśli wystarczy przełączanie klasami (`hidden`/`lg:flex`).

## 4. Reguły Angulara (jak pisać komponenty)

- Standalone, `imports: []` w dekoratorze. Selektor z prefiksem `app-` w kebab-case (wymusza ESLint).
- **Signals zamiast RxJS/`ngModel`**: `signal`, `computed`, `effect`, `input()`, `output()`, `model()`, `viewChild()`. `firstValueFrom` na granicy z HTTP (wzorzec w `ApiService`).
- `inject()` zamiast wstrzykiwania w konstruktorze.
- Pochodny stan = `computed`, **nie** `effect` zapisujący do innego signala. `effect` tylko dla efektów ubocznych (mapa, DOM); zapisy do signali w nim owijaj `untracked` (wzór: `AnalysisStore`).
- Dane do strony z routingu przez `withComponentInputBinding` (parametry trasy jako `input()`), nie `ActivatedRoute`.
- Formularze: Reactive Forms (typed) albo signal-based; nowych `[(ngModel)]` nie dodawaj.
- Szablon: `@for` zawsze z `track`. Brak wywołań ciężkich metod w szablonie — użyj `computed`.
- Inline `template` dla małych komponentów (<~40 linii szablonu); większe → osobny `.html`/`.css` obok `.ts` (wzór: `passport-page`).
- Rozmiar: komponent > ~250 linii albo > 1 odpowiedzialność → wydziel pod-komponent lub store.
- `strict` TS i `strictTemplates` są włączone. **Zakaz `any`**, `@ts-ignore`, `as unknown as`. Brak typu → dopisz go w `types.ts`.
- Zapytania do API tylko przez metody `ApiService`; nowy endpoint = nowa metoda + typ.
- Wszystkie teksty UI po polsku, bezpośrednio w szablonie (brak i18n w MVP). Terminy rolnicze prostym językiem.

## 5. Biblioteki — jak ich używać

### PrimeNG
- Importuj pojedyncze moduły/komponenty (`primeng/skeleton`, …), nie całość.
- Motyw wyłącznie przez `AppPreset` (`core/theme/preset.ts`). **Nie zmieniaj tokenów marki `--pw-*`** (`styles.css`). Kolory przez klasy PrimeUI/Tailwind (`bg-surface-0`, `text-muted-color`, `border-surface`, `bg-primary`), nie surowy hex w szablonach.
- Ciemny motyw: klasa `.app-dark` na `<html>`; wariant Tailwind `dark:`.
- Warstwy CSS: kolejność `theme, base, primeng, components, utilities` (w `styles.css` i `app.config.ts`) — nie ruszaj.

### Tailwind 4
- Konfiguracja w CSS (`styles.css`), bez `tailwind.config.js`. Własne klasy w `@layer`.
- Mobile-first; sprawdzaj 390 px i `lg` (1024 px) — patrz sekcja 3a. Elementy tylko-ekranowe: `print:hidden`.

### MapLibre / Terra Draw / Turf
- Cały kod mapy w `shared/map/` (`wodo-map.ts`, `map-style.ts`). Komponent mapy jest „głupi”: dane wchodzą przez `input()`, zdarzenia wychodzą przez `output()` (`pointClicked`, `polygonDrawn`). **Mapa nie woła API ani store'ów.**
- Import typów MapLibre jako `import type`; sam silnik ładowany leniwie (duży bundle). Sprzątanie w `OnDestroy` (`map.remove()`, `draw.stop()`).
- Geometria po stronie klienta: Turf (pojedyncze pakiety `@turf/bbox`…). Współrzędne GeoJSON zawsze `[lon, lat]`, EPSG:4326.

### ECharts
- Rejestruj tylko używane wykresy/komponenty w `shared/charts/echarts-setup.ts` (tree-shaking). Użyłeś nowego typu serii → dopisz go tam, inaczej wykres się nie wyrenderuje.
- Opcje wykresów buduj funkcjami czystymi w `charts.ts`, startując od `baseOptions()`/`axisStyle()`/`palette()` z `chart-theme.ts` (zależne od `darkMode`). Nie hardkoduj kolorów ani fontów.
- Dostępność: `aria.enabled` jest w `baseOptions`; pod wykresem zapewnij dostęp do danych (tabela/„pokaż dane”).

## 6. Wzorzec dodawania funkcji (checklista)

1. Typ + metoda w `core/api/` (jeśli potrzebny endpoint).
2. Store w `core/state/` tylko jeśli stan jest współdzielony lub asynchroniczny; w przeciwnym razie `signal` lokalnie w komponencie.
3. Prezentacyjne klocki w `shared/ui/` (reużywalne, `input()`/`output()`), strona w `features/<x>/`.
4. Trasa w `app.routes.ts` jako **lazy** (`loadComponent`), z `title`.
5. Test (`*.spec.ts`) dla store'a / funkcji czystej / mappera; E2E gdy zmienia się główny przepływ.
6. `npm run lint && npm test && npm run build` bez błędów i ostrzeżeń.

> **Długie operacje (> 2 s)**: pokazuj prawdziwy postęp z WebSocketu (klient w `ApiService`, stan w Store, pasek z `aria-live`), nie timer ani sam spinner. Szczegóły: `docs/LONG_RUNNING.md`.

## 7. Czego unikać (typowe źródła spaghetti)

- Wielki „god-component” robiący fetch + stan + mapę + wykresy.
- Kopiowanie bloku komponentu zamiast wydzielenia do `shared/ui`.
- Logika w szablonie (`@if` z długimi wyrażeniami, wywołania funkcji w pętli) → `computed`.
- Zagnieżdżone subskrypcje, `setTimeout` jako synchronizacja, ręczny dostęp do DOM poza mapą/wykresem.
- Wiele źródeł prawdy dla tego samego stanu (np. działka w store **i** w komponencie).
- Surowe kolory/hexy, `!important`, inline `style` zamiast tokenów/utility.
- Martwy kod, zakomentowane bloki, `console.log`, TODO bez właściciela.
- Obsługa błędów przez `alert()` — użyj `errorMessage()` i komunikatu w UI (`role="alert"`).

## 8. Dostępność i jakość UI

- Interaktywne elementy to `<button>`/`<a>`, z `aria-label`, gdy brak tekstu; stan przełączników `aria-pressed`. Fokus widoczny (globalny `:focus-visible`).
- Informacja nie tylko kolorem: kolor + ikona + tekst. Kontrast AA.
- Szanuj `prefers-reduced-motion`. Ikony dekoracyjne `aria-hidden="true"`.
- Brak danych / błąd / ładowanie to osobne stany (`empty-state`, Skeleton) — zawsze zaprojektuj wszystkie trzy.
- Dane o niepewności (pewność, braki, źródła) pokazuj jawnie (`confidence-chip`); nie ukrywaj ograniczeń.

## 9. Komendy

```bash
cd frontend
npm start            # ng serve (proxy do backendu: proxy.conf.mjs)
npm run lint         # ESLint (angular-eslint, a11y szablonów)
npm test             # Vitest
npm run build        # produkcyjny build + budżety
npm run gen:api      # typy z OpenAPI backendu (API_URL=…)
npm run test:e2e     # Playwright (wymaga uruchomionej aplikacji)
```

Przed zakończeniem pracy uruchom `lint`, `test` i `build`. Jeśli czegoś nie dało się uruchomić, napisz to wprost zamiast twierdzić, że działa.

## 10. Git

Małe, spójne commity po polsku lub angielsku w trybie rozkazującym. Nie commituj `dist/`, `.angular/`, `node_modules/`, sekretów. Nie dodawaj linii atrybucji narzędzi AI do commitów ani PR (reguła zespołu).
