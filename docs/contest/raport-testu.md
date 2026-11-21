# Projekt Kompas · raport odbioru

## Import i dopasowanie

Skrypt zbudował SQLite z 22 rekordów dostarczonych przez MFiPR. Odczyt z kopii BZP organizatora zwrócił 67 ogłoszeń. Raport zawierał 54 wyniki dopasowane, 13 propozycji do oceny i jeden projekt bez znalezionego ogłoszenia. Ponowny import w przeglądarce pozostawił 22 projekty historyczne. Raport liczy odnalezione ogłoszenia, a pomiary trafności powiązań wymagają referencyjnej listy organizatora.

| Klasa | Przykład zweryfikowany w próbie | Wynik |
| --- | --- | --- |
| Zgodne | RM-2026-009, BZP 2025/BZP 00307948/01 | Ten sam tytuł i identyfikator postępowania. Zapisano cztery ogłoszenia, dwie części i dwie odrębne umowy z terminami wykonania. |
| Niepewne | RM-2026-002, BZP 2026/BZP 00089794/01 | Zgodny tytuł i zamawiający. Brak wspólnego identyfikatora KPO w odnalezionym ogłoszeniu. W Chromium zapisano i odczytano decyzję o uzupełnieniu dowodów. |
| Błędny kandydat | RM-2026-005, BZP 2023/BZP 00195511/01 | Zamawiający był zgodny, lecz ogłoszenie dotyczyło sieci do budynków w Siemoniu. Projekt MFiPR dotyczył kanalizacji w Złejwsi Wielkiej i Małej oraz modernizacji stacji w Pędzewie. Kandydat pozostał do oceny. |

Bezpośrednie zapytanie do BZP z zakresem dat zwróciło 2022/BZP 00058537/01. Oddzielna próba z historycznym arkuszem XLS pobrała, dopasowała i zapisała ogłoszenie TED 675794-2023 z Warszawy, wraz z dowodami. Ta próba nie zwiększa liczebności zbioru MFiPR. [Oficjalne API BZP](https://ezamowienia.gov.pl/pl/integracja/) · [Ogłoszenie TED 675794-2023](https://ted.europa.eu/pl/notice/-/detail/675794-2023)

## Nowa inwestycja

W Chromium wprowadzono opis rozbudowy sieci wodociągowej, dodano koncepcję w DOCX i uruchomiono analizę. Na liście znalazły się 22 zakończone przypadki, a na pierwszym miejscu RM-2026-011. System pokazał dziewięć pozycji checklisty, 14% pokrycia informacji po zaokrągleniu, jedną flagę ryzyka i dziewięć rekomendacji. Dla kosztu brakowało porównywalnych obserwacji. Dwie obserwacje terminu okazały się niewystarczające do przedziału.

Sprawdzono wyświetlenie źródła w karcie eksperta, historię decyzji, zatwierdzenie dodatkowej kategorii i pobranie obydwu formatów. W testach API z trzema porównywalnymi terminami uzyskano przedział 2–16 dni, a z dwiema obserwacjami komunikat o niewystarczającej próbie. [Przykładowy JSON](przyklad-analizy.json) · [Przykładowy CSV](przyklad-analizy.csv)

## Zakres weryfikacji

- Testy backendu na tymczasowych bazach obejmują umowę z API, walidację i ponowienia importu, ponowne uruchomienie z trwałą bazą, odczyt dowodów, izolację dostępu, ekstrakcję i wersje dokumentów, korektę materiału wzorcowego, użycie zatwierdzonej klauzuli, konflikty rewizji i stałość zapisanych migawek. Oddzielnie sprawdzono odczyt tekstu z pliku DOC przez antiword.
- Produkcyjna kompilacja Angulara przeszła sprawdzenie typów i szablonów. Przebieg w Chromium używał rzeczywistego API, bazy SQLite, kopii BZP i publicznego TED.
- Prezentację i nagranie przygotowano jako lokalne pliki w repozytorium. [Prezentacja](prezentacja.pdf) · [Nagranie](demo.mp4)
