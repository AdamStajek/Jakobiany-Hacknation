# Backend Risk Miner

Backend działa w Pythonie 3.13, FastAPI i `uv`. `backend/main.py` obsługuje HTTP i udostępnia trasy pod `/api/v1` oraz `GET /api/hello`. Moduły domenowe odpowiadają za import, wzbogacanie, przetwarzanie plików, decyzje, analizy i zapis SQLite. Obraz Dockera zawiera moduły, adaptery i współdzielony kontrakt. [OpenAPI](../openapi.yaml)

## 1. Start aplikacji i baza

| Stan przy starcie | Działanie |
| --- | --- |
| `RISK_MINER_DB_PATH` wskazuje plik Risk Minera w obsługiwanej wersji | Otwórz bazę i zastosuj potrzebne wspólne migracje. Źródła i projekty ze scrapera mają być dostępne przez API od pierwszego odczytu. |
| Brakuje pliku | W tym samym katalogu otwórz bazę z dopiskiem `.mock` przed rozszerzeniem. Jeśli jeszcze nie istnieje, uruchom te same migracje i transakcyjnie dodaj dane demonstracyjne. |
| Plik jest pusty, uszkodzony, nieczytelny lub ma nieobsługiwany schemat | Zakończ start z komunikatem zawierającym ścieżkę i przyczynę. |

Domyślne ścieżki to `data/risk-miner.db` i `data/risk-miner.mock.db`. W kontenerze ustaw `RISK_MINER_DB_PATH` na ścieżkę trwałego montażu. Wybierz bazę raz na start procesu i zaloguj ścieżkę oraz tryb. Po dostarczeniu pliku scrapera wystarczy restart. Bazy rzeczywiste i demonstracyjne mają oddzielny stan. Seed demonstracyjny dodaje historyczny projekt z dowodem, oczekującą decyzją i danymi do analizy porównawczej. Zapisz `Source.provider = mock`, aby frontend identyfikował przykładowe źródła. Podstawowe demo działa na tych rekordach bez zapytań do internetu. [Wspólny schemat i zapis pliku](data-pipeline.md)

## 2. Projekty, import i zadania P0

- Udostępnij filtrowane `GET /projects`, kartę `GET /projects/{id}` i zapis projektu planowanego. `POST /projects` tworzy `kind=planned` i `status=planned`. `PUT` sprawdza `expected_revision`, zapisuje kolejną rewizję i zachowuje dokumenty oraz wyniki analiz. Historia projektu wynika z dat potwierdzonych przez źródła. Kandydatów pokaż w `links`.
- `POST /imports` przyjmuje XLSX lub CSV UTF-8. Waliduj identyfikator rekordu, tytuł oraz parę typu i wartości identyfikatora źródłowego. Zachowaj surowe pola i numer wiersza. Zapisuj po identyfikatorze rekordu z zachowaniem poprzednich wersji i decyzji. Poprawne wiersze przetwarzaj pomimo błędów innych wierszy.
- Import i `POST /projects/{id}/enrich` korzystają ze wspólnych adapterów i kolejności pobranie → zapis źródeł i wersji → dopasowanie → ekstrakcja. Dopasuj po potwierdzonym kluczu i zgodnym kontekście. Dla niejednoznacznych przypadków zapisz przesłanki za i przeciw oraz `needs_review`. Ten sam ekstraktor obsługuje materiały zapisane przez scraper i nowe pliki użytkownika.
- Zapisz `Job` przed przyjęciem zadania. Zwróć `202` z nagłówkiem `Location` wskazującym `GET /jobs/{job_id}`. Przejścia to `queued` → `running` → `succeeded`, `partial` lub `failed`. Przy `partial` zachowaj użyteczne wyniki. Poprawnie zakończone wyszukiwanie bez dopasowania może mieć `succeeded` z `unmatched` w raporcie. Zapisuj `results` jako odsyłacze do istniejących zasobów, a problemy po przyjęciu zadania umieszczaj w `report`.
- Dla operacji, które przewidują `Idempotency-Key`, utrwal klucz w zakresie tożsamości, metody i ścieżki. Identyczny klucz i dane zwracają pierwotną odpowiedź. Zmienione dane pod tym kluczem zwracają `409`. Deduplikuj rekordy i wersje również bez klucza.

