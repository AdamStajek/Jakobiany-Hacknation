# Plan realizacji: poprawki UI i paszport przez WebSocket

Decyzje: przycisk i nazwy: **„Analizuj działkę"** (nawigacja: **„Analizuj pole"**); tryb mapy: proste rozwiązanie (store); paszport: backend + WebSocket z postępem + cache.

## Status (stan na 2026-11-22)

| Etap | Status | Commit |
|---|---|---|
| 1. Nazwy i teksty | zrobiony | 96c9a89 |
| 2. Tryb mapy (`MapPrefsStore`) | zrobiony | f79a5b0 |
| 3. Raport: split-button, zwijane eksperymenty | **wycofany** (revert d201ec5), do ponownego wykonania | 01acfa1 → d201ec5 |
| 4. Zaawansowane opcje działki | zrobiony | fa343b3 |
| 5. Dane działki przez WebSocket + cache | zrobiony (`/api/ws/passport`, `PassportStore`) | 337b891 |
| 6. Typografia | zrobiony | aceb474 |
| 7. Układ „Moje pola” | nie rozpoczęty (czeka na makietę) | — |
| 8. PDF i raport | nie rozpoczęty (czeka na backend) | — |

Kolejność = kolejność commitów (każdy etap osobny commit, lint/test/build po każdym).

## Etap 1. Nazwy i teksty (mały, bezpieczny)

| # | Zadanie | Pliki |
|---|---------|-------|
| 1.1 | Usunąć zdublowaną numerację (zostaje numer w kółku, tytuł bez `{{i + 1}}.`) | `features/home/home-page.ts` |
| 1.2 | „Sprawdź pole" → „Analizuj pole" (nawigacja, przycisk startowy, `title` trasy `/sprawdz`) | `layout/shell.ts`, `home-page.ts`, `app.routes.ts` |
| 1.3 | „Sprawdź wodę na polu" → „Analizuj działkę" | `features/analysis/analysis-form.html` |
| 1.4 | „Paszport" / „Paszport działki" → „Dane działki" we wszystkich etykietach UI (przyciski, segment w Moich polach, nagłówki, `title` trasy, `aria-label`, puste stany, link w raporcie, teksty w `methods`). Nazwy techniczne (`PassportStore`, `/paszport`, endpointy) bez zmian | `field-card.ts`, `fields-page.ts`, `fields-passports.ts`, `parcel-passport-page.ts`, `passport-summary.ts`, `report-dashboard.html`, `app.routes.ts`, `methods/*` |
| 1.5 | Zaktualizować wzmianki w docs (`FRONTEND_GUIDE_LLM.md`) i testy (`e2e/*.mjs`, `*.spec.ts`) szukające starych tekstów | `docs/`, `frontend/e2e`, specy |

Weryfikacja: `grep -ri "sprawdź pole\|paszport"` w `frontend/src` i `frontend/e2e` nie zwraca etykiet UI.

## Etap 2. Tryb mapy zachowany po wyborze działki

Przyczyna: `/sprawdz` i `/dzialka/:id` to dwie trasy z tym samym komponentem. Nawigacja niszczy i tworzy `AnalysisPage`, więc `WodoMap` wraca do `osm`.

- 2.1 Nowy `core/state/map-prefs.store.ts` (`providedIn: 'root'`, signal `basemap: 'osm' | 'orto'`; zapis tylko przez `ConsentStore.write`, odczyt przez `read`).
- Uwaga na zależności: `shared/map` nie może importować `core/state`? Zasada mówi „shared → core" jest dozwolone, ale mapa ma być „głupia". Dlatego: `WodoMap` dostaje `basemap = model<Basemap>('osm')`, a `AnalysisPage` i `FieldsMapPanel` wiążą go ze store'em `[(basemap)]="prefs.basemap"`.
- 2.2 `WodoMap`: po `ready` zastosować aktualny `basemap()` na warstwach (`effect`), `setBasemap` ustawia `model`.
- 2.3 Test: `map-prefs.store.spec.ts` (domyślna wartość, zapis/odczyt, brak zgody → tylko pamięć).

## Etap 3. Raport: split-button i zwijane eksperymenty

- 3.1 `report-dashboard.html`: zastąpić 5 przycisków jednym `p-splitbutton` („Pobierz raport" = PDF; menu: „Pobierz dane (JSON)", „Drukuj", „Kopiuj link"), umieszczonym w prawym górnym rogu nagłówka raportu (`print:hidden`). „Dane działki" jako osobny dyskretny link.
- 3.2 `report-experiments.html`: lista eksperymentów w `p-accordion` (wzór: `shared/ui/field-declarations.html`). Nagłówek panelu: tytuł + status („Wynik zapisany" / „Do wykonania"). Domyślnie zwinięte; rozwinięty tylko ten z zapisanym wynikiem.
- 3.3 Zachować dostępność (`aria-expanded`, kolejność fokusa) i widoczność wszystkich paneli w druku (`print:`).

## Etap 4. Uproszczenie opcji działki

- 4.1 Pierwszy ekran formularza: tylko uprawa, data, przycisk „Analizuj działkę".
- 4.2 Wszystko pozostałe (opis własnymi słowami, gleba i woda, nawadnianie, scenariusz opadu) w jednym zwiniętym bloku „Zaawansowane (opcjonalne)" z licznikiem uzupełnionych pól w nagłówku, np. „Gleba i woda · 2 uzupełnione".
- 4.3 Pliki: `analysis-form.html`, `shared/ui/field-declarations.*`. Bez zmiany logiki i walidacji.

## Etap 5. Dane działki: backend + WebSocket + cache

Stan: `GET /api/passport` robi pełne `collect()` (wszystkie źródła, timeout do 90 s) + `analyze_field()`, a UI używa tylko `summary` i `farmer_report.situation/next_check`.

