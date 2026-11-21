# Plan implementacji frontendu (Angular 21 + PrimeNG + Tailwind)

Zakres: tylko `frontend/`. Backend robi kolega, więc pracujemy na kontrakcie [openapi.yaml](../openapi.yaml) i mocku po stronie frontu. Wymagania: [frontend.md](frontend.md). Pytania do backendu: [frontend-braki.md](frontend-braki.md).

## Stan wyjściowy

Jest szkielet: `shell.ts` (nawigacja), `app.routes.ts` (strony zastępcze `PlaceholderPage` dla `projekty`, `projekty/:id`, `import`, `ekspert`, `analiza`, `chaos-lab`, `radar`, `ustawienia`), `EvidenceService` i `evidence-drawer`, `claim-badge`, `page-header`, `theme.ts`, `proxy.conf.mjs`. Brakuje `provideHttpClient`, warstwy API, typów z OpenAPI, obsługi błędów, formularzy i wszystkich realnych widoków.

## Zasady ogólne

- Standalone components, signals, `inject()`, zmienne stanu jako `signal`/`computed`, nowa składnia `@if/@for`.
- Struktura: `core/` (api, auth, jobs, errors), `shared/` (komponenty wielokrotnego użytku), `features/<obszar>/` (strony i komponenty widoku), lazy `loadComponent` w routach.
- Wszystkie wywołania przez `/api/v1` względnym adresem. Token tylko do własnego API (interceptor).
- Polskie etykiety w jednym miejscu (`core/labels.ts`). Statusy zawsze z ikoną i tekstem, nie tylko kolorem. Widoczny fokus.
- **Strategia mocka:** `ApiClient` ma wymienny backend: prawdziwe API albo `MockInterceptor` (HttpInterceptor zwracający fixtures zgodne z OpenAPI). Przełączane flagą w `environment`. Dzięki temu frontend nie czeka na backend.

---

## Etap 0 – Fundament (blokuje resztę, robić jako pierwszy)

**0.1 Konfiguracja aplikacji.** `provideHttpClient(withInterceptors([...]))`, `provideRouter` z `withComponentInputBinding`, `providePrimeNG` z motywem z `theme.ts`, `provideAnimationsAsync`, `LOCALE_ID = 'pl'`.

**0.2 Typy z OpenAPI.** Dodać `openapi-typescript` (devDependency) i skrypt `npm run gen:api` → `core/api/schema.d.ts` z `docs/openapi.yaml`. Zastąpić ręczny `models.ts` aliasami do wygenerowanych typów (zostają tylko typy UI, np. `EvidenceRef` dla drawera). Plik generowany commitujemy.

**0.3 Warstwa API.** `core/api/` – jeden serwis na obszar (`ProjectsApi`, `EvidenceApi`, `ExpertApi`, `AssessmentsApi`, `JobsApi`, `RulesApi`, `ImportsApi`), każdy zwraca `Observable` z typami ze schematu. Bazowy `ApiClient` dokłada `/api/v1`, buduje query z filtrów, obsługuje paginację (`items`, `total`, `limit`, `offset`).

**0.4 Interceptory.**
- `authInterceptor`: nagłówek `Authorization: Bearer` tylko dla `/api/`.
- `errorInterceptor`: mapuje `Problem` (RFC 7807) na `ApiError { status, code, detail, fieldErrors, currentRevision }`.
- `idempotencyInterceptor` lub helper: `Idempotency-Key` dla `POST` (import, enrich, assessments), klucz trzymany przy powtórzeniu przerwanego żądania.
- `mockInterceptor` (flaga środowiska).