## 3. Dokumenty, dowody i ekspert P0

- `POST /projects/{id}/documents` przyjmuje PDF z warstwą tekstową lub DOCX. Sprawdź limit, faktyczny typ pliku i przynależność podanego `document_id`. Oblicz SHA-256 i użyj istniejącej wersji przy identycznym dokumencie oraz treści. Utrwal tekst w podziale na strony lub akapity. Zapisz kolejkę lub stan ekstrakcji (`queued`, `running`, `ready`, `failed`).
- Zapisuj `SOURCE_FACT` z dowodem, `CALCULATED` z metodą i wejściowymi faktami oraz `MODEL_INFERENCE` z uzasadnieniem pewności. Sprawdź cytat w tekście wskazanej wersji. `char_offsets` liczy znaki od zera i wyklucza koniec zakresu. Brak weryfikowalnego cytatu oznacza pominięcie pola `quote`. Klasyfikuj R01–R15 według materiału eksperckiego. Rozróżniaj `OBSERVED_EVENT` i `POTENTIAL_RISK`. Podstawa prawna aneksu jest odrębnym polem od udokumentowanej przyczyny.
- `GET /expert/reviews` domyślnie pokazuje `proposed` i `needs_evidence`. `POST /expert/records` tworzy propozycję z dowodami. W `POST /expert/decisions` pobierz autora z uwierzytelnionej tożsamości, sprawdź rewizję i dopuszczalne pola korekty. Korekta zastępuje wskazane pola, w tym całe wskazane kolekcje. Sprawdź wynikowy rekord, relacje i dowody. Zapisz nową rewizję, `before`, `after` i powód w jednej transakcji. Konflikt daje `409`. Dalsza analiza korzysta z udokumentowanych danych i wniosków `approved` lub `corrected`. Reguły sektorowe też aktywuj decyzją eksperta.

## 4. Ocena projektu i eksport P0

1. Przy `POST /assessments` sprawdź dostęp do planowanego projektu i wybranych wersji. Pominięte `document_version_ids` wybiera aktualne wersje, `[]` wybiera sam opis. Wersja niedostępna do ekstrakcji daje `409`. Brak opisu i gotowego tekstu daje `422` z listą danych do podania.
2. Przy tworzeniu analizy przypnij rewizję projektu, dokumenty, reguły, wersję metody i stan wiedzy. Porównuj zakończone projekty po udokumentowanych cechach i treści, używając zatwierdzonych wag. Pomijaj nieporównywalne cechy w mianowniku podobieństwa i zwracaj je w `missing_features`. Gdy brak wspólnej cechy z dodatnią wagą, pomiń kandydata. Uzasadnienie wskazuje konkretne podobieństwa, różnice i źródła.
3. Wybierz checklistę dla podsektora i fazy. Kompletność to `Σ(waga × pokrycie) / Σ(waga)` po pozycjach mających zastosowanie. `confirmed` i udokumentowane `confirmed_not_done` mają pokrycie `1`, `partially_confirmed` ma `0.5`, a pozostałe pozycje mają `0` z wyjątkiem wyłączonego `not_applicable`. Użyj `null`, gdy mianownik jest zerowy. Zwracaj oddzielnie zagrożenie i pewność wniosków. Rekomendacja wskazuje dowód oraz powiązane ryzyko, lukę, fakt lub przypadek.
4. Odchylenia kosztów i terminów obliczaj z porównywalnych wartości bazowych i końcowych. Raportuj osobno dla obu miar liczebność próby, odsetek braków i podstawy porównania. Zwracaj `insufficient_evidence` bez przedziału przy niedostatecznych danych. Eksport analizy czyta zapisaną migawkę. Eksport projektu obejmuje chronologię, powiązania, wnioski i historię decyzji. Oba zachowują dowody. CSV UTF-8 ma nagłówek `record_type,record_id,data_json` i zaczyna dane od wiersza `export_metadata`.

## 5. Dostęp i odbiór

Weryfikuj bearer token, rolę i dostęp do każdego projektu, zadania, dowodu, pliku i eksportu. Błędy zwracaj jako `Problem` zgodnie z kontraktem. Model, dostawcę, sekrety i adresy adapterów konfiguruj przy wdrożeniu. W konfiguracji przykładowej podaj wymagane ustawienia, region przetwarzania i licencję.

