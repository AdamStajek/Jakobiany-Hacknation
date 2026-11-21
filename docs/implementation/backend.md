# Backend Risk Miner

Rozwijaj `backend/` w Pythonie 3.13, FastAPI i `uv`. `backend/main.py` jest punktem wejścia i udostępnia `GET /api/hello`. Rejestruj routery domenowe pod `/api/v1`, zgodnie z [OpenAPI](../openapi.yaml). Podziel kod według odpowiedzialności na obsługę HTTP, zadania i analizę oraz zapis SQLite. Po wydzieleniu modułów i migracji dodaj je do obrazu, bo `backend/Dockerfile` kopiuje dziś tylko `main.py`.

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

Po P0 dodaj Risk DNA i testy Chaos Lab przypięte do zatwierdzonej wersji wzorca. [Wymagania konkursowe](../MFiPR_-_Pena_tre_zadania_konkursowego.md) · [Katalog R01–R15 i fazy](../Risk_Miner_material_porady_fazy_dokumenty_ryzyka_ciekawostki.md) · [Checklista wodociągowa](../Risk_Miner_material_ekspercki_przygotowanie_inw_wodociagowej.md) · [Frontend](frontend.md)
