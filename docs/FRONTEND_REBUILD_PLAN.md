# WodoStrażnik — plan naprawczy frontendu (rebuild)

Data: 21.11.2026 · Status: zaakceptowany, realizacja etapów 0–1

## 0. Zakres i zasady

- **Zakres pierwszego etapu:** wyłącznie podstawa projektu: wybór działki, analiza, dashboard, rekomendacje, źródła i braki. **Paszport działki, Retention Wallet, Eksperymenty rolników i warstwa NDVI/NDMI na mapie to dalszy rozwój po zrealizowaniu podstawy i po pojawieniu się backendu** (opisane w §5–6 jako kierunek, bez wchodzenia do etapów 0–5).
- **Tylko darmowe i open source biblioteki oraz dane**, bez kluczy API i opłat. Zabronione: Mapbox, Google Maps, płatne kafelki, Highcharts, Syncfusion itp.


## 1. Diagnoza obecnego frontendu

Stan: jeden komponent `App` (228 linii TS + 232 linie HTML), 134 linie ręcznego CSS, jedna strona z przewijaniem.

| Problem | Skutek |
|---|---|
| Wszystko w `app.ts`/`app.html` — formularz, mapa, raport, typy API | Nie da się dodać nowych widoków (paszport, portfel, eksperymenty) bez rozrostu monolitu |
| PrimeNG, Tailwind i `tailwindcss-primeui` są w `package.json`, ale **nieużywane**; UI to ręczny CSS (`styles.css`) i natywne `<select>`, `<details>` | Zależności-balast, wygląd niedopracowany, brak spójnego systemu komponentów |
| Wykres historii to ręcznie rysowane `div`-y (`.timeline`, `chartHeight()`) | Brak osi, tooltipów, legendy, dostępności; nie skaluje się na nowe wykresy |
| Mapa: Leaflet + OSM, pusta, jedna warstwa (granica + kropka wody) | Brak ortofotomapy, warstw działek, NDVI, terenu — mapa nie „sprzedaje" produktu |
| Raport = długi ściek akapitów; liczby (TAW, RAW, NDMI) jako tekst | Rolnik nie widzi stanu na pierwszy rzut oka; brak hierarchii (decyzja → dowód → źródło) |
| Typy API przepisane ręcznie z backendu | Rozjazd przy każdej zmianie backendu |
| `features/projects/project-detail/source-lookup.ts` — plik **z innego projektu (Risk Miner)**, importuje nieistniejące `core/api/apis` | Martwy kod; do usunięcia. Podobnie `docs/Risk_Miner_2_0_*.md` |
| Brak routingu, brak stanu między widokami, brak zapisu działek/sesji | Nie ma miejsca na „paszport działki" ani portfel |
| `e2e.mjs`/`deck.mjs` w katalogu frontendu | Testy i materiały prezentacji wymieszane z kodem aplikacji |

**Rekomendacja: przepisać od zera** (zachować Angular 21, PrimeNG, Tailwind, proxy, Dockerfile i `e2e.mjs` jako punkt wyjścia testów). Logika biznesowa jest w backendzie, więc koszt jest niski, a zysk duży.

## 2. Stack docelowy