- Uruchom bez pliku realnego, wykonaj decyzję w mocku i zweryfikuj ją po restarcie. Dostarcz gotowy plik scrapera i po restarcie sprawdź projekty z tego pliku. Pusty lub niezgodny plik powinien zgłosić błąd przed przyjęciem żądań.
- Powtórz import arkusza. Liczba rekordów wejściowych pozostaje 22. Sprawdź ponowienie z tym samym kluczem, konflikt po zmianie danych i częściowy wynik przy wadliwym wierszu.
- Wykonaj decyzję i spróbuj skorygować nieaktualną rewizję. Sprawdź źródło cytatu, `409` oraz historię. Dodaj wersję dokumentu, uruchom kolejną ocenę i porównaj eksport starej migawki. Sprawdź odmowę dostępu do obcego dowodu, pliku i eksportu.

Ścieżka P1 dodaje Risk DNA oraz testy Chaos Lab przypięte do zatwierdzonej wersji wzorca. [Wymagania konkursowe](../MFiPR_-_Pena_tre_zadania_konkursowego.md) · [Katalog R01–R15 i fazy](../Risk_Miner_material_porady_fazy_dokumenty_ryzyka_ciekawostki.md) · [Checklista wodociągowa](../Risk_Miner_material_ekspercki_przygotowanie_inw_wodociagowej.md) · [Frontend](frontend.md)

## 6. Uruchomienie i odbiór implementacji

Z katalogu repozytorium uruchom backend w Pythonie 3.13. Przy braku bazy rzeczywistej aplikacja otworzy osobną bazę demonstracyjną z przypadkiem historycznym, dowodami i kolejką eksperta.

```bash
RISK_MINER_OFFLINE=1 uv run --project backend --locked uvicorn --app-dir backend main:app
curl -H 'Authorization: Bearer demo' http://127.0.0.1:8000/api/v1/projects
```

- Kontrakt jest dostępny pod `/openapi.json`, a interfejs do wywoływania API pod `/docs`. `GET /api/hello` służy dotychczasowemu ekranowi startowemu.
- Baza demonstracyjna rozpoznaje tokeny `demo-analyst`, `demo-expert`, `demo-operator` oraz `demo` do przetestowania całej ścieżki jedną tożsamością. Projekty planowane, analizy, dokumenty i dowody dziedziczą dostęp właściciela projektu. Projekty historyczne są wspólne dla uwierzytelnionych użytkowników. Baza rzeczywista wymaga ustawienia `RISK_MINER_TOKENS` jako mapy tokenów na identyfikatory i role.
- Compose utrwala pliki w lokalnym `data/`. Uruchomienie `docker compose up --build backend` udostępnia port 8000. Wdrożenie korzysta z jednego procesu aplikacji na plik SQLite. Lekki worker wznawia przerwane zadania po restarcie. Konfigurację lokalną można wczytać przez `uv run --env-file`. [Przykładowa konfiguracja](../../backend/.env.example)
- P0 obejmuje import XLSX/CSV, adaptery BZP i TED, wersje PDF/DOCX, dowody, decyzje, analizę i eksport. `GET /documents/{document_id}/versions/{version_id}/content` dostarcza uwierzytelniony załącznik pod adresem `content_url`. P1 obejmuje Risk DNA, testy Chaos Lab, graf, porównanie migawek i Epidemic Radar grupujący zatwierdzone zdarzenia według kodu. Okresowe wzbogacanie można włączyć dla projektu w realizacji.
- Domyślna ekstrakcja stosuje lokalne reguły i zachowuje dosłowne cytaty. Opcjonalny model zgodny z Chat Completions otrzymuje ograniczone fragmenty przesłanego dokumentu i katalog ryzyk. Backend zwraca wnioski modelu do weryfikacji po potwierdzeniu cytatu w odpowiedniej wersji. Przy wyłączonym modelu dokumenty są przetwarzane w środowisku wdrożenia. Przy włączonym modelu region i licencja wynikają z wybranego wdrożenia i modelu. Główne biblioteki to FastAPI, openpyxl, jsonschema i PyYAML (MIT), Uvicorn i pypdf (BSD-3-Clause), defusedxml (PSFL) oraz python-multipart (Apache-2.0).