**0.5 Sesja i role (przełącznik ról demo).** Role wybiera użytkownik sam, bez backendu.
- `AuthService`: `role = signal<'analyst'|'expert'|'operator'>`, zapis w `localStorage` (try/catch jak motyw w `shell.ts`), domyślnie `analyst`. Wystawia `can(action)` na podstawie `core/permissions.ts`. Kiedy backend doda `GET /me`, podmieniamy tylko źródło `role` w tym serwisie.
- **Przełącznik na dole sidebara** w `shell.ts`, nad przyciskiem motywu: `p-selectbutton` albo `p-select` z trzema rolami (Analityk, Ekspert, Operator) i podpisem „Tryb demo”.
- **Menu zależne od roli:** `NavItem` dostaje pole `roles`, a `groups` jest `computed` z filtrem po roli. Proponowany podział: Analityk – Projekty, Nowa inwestycja, Chaos Lab, Radar; Ekspert – Projekty, Expert Studio, Ustawienia, Radar; Operator – Projekty, Import i źródła, Ustawienia. Do potwierdzenia z zespołem.
- **Trasy:** `roleGuard` (`canActivate`) z `data.roles`. Przy braku uprawnień przekierowanie na stronę startową roli i toast. Przy zmianie roli, gdy bieżąca trasa jest niedozwolona, nawigacja na stronę startową.
- **Akcje w widokach:** dyrektywa `*can="'import'"` ukrywa lub wyłącza przyciski (import i enrich – operator, decyzje i `sector-rules` – ekspert, tworzenie projektu i analiza – analityk).
- Token pozostaje jeden, z `environment`. Backend i tak może zwracać `403`, więc `errorInterceptor` obsługuje to jak zwykle.

**0.6 Wspólne komponenty UI** (używane przez wszystkie widoki):
- `StatusBadge` – status zadania, wzbogacenia, eksperta, dopasowania (ikona + polska etykieta).
- `ClaimBadge` (istnieje) – rozszerzyć o `EventKind` (zdarzenie historyczne vs przyszłe ryzyko) i znacznik „dane demonstracyjne” dla `provider: mock`.
- `DataState` – wrapper z czterema stanami: ładowanie (skeleton), pusto, błąd (z ponowieniem), dane.
- `MoneyAmount` – kwota z rodzajem, walutą i VAT (netto/brutto).
- `EvidenceLink` – przycisk/ikona otwierająca `EvidenceService.open()`.
- `PagedTable` – tabela PrimeNG z lazy paginacją i filtrami zsynchronizowanymi z query params URL.
- `ConfirmDialog`/toasty (PrimeNG `MessageService`, `ConfirmationService`).

**0.7 Mechanizm zadań (`JobsService`).** `track(location)` → `Observable<Job>`: polling `GET /jobs/{id}` z backoffem, zatrzymanie przy `succeeded|partial|failed` i przy `takeUntilDestroyed`/opuszczeniu widoku. Komponent `JobProgress` (queued/running jako postęp, wynik, raport wierszy). Obsługa `202` + nagłówek `Location`.

**0.8 Fixtures mocka.** `core/mock/fixtures/*.ts`: kilka projektów z hierarchią, ryzykami, dowodami, kolejką eksperta, assessment z bliźniakami i lukami, `sector-rules`, jeden job `partial`. To zasila też developerskie testy ręczne.

**Kryterium:** `npm run build` przechodzi, strona `projekty` pobiera listę z mocka przez wygenerowane typy.

---

## Etap 1 – Widoki P0 (po etapie 0)

### 1A. Repozytorium projektów (`/projekty`)
- Tabela serwerowa: tytuł, ID, status projektu i wzbogacenia, liczniki postępowań/powiązań/ryzyk.
- Filtry `q`, `kind`, `status`, `subsector`, `enrichment_status` w URL; zmiana filtra resetuje `offset`. Debounce wyszukiwania.
- Akcje operatora: „Importuj” (dialog uploadu, `POST /imports`, multipart) i „Wzbogać ponownie” (`POST /projects/{id}/enrich`), obie z `JobProgress`.
- Raport importu: wiersz, etap, wynik, komunikat błędu; przejście do zapisanych projektów z `Job.results`.

