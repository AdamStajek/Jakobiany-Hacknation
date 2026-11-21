# Braki w kontrakcie i planie – uwagi frontendu do backendu

Dokument z perspektywy frontendu (Angular + PrimeNG). Powstał po analizie [frontend.md](frontend.md), [backend.md](backend.md), [data-pipeline.md](data-pipeline.md) i [openapi.yaml](../openapi.yaml). Każdy punkt opisuje, czego frontend potrzebuje, co jest w dokumentach i o co prosimy backend.

Stan na 2026-11-21: backend udostępnia tylko `GET /api/hello`, więc wszystkie punkty dotyczą kontraktu docelowego. Statusy: **BLOKUJE** (nie da się zrobić widoku bez decyzji), **POTRZEBNE** (da się obejść, ale kosztem), **DO POTWIERDZENIA** (pytanie).

---

## 1. Tożsamość i role — BLOKUJE

**Co jest w dokumentach**
- `openapi.yaml`, opis ogólny (ok. l. 38–41): Analityk zarządza swoimi projektami planowanymi i analizami; Ekspert zarządza danymi i wiedzą ekspercką; Operator uruchamia import i odświeżanie oraz przegląda log zadań.
- `openapi.yaml`, `bearerAuth` (ok. l. 749): „Role i identyfikator autora wynikają z uwierzytelnionej tożsamości".
- `frontend.md`, „Obsługa wspólna": „Pokazuj akcje według roli przekazanej przez integrację uwierzytelniania".
- Plan projektu §3.1 nazywa role inaczej: Analityk/inwestor, Ekspert sektorowy, Administrator/operacje.

**Czego brakuje**
- Brak schematu ról (enum), pola `roles` i endpointu typu `GET /me`.
- Brak informacji, skąd frontend bierze token (logowanie? stały token z konfiguracji?).
- Nie wiadomo, czy jedna osoba może mieć kilka ról ani czy operator może zatwierdzać decyzje eksperckie.

**Prośba do backendu**
- `GET /me` → `{ id, name, roles: [...] }` z ustaloną listą wartości (np. `operator`, `analyst`, `expert`).
- Na hackathon wystarczy token ze zmiennej środowiskowej i trzy gotowe tokeny demo (po jednym na rolę). Prosimy o wskazanie, jak je podać frontendowi.
- Macierz uprawnień: która rola może wywołać które operacje (import, enrich, decyzje, `sector-rules`, tworzenie projektu, analiza).

---

## 2. Dostęp do plików z uwierzytelnieniem (Evidence Lens, PDF) — BLOKUJE

**Co jest w dokumentach**
- `GET /documents/{id}/versions/{vid}` zwraca opcjonalne `content_url`, tylko przy dostępnej kopii i prawie odczytu (`openapi.yaml`, ok. l. 273 i 1102).
- `frontend.md`: „Użyj `content_url` do otwarcia kopii".
- `frontend.md`: „Wysyłaj token wyłącznie do własnego API".

**Czego brakuje**
- Link otwierany przez `<iframe>`, `<a>` lub PDF.js nie wyśle nagłówka `Authorization`. Nie wiadomo, czy `content_url` jest publiczny, podpisany czy wymaga tokena.
- Brak formatu zwracanej treści: surowy plik, tekst, czy już z podziałem na strony/akapity.

**Prośba do backendu**
- Wskazać mechanizm: URL podpisany z krótkim TTL **albo** ciasteczko sesyjne **albo** zgoda na pobranie przez `fetch` z nagłówkiem i wyświetlenie jako `blob:`.
- Podać `Content-Type` i obsługę zapytań `Range` (potrzebne dla PDF.js).

---

## 3. Połączenie frontend ↔ backend (proxy, CORS) — POTRZEBNE

**Co jest w kodzie**
- `frontend/proxy.conf.mjs` przekierowuje `/api/**` na `API_URL` (domyślnie `http://localhost:8000`). Działa tylko w `ng serve`.

**Czego brakuje**
- Po buildzie produkcyjnym proxy nie istnieje. Brak informacji, czy w Compose frontend i backend są pod jednym hostem (reverse proxy), czy osobno (wtedy potrzebny CORS).
- `backend/Dockerfile` kopiuje tylko `main.py` (zauważone w `backend.md`).