### Zasilenie bazy rzeczywistej

Uruchom kopię organizatora w osobnym procesie poleceniem `python3 bzp/bzp_mirror.py`. Sprawdź adres wypisany przez serwer. Poniższe polecenie pobiera ogłoszenia wyłącznie z tej kopii. Po utworzeniu bazy ustaw tokeny i uruchom ponownie backend.

```bash
RISK_MINER_OFFLINE=0 RISK_MINER_BZP_URL=http://127.0.0.1:8010 RISK_MINER_TED_URL= \
  uv run --project backend --locked python backend/scrape.py --input docs/Risk_Miner_dane_projekty.xlsx
```

Adresy dostawców definiuje operator wdrożenia. Przy włączonym TED adapter przyjmuje numery publikacji przez `references`. `RISK_MINER_TED_CONTEXT=1` uruchamia też wyszukiwanie na podstawie publicznych tytułów i nazw zamawiających projektów historycznych. BZP używa numeru ogłoszenia, wspólnego OCID i zgodności zamawiającego oraz przedmiotu. W przypadkach bez wystarczającego klucza zapisuje kandydatów. [Oficjalna dokumentacja BZP](https://ezamowienia.gov.pl/pl/integracja/) · [Dokumentacja TED Search API](https://docs.ted.europa.eu/api/latest/search.html)

### Metoda i granice pilotażu

- Wzmianka tekstowa daje częściowe pokrycie. Pełne potwierdzenie, udokumentowane niewykonanie i brak zastosowania można wyrazić zatwierdzonym faktem z kluczem `check.<kod wymagania>` i polem `value.state`. Metoda startowa obejmuje checklistę sieci wodociągowej dla planowania i przygotowania. Sektorowe reguły uruchamiają się po dopasowaniu dosłownej frazy lub warunku `kod_wymagania=stan`.
- Bliźniaki porównują cechy strukturalne i tekst według zatwierdzonych wag. Zakres odchyleń wymaga minimum trzech porównywalnych przypadków z wynikiem podobieństwa co najmniej 0,35. Porównanie kosztów wymaga jednej identyfikowalnej umowy, zgodnej waluty i ustalonego VAT. Brak porównywalnej próby daje `insufficient_evidence` z liczebnością i odsetkiem braków.
- Chaos Lab porównuje założone opóźnienie dostępu z zatwierdzonym faktem `land_access_schedule_buffer_days` z migawki. Bez udokumentowanego zapasu raportuje brak potwierdzenia w pakiecie.
- Ekstrakcja BZP normalizuje udokumentowane daty, części postępowań, umowy i aneksy z odczytanych sekcji ogłoszeń. Rekordy bez potwierdzenia umowy zachowują podstawę `notice_only`. Pakiet demonstracyjny ma dane syntetyczne. OCR, rozpoznawanie załączników na zewnętrznych platformach oraz dane GIS pozostają kolejnymi etapami.

### Testy

```bash
PYTHONPATH=backend uv run --project backend --locked python -m unittest discover -s backend/tests -v
uv run --project backend --locked ruff check backend
uv run --project backend --locked ruff format --check backend
```

Testy uruchamiają rzeczywiste trasy FastAPI na tymczasowej bazie. Obejmują 22 wiersze XLSX, błędny wiersz CSV i idempotencję, cytat i plik DOCX, nową wersję PDF, izolację dostępu, eksport migawki, trwałą decyzję eksperta, konflikt rewizji, aktywację reguł i przypięcie rewizji Risk DNA.

W próbie z lokalną kopią BZP dwa importy utrzymały 22 rekordy arkusza. Pobranie odnalezionych 67 ogłoszeń dało 54 wpisy raportu `matched` i 13 wpisów `needs_review`. Projekt `RM-2026-009` zachował dwie części i dwie umowy z odrębnymi datami wykonania. Adapter TED sprawdzono po numerze publicznego ogłoszenia `109169-2019`. Wyniki dopasowania raportują zastosowaną metodę. Ocena trafności wymaga zbioru referencyjnego.