### 1B. Karta projektu (`/projekty/:id`)
- Nagłówek, status, eksport JSON/CSV (`/export?format=`; nazwa z `Content-Disposition`, pobranie przez blob).
- Zakładki (lazy): **Struktura** (drzewo `p-tree`: postępowanie → część → umowa → ogłoszenia, zmiany), **Oś czasu** (`p-timeline`), **Zdarzenia i ryzyka** (tabela R01–R15 z `ClaimBadge`, rodzajem zdarzenia, `EvidenceLink`), **Dokumenty** (wersje, status ekstrakcji), **Powiązania** (kandydaci ze statusem i uzasadnieniem), **Twierdzenia** (`/evidence`).
- Kwoty przez `MoneyAmount`.

### 1C. Evidence Lens (rozbudowa `evidence-drawer`)
- `GET /evidence/{id}`: źródło, data pobrania, wersja, cytat, lokalizacja (strona PDF / akapit DOCX / komórka / pole).
- `GET /documents/{id}/versions/{vid}`: metadane, link do kopii. Podgląd: otwarcie `content_url` zależnie od decyzji backendu (podpisany URL albo `fetch` + `blob:`). Obsłużyć brak kopii i fragmentu komunikatem w panelu.
- Znacznik „dane demonstracyjne” dla `provider: mock`.
- Później (opcjonalnie): podgląd PDF z podświetleniem fragmentu (pdf.js).

### 1D. Expert Studio (`/ekspert`, rola expert)
- Kolejka z `GET /expert/reviews` (filtry status/typ, licznik oczekujących w menu).
- Układ dwukolumnowy: dowód (Evidence Lens inline) obok propozycji.
- Formularz zależny od `target_type` (połączenie, zdarzenie, ryzyko, wzorzec) – reaktywne formularze z jednego rejestru `target_type → komponent`.
- Akcje `approve/correct/reject/request_evidence`, pole `reason` obowiązkowe, `changes` przy `correct`. `POST /expert/decisions` z `expected_revision`.
- `409`: pobrać bieżący rekord, zachować wpisaną korektę, pokazać porównanie (diff pole po polu) i pozwolić ponowić.
- Historia decyzji (`GET /expert/decisions` po `target_type`+`target_id`), własny wpis `POST /expert/records`.
- Błędy `Problem.details` wiązane z polami formularza.

### 1E. Ustawienia i wiedza ekspercka (`/ustawienia`)
- `GET /sector-rules`: edytory katalogu ryzyk R01–R15, checklist wg typu/fazy, wag podobieństwa (suwaki z walidacją sumy).
- `POST /sector-rules` → informacja, że zmiana trafia do kolejki zatwierdzenia.

### 1F. Nowa inwestycja i analiza (`/analiza`)
- Krok 1: formularz projektu (`POST /projects`, `PUT` z `expected_revision`): tytuł, opis, faza, podsektor, rodzaj prac.
- Krok 2: upload PDF/DOCX (`POST /projects/{id}/documents`, opcjonalny `document_id` dla nowej wersji), lista wersji ze statusem ekstrakcji, błędy `413/415`.
- Krok 3: wybór wersji dokumentów (domyślnie aktualne, `[]` = tylko opis) i `POST /assessments` + `JobProgress`. Przy `422` pokazać listę informacji do uzupełnienia.
- Wynik (`/analiza/:assessmentId`): trzy osobne wskaźniki **zagrożenie / kompletność / pewność** (kompletność `null` → „brak podstaw do wyliczenia”); **bliźniaki** (podobieństwa, różnice, nieporównane cechy); **luki** (stan, powód, dowód, czego brakuje); **odchylenia** (liczebność próby, braki, metoda; `insufficient_evidence` jako komunikat, nie liczba); rekomendacje.
- „Uruchom ponownie po uzupełnieniu”, lista zapisanych analiz (`GET /assessments?project_id=`), eksport JSON/CSV.