Backend:
- 5.1 Wydzielić `build_passport` tak, by przyjmował `on_progress(done, total, label)` (wzór: `execute_analysis`). `collect()` woła callback po każdym ukończonym źródle (etykiety po polsku, np. „Pogoda", „Gleba", „Sentinel-2", „Teren", „Hydrologia"), potem „Obliczam podsumowanie".
- 5.2 Budżet czasu: ujednolicić z analizą (24 s zamiast 90 s w `collect`), źródła po terminie trafiają do braków. Zgodnie z `docs/LONG_RUNNING.md`.
- 5.3 Cache serwerowy: klucz `(parcel_id, crop, day)`, TTL ok. 1 h, ograniczony rozmiar (LRU), tylko dla wyników bez geometrii importu. Trafienie w cache = od razu `result`. Współdzielić z analizą, jeśli oba używają `collect` z tymi samymi argumentami.
- 5.4 Lekka odpowiedź: nowy format `?view=summary` (lub osobny WS) zwracający `parcel_id`, `analysis_as_of`, `summary`, `farmer_report` (`situation`, `next_check`) bez ciężkiej tablicy `fields`. Pełny `fields` zostaje dla `POST /api/passport` i raportu.
- 5.5 `@app.websocket("/api/ws/passport")`: wzór `analysis_socket`; wejście `{parcel_id, as_of, crop}` (walidacja Pydantic, limit rozmiaru i timeout odbioru w handlerze, `analysis_slots`), zdarzenia `progress` → jedno `result`/`error`. Praca w wątku (`run_in_executor`, `call_soon_threadsafe`).
- 5.6 Testy: `backend/tests/test_ws.py` (sekwencja progress → result, błąd walidacji, trafienie w cache bez postępu), test summary bez `fields`.

Frontend:
- 5.7 `ApiService.passportWithProgress(parcelId, asOf, crop, onProgress, signal)` (wzór `analyzeWithProgress`, fallback do `GET /api/passport?view=summary`). Typ `Passport` zawęzić (`fields` opcjonalne).
- 5.8 `PassportStore`: do wpisu dodać `progress` i `percent` (signals), anulowanie przy zmianie pola, deduplikacja żądań, zachować cache pamięci.
- 5.9 `shared/ui/passport-summary.ts`: zamiast szarego skeletona kółko/pasek z etykietą bieżącego źródła (`aria-live="polite"`, `prefers-reduced-motion`). Nadal zachować trzy stany.
- 5.10 Prefetch: po wejściu w „Moje pola" po cichu załadować dane pierwszego pola (bez UI postępu).
- 5.11 Test `passport.store.spec.ts` (ładowanie, cache, anulowanie, błąd).

## Etap 6. Spójna typografia

- 6.1 Klasy w `styles.css` (w warstwie komponentów, bez zmian `--pw-*`): `.pw-h1` (`text-2xl font-bold tracking-tight`), `.pw-h2` (`text-xl font-bold`), `.pw-h3` (`text-base font-semibold`), `.pw-lead`.
- 6.2 Zastąpić ręczne klasy w nagłówkach stron: Moje pola, Analiza (raport), Dane działki, Konto, Powiadomienia, Jak to działa, Eksperymenty. Strona główna zachowuje większy hero.
- 6.3 Tekst pomocniczy: `text-sm text-muted-color`, treść: `text-base`.

## Etap 7. Układ „Moje pola" (po uzgodnieniu makiety)

- 7.1 Lista pól jako główna część (szersza, większe akcje „Analizuj działkę", „Dane działki"), mapa jako węższy panel boczny (ok. `22rem`, sticky) albo zwijana sekcja na telefonie.
- 7.2 Sekcja „Do zrobienia" na górze z `fields.attention()`.
- 7.3 Akcje typu „podlej" tylko, jeśli backend je udostępni; na razie „Analizuj działkę" jako główny przycisk karty.

## Etap 8. PDF i raport (osobne zadanie, czeka na backend)

- 8.1 Spisać zawartość PDF (nagłówek, ryzyko, 3 kluczowe wnioski, wykresy, źródła) i zrobić razem z poprawą raportu.

---

# Prompt do realizacji

```
Pracujesz w repo Jakobiany-Hacknation (backend FastAPI + frontend Angular 21).
Najpierw przeczytaj AGENTS.md, docs/FRONTEND_GUIDE_LLM.md i docs/LONG_RUNNING.md,
potem docs/PLAN_POPRAWKI_UI.md. Zrealizuj etapy 1-6 z tego planu po kolei.

Zasady:
- Jeden commit na etap (po polsku, bez linii atrybucji narzędzi AI), małe zmiany,
  bez niezwiązanych refaktorów, reużywaj istniejący kod (shared/ui, stores).
- Teksty UI po polsku, dostępność obowiązkowa (aria-*, kontrast, reduced motion).
- Logika biznesowa w backendzie; frontend nie przelicza wyników.
- Etap 5: wzoruj się na analysis_socket / analyzeWithProgress / test_ws.py,
  zachowaj fallback HTTP, cache serwerowy z TTL, budżet czasu jak w analizie.
- Etapy 7 i 8 pomiń (wymagają makiety / backendu raportu); zapytaj, jeśli coś
  w planie jest niejednoznaczne zamiast zgadywać.

Po każdym etapie uruchom:
  cd frontend && npm run lint && npm test && npm run build
  oraz testy backendu (pytest) przy zmianach w backend/.
Dodaj testy: map-prefs.store, passport.store, test_ws.py dla /api/ws/passport.
Na końcu zrób krótkie podsumowanie: co zrobiono, co sprawdzono, czego nie dało
się zweryfikować (np. wygląd w przeglądarce).
```