| Obszar | Wybór | Uzasadnienie |
|---|---|---|
| Framework | Angular 21 (standalone, signals, `resource`/`httpResource`, lazy routes) | Już w projekcie |
| UI | **PrimeNG 21** + preset Aura (w repo jest `theme.ts`, dopasować do zieleni/błękitu wody) + Tailwind 4 | Faktycznie użyć tego, co już zainstalowane: Stepper, Select, DatePicker, Slider, Tabs, Drawer, DataView, Toast, Skeleton, Tag |
| Mapa | **MapLibre GL JS** (+ `@maplibre/maplibre-gl-geocoder` opcjonalnie) | Wektorowe, płynne, warstwy rastrowe (WMS/WMTS) i 3D teren; lepsze niż Leaflet dla wielu warstw i stylów |
| Podkłady/WMS | GUGiK ortofotomapa (WMTS), granice działek EGiB (WMS), OSM/Carto jako tło | Dane polskie, bezpłatne |
| Rysowanie/edycja | **Terra Draw** (adapter MapLibre) | Rysowanie własnej granicy, strefy zabiegu |
| Geometria | **Turf.js** (pole, bufor, centroid, przecięcia po stronie klienta) + **proj4** (EPSG:2180↔4326) | Import GeoJSON/Shapefile bez round-tripu |
| Wykresy | **Apache ECharts** (`ngx-echarts`) | Gauge ryzyka, bilans sezonowy (bar), wykres NDVI/NDMI w czasie (line + confidence band), Sankey budżetu retencji, radar profilu gleby, heatmapa miesięcy |
| Mini-wykresy/KPI | ECharts sparkline lub `ngx-sparkline` | Karty KPI |
| Formularze | Angular Reactive Forms (typed) | Zamiast `[(ngModel)]` |
| Typy API | **`openapi-typescript` + `openapi-fetch`** generowane z `/openapi.json` FastAPI (skrypt `npm run gen:api`) | Zero ręcznych typów |
| Stan | Signals + serwisy (`ParcelStore`, `AnalysisStore`, `WalletStore`); `localStorage`/IndexedDB (`idb`) na zapisane działki do czasu backendu kont | |
| Eksport | Backend PDF jak dziś; druk przez CSS `@media print` | |
| Ikony | PrimeIcons + Lucide dla pojęć rolniczych | |
| i18n | Polski na sztywno, teksty w jednym pliku stałych (`i18n/pl.ts`) | Bez Angular i18n — za ciężkie dla MVP |
| Testy | Vitest (Angular 21 default) dla serwisów/mapperów, **Playwright** E2E (przenieść `e2e.mjs` do `frontend/e2e/`), screenshot-regresja kluczowych widoków | |
| Jakość | ESLint (angular-eslint), Prettier, `strict` TS, budżety rozmiaru w `angular.json` (MapLibre + ECharts → lazy chunk) | |

## 3. Architektura

```
frontend/src/app/
  core/            api-client (wygenerowany), http-interceptory, config, error-handler
  shared/          ui: kpi-card, risk-gauge, source-badge, confidence-chip, empty-state, skeleton
  shared/map/      wodo-map (komponent), warstwy (parcel, ndvi, water, dem), kontrolki
  shared/charts/   echarts-opcje: season-balance, ndvi-timeline, soil-profile, rain-vs-etc, wallet-sankey
  features/
    parcel-picker/       wyszukiwanie ID / klik / obręb+numer / import GeoJSON
    analysis/            formularz uprawy/daty + postęp + raport (dashboard)
    passport/            Paszport działki (patrz §5) — placeholder w MVP, pełny po backendzie
    retention-wallet/    Portfel retencji (suwak budżetu → zestawy działań)
    experiments/         Eksperymenty/„wiedza zbiorowa" (§6)
    methods/             Jak to działa + źródła + ograniczenia
  layout/          shell (sidebar/topbar), mobile bottom-nav
```

Routing (lazy): `/` (start), `/dzialka/:id` (paszport), `/dzialka/:id/analiza/:analysisId`, `/portfel/:id`, `/eksperymenty`, `/metody`.
Stan działki i analizy w URL — link do raportu można wysłać jury.

## 4. Układ ekranów (UX)

**Zasada:** najpierw decyzja, potem dowód, na końcu źródła. Mapa jest bohaterem produktu.

