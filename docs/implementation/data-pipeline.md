# Web scraping i baza danych Risk Miner

Skrypt pobiera publiczne dane i tworzy plik SQLite, który backend otwiera po uruchomieniu. Scraper, backend i baza demonstracyjna korzystają z tych samych migracji. Adaptery w `backend/connectors/` mają działać zarówno z CLI, jak i w zadaniach wzbogacania backendu. [Instrukcja backendu](backend.md)

## 1. Uruchomienie i wynik skryptu

Zaimplementuj jedno wejście `backend/scrape.py` przyjmujące `--input` z arkuszem. Ten przykład pokazuje docelowe uruchomienie z katalogu głównego repozytorium.

```bash
uv run --project backend python backend/scrape.py --input docs/Risk_Miner_dane_projekty.xlsx
```

- `RISK_MINER_DB_PATH` ustala plik wyjściowy. Domyślnie to `data/risk-miner.db`. W Compose zamontuj katalog z bazą i ustaw backendowi ścieżkę do tego samego pliku wewnątrz kontenera. Skrypt zasilający korzysta z pliku rzeczywistego, a ścieżkę `.mock.db` obsługuje backend.
- Konfiguruj adres bazowy BZP i wybrane drugie źródło. Dla każdego przebiegu zapisz podsumowanie liczby rekordów wejściowych, materiałów z każdego źródła, potwierdzonych i niepewnych powiązań oraz błędów. Przy wyniku częściowym wskaż, które etapy zakończyły się użytecznym zapisem.
- Plik gotowy do przekazania zawiera schemat, rekordy wejściowe, powiązane źródła, surowe odpowiedzi i zapisane materiały z dowodami. Backend ma odczytać projekty od razu po starcie. Ekstrakcję analityczną i decyzje eksperckie wykonuje backend.

## 2. Import i mapowanie arkusza

Czytaj arkusz `Projekty` według nagłówków. `Opis kolumn` opisuje znaczenie pól. Utrwal kopię wartości i numer wiersza. Import ponawiaj po `Identyfikatorze rekordu`, zachowując historię zmian. [Plik wejściowy](../Risk_Miner_dane_projekty.xlsx)

| Kolumna | Zapis |
| --- | --- |
| `Identyfikator rekordu` | Trwały identyfikator projektu historycznego dla wsadu konkursowego. |
| `Nazwa przedsięwzięcia` | Tytuł projektu. |
| `Rodzaj identyfikatora publicznego` i `Identyfikator publiczny` | Para typu (`bzp` lub `kpo`) i oryginalnej wartości. Wartość do wyszukiwania trzymaj osobno. |
| `Zakres rekordu` | `seed_scope.level` jako `procedure` albo `part`. Dla `część 1` i `część 2` zachowaj numer części. |
| Dane odbiorcy, NIP, siedziba i województwo | `beneficiary` z identyfikatorem i siedzibą. `works_location` wypełnij ze źródła potwierdzającego miejsce robót. |
| `Status przedsięwzięcia` | `Zakończone` mapuj na `completed` na poziomie projektu. Stan umów ustalaj z ogłoszeń i dokumentów. |

Oczekiwany pełny wsad to 22 wiersze danych, w tym 15 z BZP i 7 z KPO, 20 na poziomie postępowania i 2 na poziomie części. Zachowaj zera wiodące w identyfikatorach. Wadliwy wiersz raportuj z przyczyną i kontynuuj przetwarzanie pozostałych.

## 3. Pobranie i dopasowanie

1. **BZP.** Zacznij od `GET /mo-board/api/v1/notice` po `NoticeNumber` i `NoticeType`. Zachowaj `noticeNumber` z wersją, `objectId` i `tenderId`/OCID. Pytaj osobno o `ContractNotice`, `TenderResultNotice`, `AgreementUpdateNotice` i `ContractPerformingNotice` zależnie od rodzaju poszukiwanego materiału. Zawężaj zapytania o dalsze ogłoszenia według znanych dat, zamawiającego i przedmiotu. Ustawiaj `PageSize` jawnie, przekazuj `objectId` ostatniego wyniku jako `SearchAfter` i wykrywaj powtórzenie kursora. Wyniki filtruj po `tenderId` po stronie klienta.
2. **Drugie źródło i KPO.** Wybierz dostępny TED, BK2021 lub BIP, w którym można potwierdzić związek z projektem. Pobierz przynajmniej jeden rzeczywisty rekord lub dokument. Do wyszukiwania dla KPO użyj identyfikatora projektu, nazwy, zamawiającego i kontekstu. Preferuj API i dopiero przy jego braku parsuj publiczne strony. Ustal timeouty, limity rozmiaru i ograniczone ponowienia błędów przejściowych. Odróżniaj pustą odpowiedź od błędu źródła lub ograniczenia kopii.
3. **Weryfikacja.** Identyfikator i zgodność zamówienia pozwalają zapisać `matched`. Przy braku jednoznaczności zachowaj `needs_review` z przesłankami za i przeciw. `found` oznacza odnaleziony materiał, `unmatched` brak dopasowania, a `error` błąd. Zapisz oryginalny URL, adres pobrania przy użyciu kopii, czas UTC, dostawcę, identyfikator, wersję i treść. Dla ogłoszenia dowód może wskazywać konkretne pole rekordu, np. `noticeNumber`.