### 1G. Wspólna obsługa błędów i zadań (przecinające)
- Globalny handler: `401/403` (ekran braku dostępu/logowanie), `404`, błąd sieci (banner + ponów), `409` (kod z `Problem`), `413/415`.
- Zasady `partial`: zachować przejścia do dostępnych wyników.

**Kryterium etapu:** scenariusze odbioru z `frontend.md` przechodzą na mocku (import → kolejka → cytat → korekta → eksport; nowy projekt → analiza → ponowna analiza; konflikt `409`; role).

---

## Etap 2 – Dopracowanie i P1

- **A11y i jakość:** przegląd fokusu, kontrastu, etykiet ARIA, nawigacja klawiaturą w tabelach/drzewie, responsywność.
- **Import i źródła** (`/import`): osobna strona zależnie od decyzji z backendem (`GET /jobs`, rejestr źródeł).
- **P1:** Risk DNA (`/risk-dna`), Chaos Lab (`/assessments/{id}/chaos`), Epidemic Radar (`/epidemic-radar`), Risk Graph (`/graph`; biblioteka grafu, np. Cytoscape), porównanie analiz (`/diff`), monitoring.
- **Integracja z prawdziwym backendem:** wyłączyć mock, przejść scenariusze, poprawić rozbieżności po regeneracji typów.
- **Docker/Compose:** build produkcyjny z reverse proxy `/api` (np. nginx) lub CORS – zależnie od ustaleń.

---

## Co może iść równolegle

**Strumień 0 (tylko po kolei, wąskie gardło):** 0.1 → 0.2 → 0.3/0.4. Reszta etapu 0 rozchodzi się po ustaleniu interfejsów.

Po zakończeniu 0.1–0.4 mogą działać równolegle (bez wspólnych plików):

| Wątek | Zawartość | Zależy od |
|---|---|---|
| A | 0.5 sesja/role/permissions | 0.1 |
| B | 0.6 wspólne komponenty UI | 0.1 |
| C | 0.7 `JobsService` + `JobProgress` | 0.3, 0.4 |
| D | 0.8 fixtures + `mockInterceptor` | 0.2 |
| E | Etykiety PL (`labels.ts`) i mapy statusów | 0.2 |

Po etapie 0 widoki są niezależne (osobne katalogi `features/*`, osobne serwisy API):

| Wątek | Widok | Dodatkowe zależności |
|---|---|---|
| 1A | Repozytorium projektów + import | C |
| 1B | Karta projektu | B, 1C (tylko wywołanie `EvidenceService`) |
| 1C | Evidence Lens | B |
| 1D | Expert Studio | A, B, 1C |
| 1E | Ustawienia / sector-rules | A, B |
| 1F | Nowa inwestycja i analiza | B, C |

Uwagi o kolizjach: wspólne pliki, które mogą dawać konflikty merge (`app.routes.ts`, `labels.ts`, `shared/index`, fixtures), edytować przez dopisywanie na końcu albo rozbić na pliki per feature (`projects.routes.ts` itd.). 1B wymaga tylko stabilnego interfejsu `EvidenceService.open(ref)`, więc nie czeka na gotowy 1C. 1A i 1F nie dzielą kodu poza `JobProgress`.

W Etapie 2 wszystkie widoki P1 (Risk DNA, Chaos Lab, Radar, graf, diff) są wzajemnie niezależne, a a11y/Docker można robić równolegle z nimi.

## Ryzyka i decyzje do potwierdzenia z backendem

Szczegóły w [frontend-braki.md](frontend-braki.md). Najważniejsze, bo wpływają na kod frontu: (1) źródło ról / `GET /me`, (2) sposób dostępu do `content_url` z tokenem, (3) kod i ciało `409`, (4) CORS/proxy w produkcji, (5) czy `openapi.yaml` jest źródłem prawdy dla generacji typów. Do czasu odpowiedzi działamy na mocku i izolujemy każde z tych miejsc w jednym serwisie (`AuthService`, `EvidenceContentService`, `errorInterceptor`), żeby zmiana była lokalna.