**Prośba do backendu**
- Potwierdzić model wdrożenia i, jeśli osobne hosty, włączyć CORS dla adresu frontendu (w tym nagłówki `Authorization`, `Idempotency-Key`, `Content-Disposition` w `expose_headers`).
- `Location` i `Content-Disposition` muszą być czytelne dla frontendu (nagłówki eksponowane), inaczej polling zadań i nazwa pliku eksportu nie zadziałają.

---

## 4. Tryb mock i stan systemu — POTRZEBNE

**Co jest w dokumentach**
- `backend.md` §1: bez pliku rzeczywistego backend otwiera bazę `*.mock.db` z danymi demonstracyjnymi i zapisuje `Source.provider = mock`.
- `frontend.md`: „Pokaż „dane demonstracyjne" przy źródłach z `provider: mock`".

**Czego brakuje**
- Brak endpointu informującego o trybie pracy całej aplikacji (mock/rzeczywisty), wersji schematu i gotowości. Frontend wykrywałby tryb dopiero po przejrzeniu źródeł pojedynczych rekordów.

**Prośba do backendu**
- `GET /health` lub `GET /system`: `{ mode: "mock"|"real", schema_version, ready }`, jeśli to możliwe bez tokena.
- Potwierdzić, że `provider` jest widoczny na `Source`/`Evidence` w odpowiedziach list i szczegółów, a nie tylko w pełnym dokumencie.

---

## 5. Zakładka „Import i źródła" nie ma własnych endpointów — POTRZEBNE

**Co jest w dokumentach**
- `frontend.md` opisuje import i ponowne wzbogacanie jako akcje operatora przy repozytorium projektów, a raport z `Job.results` i `Job.report`.
- `data-pipeline.md` wspomina o podsumowaniu przebiegu scrapera (rekordy wejściowe, materiały z każdego źródła, powiązania, błędy), ale bez endpointu.

**Czego brakuje**
- Brak `GET /jobs` (lista, historia importów). Jest tylko `GET /jobs/{job_id}`.
- Brak rejestru źródeł i pobrań (URL, data, dostawca, status), mimo wymogu konkursowego „rejestruj źródła i operacje".
- Brak podsumowania przebiegu scrapera dostępnego w API.

**Prośba do backendu**
- `GET /jobs` z filtrami (`type`, `status`) i paginacją.
- `GET /sources` (lub rozszerzenie `GET /projects/{id}`) z rejestrem pobrań: `provider`, `url`, `fetched_at`, `status` (`found/matched/needs_review/unmatched/error`).
- Do decyzji: czy zakładka ma zostać, czy import wchodzi do listy projektów, tak jak w `frontend.md`.

---

## 6. Konflikt wersji `409` — POTRZEBNE

**Co jest w dokumentach**
- `frontend.md`: przy `409` „pobierz bieżącą wersję, zachowaj wpisaną propozycję korekty i pozwól ekspertowi ponownie porównać zmiany".
- `backend.md`: konflikt rewizji daje `409`; to samo dla `Idempotency-Key` z innymi danymi.

**Czego brakuje**
- Czy ciało `409` zawiera bieżącą rewizję i stan rekordu, czy frontend ma pobierać go osobnym zapytaniem.
- Jak odróżnić `409` od rewizji od `409` od idempotencji (kod w `Problem`).

**Prośba do backendu**
- W `Problem` dla `409` zwracać `code` (np. `revision_conflict`, `idempotency_mismatch`, `document_not_ready`) oraz przy konflikcie rewizji `current_revision` i bieżący rekord.

---

## 7. Paginacja i liczniki w pozostałych listach — POTRZEBNE

**Co jest w dokumentach**
- `GET /projects` zwraca `items` i `total`, z `limit` i `offset`.

**Czego brakuje (do sprawdzenia w OpenAPI)**
- Czy `GET /expert/reviews`, `/expert/decisions`, `/assessments`, `/projects/{id}/evidence` i `/risks` mają tę samą paginację i `total`.
- Licznik oczekujących propozycji w menu eksperta wymaga `total` z `GET /expert/reviews?status=proposed` bez pobierania całej listy.

**Prośba do backendu**
- Ujednolicić paginację (`items`, `total`, `limit`, `offset`) we wszystkich listach.
- Potwierdzić sortowanie domyślne (np. najnowsze pierwsze) i parametry sortowania tam, gdzie lista jest długa.

---

## 8. Stan przetwarzania dokumentów — DO POTWIERDZENIA

**Co jest w dokumentach**
- `backend.md` §3: ekstrakcja ma stan `queued/running/ready/failed`.
- `POST /assessments` zwraca `409`, gdy wersja dokumentu nie jest gotowa do ekstrakcji.