**Sprawdzenie adaptera BZP.** Jeśli masz lokalną paczkę, uruchom `python3 bzp/bzp_mirror.py` i użyj adresu wypisanego przy starcie. Wyślij `NoticeType=ContractNotice` i `NoticeNumber=2022/BZP 00058537/01`. `X-Mirror-Missing-Type` oznacza ograniczenie kopii. Materiał organizatora wskazuje także kopię `https://bzp.cytr.us`. [Źródła i typy dokumentów](../Risk_Miner_material_porady_fazy_dokumenty_ryzyka_ciekawostki.md#31-gdzie-dokumenty-mogą-być-publikowane)

## 4. Schemat i zapis SQLite

| Obszar | Reguła zapisu |
| --- | --- |
| Projekty i zamówienia | Osobne encje projektu, postępowania, części, ogłoszenia, umowy i zmian. Postępowanie może mieć wiele części, ogłoszeń i umów. Powiąż umowę z częściami, gdy źródło to potwierdza. Ogłoszenia deduplikuj według dostawcy i jego trwałego ID, np. `objectId` BZP. |
| Dokumenty i dowody | Unikalność `(document_id, sha256)`. Przechowuj wersje i zależności zastąpienia. Dowód wskazuje źródło, lokalizację i dla PDF/DOCX konkretną wersję. Tekst lub plik pozyskany przez scraper ma być dostępny po przeniesieniu DB. |
| Daty i kwoty | Rozdziel termin bazowy, zmieniony i rzeczywisty. Kwoty zapisuj z rodzajem, walutą, statusem VAT i datą odniesienia, bez utraty precyzji. |
| Stan aplikacji | Utrwal raporty zadań i klucze idempotencji. Zmianę rewizji i decyzję eksperta zapisuj w jednej transakcji. Migawki analiz przypinają projekt, dokumenty, reguły, metodę, stan wiedzy, wynik oraz dowody. |

- Wspólne migracje zapisują identyfikator aplikacji i wersję schematu. Włącz klucze obce dla każdego połączenia. Indeksuj klucze używane do wyszukiwania po identyfikatorach zewnętrznych oraz odczytu historii projektu i kolejki eksperta. Mapuj zapis na schematy [OpenAPI](../openapi.yaml).
- Pierwszą bazę zbuduj w pliku tymczasowym w katalogu docelowym. Po zatwierdzeniu transakcji sprawdź integralność (`PRAGMA quick_check`), klucze obce (`PRAGMA foreign_key_check`) i obecność pobranego materiału. Zapisz wszystkie zmiany do głównego pliku SQLite przed przekazaniem. Zamknij połączenie i opublikuj kompletny plik atomowo pod wolną ścieżką. Przy ponownym uruchomieniu aktualizuj istniejące rekordy źródłowe w transakcjach. Prowadź zapytania sieciowe poza transakcją zapisu. Zachowaj projekty użytkowników, decyzje i stare wersje, do których prowadzą dowody.

## Odbiór

1. Zbuduj bazę z arkusza i sprawdź powiązane źródła BZP oraz drugiego publicznego serwisu. Przekaż plik backendowi i odczytaj projekt oraz dowód przez API.
2. Uruchom ponownie z tym samym wsadem. Porównaj liczbę rekordów i wersji, sprawdź oba zakresy części postępowań, decyzję eksperta i eksport starej analizy.
3. Sprawdź pustą odpowiedź, niedostępność sieci i wadliwy wiersz. Zweryfikuj częściowy raport, działający poprzedni plik po błędzie oraz brak publikacji pierwszej bazy bez pobranych materiałów.

[Plan projektu, §5](../Risk_Miner_2_0_Plan_Projektu.md#5-model-danych-i-architektura) · [Instrukcja backendu](backend.md)
