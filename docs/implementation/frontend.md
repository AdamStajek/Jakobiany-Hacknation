# Frontend Risk Miner

Rozwijaj `frontend/src/app/` w istniejącym stosie Angular, PrimeNG i Tailwind. Zastąp ekran demonstracyjny widokami produktu. Używaj `HttpClient`, względnych adresów `/api/v1` i istniejącego proxy do FastAPI. Typy żądań, odpowiedzi i statusów oprzyj na [OpenAPI](../openapi.yaml). Szkielet backendu udostępnia obecnie `GET /api/hello`.

## Kolejność P0

### 1. Repozytorium i historia inwestycji

- Odczytuj `GET /projects` z parametrami `q`, `kind`, `status`, `subsector`, `enrichment_status`, `limit` i `offset`. Wyświetl `items` i `total` zwrócone przez serwer. Przy zmianie filtra zacznij od pierwszej strony. Wiersz pokazuje tytuł, identyfikator, status projektu i wzbogacenia oraz liczniki postępowań, powiązań i ryzyk.
- Operator uruchamia import przez `POST /imports` (`multipart/form-data`, pole `file`) albo ponowne wzbogacenie przez `POST /projects/{project_id}/enrich`. Po zakończeniu użyj `Job.results`, aby przejść do zapisanych projektów. Raport pokazuje wiersz, etap, wynik i komunikat błędu.
- Kartę pobierz z `GET /projects/{project_id}`. Pokaż hierarchię postępowań, części i umów, listę ogłoszeń, zmiany, dokumenty i oś czasu. Kandydaci do powiązania mają własny status oraz uzasadnienie. Z `GET /projects/{project_id}/evidence` pobierz twierdzenia, a z `/risks` zdarzenia i ryzyka. Kwoty opisz rodzajem, walutą i VAT.

### 2. Evidence Lens i Expert Studio

- Każdy dostępny `evidence_id` otwiera `GET /evidence/{evidence_id}`. Pokaż źródło, datę pobrania, wersję, dostępny cytat i lokalizację (stronę PDF, akapit DOCX, komórkę tabeli lub pole rekordu). Metadane konkretnej wersji uzyskasz przez `GET /documents/{document_id}/versions/{version_id}`. Użyj `content_url` do otwarcia kopii, gdy API ją udostępnia. Brak kopii lub fragmentu komunikuj w panelu.
- `GET /expert/reviews` zasila kolejkę. Pokaż dowód obok propozycji i użyj formularza właściwego dla `target_type`. `POST /expert/decisions` wysyła typ i ID rekordu, `expected_revision`, `reason` oraz akcję `approve`, `correct`, `reject` lub `request_evidence`. Pole `changes` wysyłaj przy `correct`. Po `201` odśwież rekord i historię. Przy `409` pobierz bieżącą wersję, zachowaj wpisaną propozycję korekty i pozwól ekspertowi ponownie porównać zmiany.
- Historię odczytuj z `GET /expert/decisions` po `target_type` i `target_id`. Własny wpis twórz przez `POST /expert/records`. Formularze katalogu, checklist i wag oprzyj na `GET /sector-rules`. Zmianę reguł wyślij przez `POST /sector-rules` i pokaż ją w kolejce do zatwierdzenia.

### 3. Nowy projekt i analiza

- `POST /projects` zapisuje tytuł oraz podane informacje o projekcie (opis, fazę, podsektor i rodzaj prac). `PUT /projects/{project_id}` aktualizuje projekt z `expected_revision`. Plik PDF lub DOCX prześlij do `POST /projects/{project_id}/documents`. Gdy użytkownik dodaje wersję istniejącego dokumentu, podaj `document_id`.
- Po przetworzeniu plików uruchom `POST /assessments` z `project_id`. Pominięte `document_version_ids` wybiera aktualne wersje, `[]` oznacza analizę samego opisu, a jawny wybór przekazuje ID gotowych wersji. Przy braku opisu i gotowych dokumentów pokaż informacje do uzupełnienia z odpowiedzi `422`.
- Odczytaj analizę, bliźniaki i luki spod `/assessments/{assessment_id}` oraz jego `/twins` i `/gaps`. Pokaż osobno zagrożenie, kompletność i pewność wniosku. Przy `completeness.score = null` pokaż brak podstaw do wyliczenia. Dla bliźniaka pokaż podobieństwa, różnice i nieporównane cechy. Dla luki pokaż stan, powód, dowód i informację potrzebną do uzupełnienia. Dla odchyleń pokaż liczebność próby, braki i metodę. `insufficient_evidence` wyświetl jako ocenę, że dostępne dane nie pozwalają podać przedziału.
- Po uzupełnieniu danych pozwól uruchomić nową analizę. Listę zapisanych wyników pobieraj przez `GET /assessments?project_id=…`. Z karty projektu i kokpitu pobieraj serwerowy eksport przez ich zasób `/export?format=json` lub `csv`. Uwzględnij nazwę z `Content-Disposition`.

## Obsługa wspólna

- Po `202` odczytuj zadanie spod `Location`. Pokaż `queued` i `running` jako postęp. Zatrzymaj odpytywanie przy `succeeded`, `partial`, `failed` oraz po opuszczeniu widoku. Przy `partial` pozostaw przejścia do dostępnych wyników. Przy świadomym ponowieniu zadania użyj nowego `Idempotency-Key`, a przy powtórzeniu tego samego żądania po przerwanym połączeniu zachowaj klucz.
- Obsłuż ładowanie, pustą listę, błąd połączenia, brak dostępu (`401`/`403`), niewidoczny zasób (`404`), konflikt (`409`) i błędy pliku (`413`/`415`). `Problem.details` powiąż z polami formularza. Pokazuj akcje według roli przekazanej przez integrację uwierzytelniania. Wysyłaj token wyłącznie do własnego API.
- Oznacz typ twierdzenia, status eksperta i różnicę między zdarzeniem historycznym a przyszłym ryzykiem. Pokaż „dane demonstracyjne” przy źródłach z `provider: mock`. Zachowaj rozróżnienie między brakiem informacji w paczce, sprzecznością i potwierdzonym niewykonaniem czynności. Używaj polskich etykiet, widocznego fokusu i statusów czytelnych bez koloru.

## Odbiór

1. Uruchom `npm ci` i `npm run build` w `frontend/` oraz aplikację przez Compose.
2. Przejdź od importu lub gotowego projektu historycznego do kolejki, cytatu, korekty eksperta i eksportu. Po odświeżeniu sprawdź historię i rewizję. Na dwóch otwartych formularzach sprawdź konflikt `409`.
3. Zapisz nowy projekt, przeanalizuj sam opis, dodaj dokument i uruchom kolejną analizę. Otwórz obie migawki. Sprawdź rolę operatora i analityka, częściowy wynik zadania oraz eksport JSON/CSV.

Po P0 wdrażaj widoki Risk DNA, Chaos Lab, grafu i porównania analiz. [Plan projektu, §7–8](../Risk_Miner_2_0_Plan_Projektu.md#7-interfejs-i-nawigacja) · [Backend](backend.md)