**Czego brakuje**
- Gdzie frontend czyta stan ekstrakcji po uploadzie: w odpowiedzi `POST /projects/{id}/documents` (202 + `Job`), w `GET /documents/{id}/versions/{vid}` czy w obu.
- Frontend ma blokować przycisk „Analizuj" do czasu `ready`, więc potrzebuje jednego pewnego miejsca odczytu.

**Prośba do backendu**
- Potwierdzić, że `DocumentVersion` ma pole `extraction_status` oraz że upload zwraca `Job`.

---

## 9. Nazwy i wartości wyliczeniowe — DO POTWIERDZENIA

Frontend pokazuje polskie etykiety, więc potrzebuje stałych wartości wyliczeniowych w API (nie opisów tekstowych):

| Obszar | Wartości do potwierdzenia |
|---|---|
| Typ twierdzenia | `SOURCE_FACT`, `CALCULATED`, `MODEL_INFERENCE` |
| Rodzaj zdarzenia | `OBSERVED_EVENT`, `POTENTIAL_RISK` |
| Status eksperta | `proposed`, `approved`, `corrected`, `rejected`, `needs_evidence`, `superseded` |
| Status zadania | `queued`, `running`, `succeeded`, `partial`, `failed` |
| Status dopasowania | `found`, `matched`, `needs_review`, `unmatched`, `error` |
| Stan luki informacyjnej | `confirmed`, `partially_confirmed`, `confirmed_not_done` i pozostałe z planu §4.5 (brak w paczce, dokument nie porusza tematu, sprzeczne źródła, nie dotyczy) |
| Pewność wniosku | `low`, `moderate`, `high` (plan §4.6 mówi o kategoriach, bez nazw) |

**Prośba do backendu:** potwierdzić, że wartości w `openapi.yaml` odpowiadają powyższej tabeli, i zgłosić różnice. Frontend ma wymóg: statusy czytelne bez koloru, więc każdy status musi mieć stałą wartość i polską etykietę po stronie frontu.

---

## 10. Generowanie typów z OpenAPI — POTRZEBNE

- Zamiast ręcznie utrzymywać `core/models.ts`, frontend wygeneruje typy z `docs/openapi.yaml`.
- Prośba: nie zmieniać nazw pól i ścieżek bez zmiany wersji w `info.version`. Każdą zmianę kontraktu opisać w commicie, żeby frontend mógł ją wychwycić po regeneracji.
- Do potwierdzenia: czy `openapi.yaml` jest źródłem prawdy, czy backend FastAPI wystawi własny `/openapi.json`. Ten drugi powinien być zgodny z plikiem w repo.

---

## 11. Rzeczy poza P0, o które pytamy z wyprzedzeniem

- **Risk DNA / Chaos Lab / Radar / graf:** ścieżki są w OpenAPI (`/risk-dna`, `/assessments/{id}/chaos`, `/epidemic-radar`, `/assessments/{id}/graph`, `/assessments/{id}/diff`). Prośba o potwierdzenie, czy zwracają dane tylko po zatwierdzeniu Risk DNA oraz jak wygląda odpowiedź przy braku wystarczającej próby (komunikat zamiast pustej listy).
- **Monitoring (`/projects/{id}/monitoring`):** czy ma być widoczny w UI w pierwszej wersji.

---

## Podsumowanie priorytetów

| # | Temat | Status |
|---|---|---|
| 1 | Tożsamość, role, `GET /me` | BLOKUJE |
| 2 | Dostęp do plików z tokenem (`content_url`) | BLOKUJE |
| 3 | Proxy / CORS / eksponowane nagłówki | POTRZEBNE |
| 4 | Tryb mock / `GET /health` | POTRZEBNE |
| 5 | `GET /jobs`, rejestr źródeł | POTRZEBNE |
| 6 | Kody i ciało `409` | POTRZEBNE |
| 7 | Spójna paginacja i `total` | POTRZEBNE |
| 8 | Stan ekstrakcji dokumentu | DO POTWIERDZENIA |
| 9 | Wartości wyliczeniowe | DO POTWIERDZENIA |
| 10 | Typy z OpenAPI jako źródło prawdy | POTRZEBNE |
| 11 | Zakres P1 | DO POTWIERDZENIA |

Niepewności po stronie frontendu: nie czytałem całego `openapi.yaml` (1766 linii), więc punkty 7–9 wymagają sprawdzenia w schematach, zanim backend uzna je za luki.