1. **Start / wybór działki** — pełnoekranowa mapa (ortofoto), pasek wyszukiwania na górze (ID, „obręb + numer", adres), przycisk „Wczytaj GeoJSON". Po kliknięciu: granica działki, panel boczny z podstawowymi danymi i krokami: *Działka → Uprawa i data → Analiza* (PrimeNG Stepper).
2. **Dashboard analizy** (po obliczeniu):
   - Rząd KPI: **Ryzyko** (gauge), bilans 30 d, opad vs ETc, najdłuższa susza, pewność oceny.
   - Mapa z przełączanymi warstwami: granica, NDVI/NDMI (dla sceny), stała woda, nachylenie/teren, wodowskaz IMGW.
   - Wykresy: opad vs ETc (30 d), bilans sezonowy (10 lat, ujemne na czerwono), NDMI w czasie z medianą sezonową, profil gleby (TAW/RAW, warstwy), scenariusz „+X mm" jako before/after.
   - **Karty rekomendacji** (priorytet, kiedy, pewność, „dlaczego" w Drawerze z dowodami i ograniczeniami).
   - **Źródła i braki** — tabela PrimeNG (źródło, rozdzielczość, data, cache) + wyraźne „brak danych" z powodem. Dostępność: kolor + ikona + tekst.
3. **Mobile (390 px)** — mapa u góry, dolny panel przeciągany; KPI jako karuzela; wykresy pełnej szerokości.
4. **Ciemny/jasny motyw** — przez preset PrimeNG (`light-dark`).
5. **Dostępność** — fokus, kontrast AA, `aria-live` dla postępu, opisy tekstowe wykresów (tabela pod wykresem „pokaż dane").

## 5. Dalszy rozwój (poza zakresem pierwszego etapu): **Paszport działki**

Cel: jedna, trwała karta działki gromadząca wszystko, co system o niej wie. Frontend przygotować od razu (route + layout + puste sekcje „wkrótce"), a dane podpiąć, gdy backend dostarczy endpointy.

Sekcje paszportu:
1. **Tożsamość** — ID EGiB, gmina, obręb, powierzchnia, geometria, historia zmian granicy, właściciel/użytkownik (opcjonalnie, po zalogowaniu; dane osobowe minimalizować).
2. **Gleba** — retencja (33/1500 kPa), profil warstw, TAW/RAW, tekstura i węgiel organiczny (gdy będą), klasa bonitacyjna (jeśli udostępnione), pomiary własne rolnika.
3. **Teren i woda** — wysokość, nachylenie, kierunek spływu (kolejny etap), odległość do wody, rowy melioracyjne, wodowskaz, strefy zalewowe/susza (mapy referencyjne).
4. **Użytkowanie i uprawy** — pokrycie terenu, **historia upraw (płodozmian)** wpisywana przez rolnika, potwierdzenia, międzyplony.
5. **Klimat** — wieloletni bilans, sezony suche, anomalie, trend.
6. **Satelita** — oś czasu NDVI/NDMI, porównania sezonowe, zdjęcia z maską chmur.
7. **Wdrożone działania** — rejestr działań retencyjnych (co, kiedy, koszt, powierzchnia) + efekt wg modelu.
8. **Eksperymenty** — udział w testach (§6), wyniki.
9. **Dokumenty** — raporty PDF, notatki, zdjęcia z pola (upload).
10. **Pochodzenie danych** — dla każdego pola: źródło, data, pewność (komponent `SourceBadge` wszędzie).

Wymagania backendowe do uzgodnienia: model `Parcel` + `Passport` w bazie (SQLite → Postgres/PostGIS), konta lub tokeny anonimowe (rolnik bez rejestracji w MVP: link prywatny), `GET/PUT /api/passports/{id}`, `POST /api/passports/{id}/crops`, `/actions`, `/attachments`, wersjonowanie wpisów.

## 6. Dalszy rozwój (poza zakresem pierwszego etapu): rozszerzenia z załączonych screenów

### 6.1 Retention Wallet — „ile odporności na suszę kupisz za swój budżet?"
- Suwak budżetu (zł) i ograniczenia: pracochłonność (godz.), obszar, sprzęt, preferencje (międzyplon, struktura gleby, pasy roślinności, retencja terenowa).
- Wynik: **zestawy działań** (3–5) jako karty/Sankey: koszt → działanie → szacowane zmniejszenie ryzyka (przedział, nie punkt), z jawnym oznaczeniem niepewności.
- Wykresy: *efektywna granica* (koszt vs ograniczenie ryzyka — scatter z frontem Pareto), stos kosztów, tornado wrażliwości.
- **Ważne (z opisu):** ceny to jawne **koszty przykładowe**, nie wycena wiążąca — etykieta „przykładowe koszty — zweryfikuj u lokalnego kosztorysanta" przy każdej kwocie, edytowalne przez użytkownika.
- Backend: endpoint `POST /api/wallet/optimize` (budżet + ograniczenia + analiza → zestawy); do czasu jego powstania — mock w `WalletStore` z danych `recommendations` i katalogu kosztów w JSON.

### 6.2 Ogólnopolski eksperyment rolników
- Rolnik zapisuje **eksperyment**: działanie, zakres, data, hipoteza; po sezonie wprowadza wynik (np. ocena plonu, wilgotność, zdjęcia).
- Widok zbiorczy (anonimowy, zagregowany): które działania działają na jakich glebach/uprawach/pogodzie, z **przedziałami ufności, liczbą prób (n) i ograniczeniami** — nie prezentować wniosków przy małym n (komunikat „za mało danych").
- Mapa kafelkowa (hex/gmina) z agregatami — minimalna liczba prób dla pokazania komórki (prywatność, k-anonimowość).
- Backend: `POST /api/experiments`, `POST /api/experiments/{id}/outcome`, `GET /api/experiments/insights`. Zgody i anonimizacja zaprojektować przed zbieraniem danych.

## 7. Plan realizacji (etapy)

| Etap | Zakres | Kryterium ukończenia |
|---|---|---|
| **0. Sprzątanie** (0,5 d) | Usunąć `features/projects/...source-lookup.ts`, ręczny CSS, `docs/Risk_Miner_*`; przenieść `e2e.mjs`/`deck.mjs`; dodać ESLint/Prettier; skrypt `gen:api` | `npm run build` bez ostrzeżeń, brak martwego kodu |
| **1. Fundament** (1 d) | Routing, shell, motyw PrimeNG, wygenerowany klient API, `shared/ui`, serwisy stanu | Pusta aplikacja z nawigacją i motywem jasny/ciemny |
| **2. Mapa** (1–1,5 d) | `wodo-map` (MapLibre): ortofoto GUGiK, klik→działka, granica, import GeoJSON, rysowanie (Terra Draw), warstwy woda/wodowskaz | Wybór działki 3 metodami działa też na 390 px |
| **3. Analiza + dashboard** (2 d) | Stepper formularza, postęp, KPI, gauge, wykresy ECharts, karty rekomendacji, drawer „dlaczego", tabela źródeł i braków, PDF/JSON/druk | Parytet funkcjonalny ze starym UI + E2E zielone |
| **4. Wskaźniki satelitarne bez warstwy** (0,5 d) | NDVI/NDMI jako KPI i wykres w czasie z `history` scen; warstwa pikselowa na mapie dopiero po nowym endpoincie backendu | Wykres NDMI z medianą sezonową |
| **5. Polish** (1 d) | Skeletony, stany błędów, dostępność (axe), screenshot-testy, budżety bundle, README | Lighthouse a11y ≥ 95, brak poziomego scrolla na 390 px |
| *Poza zakresem* | Paszport, Portfel, Eksperymenty, warstwa NDVI (§5–6) | Po ukończeniu podstawy i backendzie |

Etapy 0–5 ≈ 6–7 dni roboczych jednej osoby (do skrócenia równoległą pracą nad wykresami i mapą).

## 8. Ryzyka i decyzje do podjęcia

1. **MapLibre vs Leaflet** — rekomendacja MapLibre; Leaflet wystarczy, jeśli nie planujemy warstw wektorowych/3D (taniej, ale słabszy efekt „wow").
2. **Warstwy NDVI na mapie** wymagają endpointu backendu zwracającego obraz/kafelki — dziś backend zwraca tylko agregaty.
3. **Konta/tożsamość** dla paszportu i eksperymentów — decyzja produktowa (link prywatny vs logowanie); wpływa na RODO.
4. **Koszty w Retention Wallet** — skąd katalog cen (statyczny JSON z przykładami vs. zewnętrzne kosztorysy); zawsze oznaczać jako orientacyjne.
5. **Wnioski z eksperymentów** — bez statystyki (n, CI) nie pokazywać; łatwo o nadinterpretację.
6. **Rozmiar bundla** — MapLibre (~800 kB) + ECharts (~1 MB) tylko w lazy chunkach, ECharts z tree-shakingiem.

## 9. Następny krok

Realizacja: etap 0–1 i szkielet ekranu mapy + dashboardu jako pierwszy działający wycinek, potem iteracyjnie etapy 2–5.
