# Weryfikacja WodoStrażnika

## Dane i czasy

Pomiar wykonano 21.11.2026 z lokalnego klienta HTTP na uruchomionym FastAPI. Świeży cache przed serią. Każdy pomiar zaczął się od wstępnego wyszukania działki, tak jak w przeglądarce. Drugi przebieg dotyczył tego samego wejścia i ponownie obliczył raport z cache źródeł. Czas nie obejmuje czekania na kafelki ani pobierania gotowego PDF.

| Region | Działka | Analiza | Zimny cache | Ciepły cache | Lata porównania 30 dni |
|---|---|---|---:|---:|---:|
| wielkopolskie | 301103_2.0009.549/7 | 2024-07-05 | 10.579 s | 0.126 s | 10 |
| lubelskie | 062010_2.0008.14 | 2023-07-20 | 5.119 s | 0.091 s | 10 |
| warminsko-mazurskie | 280104_5.0006.98/2 | 2026-11-21 | 6.782 s | 0.128 s | 10 |

NASA POWER, IMGW, SoilGrids, Sentinel-2, EU-DEM, WorldCover i hydrologia zostały sprawdzone na rzeczywistych danych. W dniu bieżącym pełne dane opadu i ET₀ były dostępne do 19.11.2026. Brakujące w ostatnich tygodniach wartości promieniowania zastąpił limitowany etap Hargreavesa. IMGW podał bieżący odczyt wodowskazu. Szczegółowe źródła, czasy i odczyty są w [live-verification.json](../submission/live-verification.json) oraz [manifeście](../data/manifest.json).

## Testy

- Pytest: 11 zaliczonych. Zakres obejmuje pole powierzchni i osie, WKT/WKB, FAO-56, spójność bilansu, pokrycie przeszłości, maskę chmur, reguły, małą działkę, brak usług, sprawdzanie hydraulicznego progu i kontrolę źródeł. TestClient zgłasza ostrzeżenie o planowanej migracji transportu.
- Playwright: Chromium, Firefox i WebKit, rzeczywisty serwer, wyszukanie pełnym ID, geometria, historyczna i bieżąca data, historia, rozwinięcie rekomendacji, pobranie prawdziwego PDF, walidacja i szerokość 390 px. WebKit uruchomiono po rozpakowaniu brakujących bibliotek systemowych w katalogu tymczasowym. Safari jako osobna aplikacja, Windows oraz markowe kompilacje Edge i Opera pozostają bez bezpośredniej weryfikacji.
- Kontrola kodu: Ruff i kompilacja Angular zakończyły się pomyślnie. npm audit --omit=dev zgłosił 0 podatności runtime. Pełny audyt instalacji deweloperskiej zgłosił 16 pozycji o średnim priorytecie.
- FAO-56, przykład 18: ET₀ dla Uccle 3,9 mm/d i tolerancja 0,15 mm/d. Przykład z Lyonu dla Hargreavesa: 5,0 mm/d i tolerancja 0,12. Przykład 36: TAW 36 mm i RAW 10,8 mm. Tolerancje odnoszą się do odtwarzania obliczeń, a dokładność w polu zależy od wejść.
- Obraz Docker działa z natywną zależnością Expat niezbędną dla dostarczonego koła Rasterio. Frontend i backend uruchamiają się w jednym kontenerze. Polecenia podano w README.

Oddzielne próby zakończyły się prawidłowym raportem dla daty granicznej 21.11.2016 (10 lat porównań, brak użytecznej sceny), odmową zaleceń dla działki leśnej 301103_2.0001.7022 oraz importem GeoJSON dającym tę samą powierzchnię 5,89373 ha.

Jury oceni zgodność z własnymi danymi referencyjnymi. Przypadki z tej weryfikacji nie zastępują kontroli naukowej dla kraju i różnych upraw.

## Kontrola jakości nowego układu (21.11.2026, przeglądarka i prawdziwe dane)

Zakres: powłoka z paskiem bocznym (desktop) i dolną nawigacją (telefon), `features/analysis/analysis-page.ts` z przełącznikami Mapa/Dane/Raport, raport Prosty/Zaawansowany. Przeglądarka: Chromium (headless, Playwright). Viewporty: 390×800 i 1440×900. Frontend: `ng serve` na 4302 z proxy na backend FastAPI z prawdziwym indeksem działek i źródłami danych (port 8080, bo tylko ta instancja miała gotowy indeks 38,9 mln działek; własnego backendu na 8102 nie uruchamiano). Dane: 301103_2.0009.549/7 (ziemniak, 2024-07-05) i 280104_5.0006.98/2 (pszenica ozima, data bieżąca). Zrzuty: `docs/screenshots/verification/`.

Test dymny: `cd frontend && WODO_URL=http://127.0.0.1:4302 WODO_SHOTS=../docs/screenshots/verification node e2e/smoke.mjs` (opcjonalnie `WODO_VIEWPORTS=mobile` lub `desktop`). Przechodzi w obu viewportach (`chromium mobile OK`, `chromium desktop OK`). Obejmuje: nawigację powłoki z `aria-current`, wyszukanie po numerze, zmianę wybranej działki kliknięciem w mapę, „Dalej” → Dane (telefon), analizę, raport, wykresy i tabele danych, Prosty/Zaawansowany, rekomendacje z dowodami, PDF (nagłówek `%PDF`), kopiowanie linku do schowka, ponowne otwarcie linku raportu, link do paszportu, motyw, rysowanie granicy (desktop), analizę dla daty bieżącej, błąd walidacji, brak poziomego przewijania oraz brak błędów JS i odpowiedzi HTTP ≥ 400 (poza oczekiwaną dla `!!!`).

Zakończyło się powodzeniem w teście: Dalej otwiera Dane, po analizie przełącza na Raport, adres `/dzialka/:id/analiza/:analysisId` otwarty w nowej karcie odtwarza raport, PDF pobiera się, link jest kopiowany, brak przewijania poziomego strony w 390 px.

### Znalezione błędy

| ID | Waga | Opis | Komponent |
|---|---|---|---|
| QA-1 | średnia | Po zakończonej analizie formularz wraca do wartości domyślnych (uprawa „Pszenica ozima”, data dzisiejsza), choć raport dotyczy innej uprawy i daty. To samo po otwarciu linku do raportu. Użytkownik widzi obok raportu parametry, które go nie opisują, a ponowne „Analizuj” uruchomi inną analizę niż oglądana. | `features/analysis/analysis-form.ts`, `analysis-page.ts`, `app.routes.ts` |
| QA-2 | niska | Brak informacji zwrotnej po kliknięciu w mapę na dużym oddaleniu (widok całej Polski): nic się nie dzieje, bez komunikatu czy podpowiedzi o przybliżeniu. | `shared/map/wodo-map` |
| QA-3 | niska | Na telefonie karta wybranej działki z przyciskiem „Dalej” zasłania stopkę mapy (atrybucja © OpenStreetMap/GUGiK i skala). | `analysis-page.ts` (karta `lg:hidden`), `shared/map` |
| QA-4 | niska | W widoku Zaawansowany kolumna „Pobrano” pokazuje surowy znacznik czasu ISO (`2026-11-21T22:16:02+00:00`), który się łamie w wąskich kolumnach. Na telefonie tabela źródeł jest ucięta i wymaga przewijania w poziomie w obrębie karty. | `features/analysis/dashboard/report-dashboard.ts` |
| QA-5 | niska | Link „Paszport” z raportu otwiera `/dzialka/:id/paszport` z wypełnionym identyfikatorem, ale paszport nie jest tworzony, dopóki użytkownik nie kliknie „Szukaj”. Strona ma inny język wizualny niż reszta (stary CSS). | `features/passport/passport-page.*` |
| QA-6 | niska | Komunikat błędu (czerwony na ciemnym tle) w motywie ciemnym ma niski kontrast. Widać na zrzucie `mobile-12-blad.png`. Kontrast nie został zmierzony, ocena wizualna. | `p-message` (motyw PrimeNG) |
| QA-7 | informacja | Źródło „Stacja meteorologiczna IMGW” zgłosiło „Brak połączenia ze źródłem” w analizie 2024-07-05 przy użytej instancji backendu. Nie ustalono, czy to chwilowy brak sieci, czy ograniczenie źródła dla tej daty. | backend, `connectors` |

Kroki odtworzenia:

- **QA-1.** Otwórz aplikację, wyszukaj 301103_2.0009.549/7 (telefon: „Dalej”, widok Dane), wybierz „Ziemniak”, datę 2024-07-05, „Analizuj gospodarowanie wodą”. Po raporcie (desktop: panel po lewej, telefon: przełącz na Dane) formularz pokazuje „Pszenica ozima” i dzisiejszą datę. Zrzut: `desktop-05-raport.png`. Prawdopodobna przyczyna (z odczytu kodu, niezweryfikowana): zmiana adresu z `/dzialka/:id` na `/dzialka/:id/analiza/:analysisId` to inna trasa z tym samym komponentem, więc `AnalysisPage` i formularz powstają od nowa. Stan formularza nie jest w `AnalysisStore`.
- **QA-2.** Otwórz `/` w 1440×900, kliknij środek mapy bez przybliżania. Brak zmiany i komunikatu, przycisk analizy pozostaje nieaktywny z podpowiedzią „Najpierw wybierz działkę”. Po wyszukaniu i przybliżeniu klik w mapę działa (znaleziono 301103_2.0009.541/7 na desktopie i 301103_2.0009.539/7 na telefonie; zrzuty `*-03b-klik-mapa-inna-dzialka.png`).
- **QA-3.** 390×800, wyszukaj 301103_2.0009.549/7, widok Mapa. Zrzut: `mobile-03-klik-mapa.png`.
- **QA-4.** Zakończ analizę, przełącz na „Zaawansowany”, przewiń do „Skąd pochodzą dane?”. Zrzuty: `desktop-06-zaawansowany.png`, `mobile-06-zaawansowany.png`.
- **QA-5.** Raport → „Paszport”. Zrzut: `mobile-10-paszport.png`.
- **QA-6.** Włącz motyw ciemny, w polu wyszukiwania wpisz `!!!` i zatwierdź. Zrzut: `mobile-12-blad.png`.
- **QA-7.** Raport 301103_2.0009.549/7 na 2024-07-05, widok Zaawansowany, panel „Braki i ograniczenia”. Zrzut: `desktop-06-zaawansowany.png`.

Wprowadzenie `!!!` w wyszukiwarce zwraca z API 422, co przeglądarka loguje w konsoli. Komunikat dla użytkownika jest czytelny, dlatego nie liczymy tego jako błąd.

### Czego nie sprawdzono

Firefox i WebKit (brak zainstalowanych przeglądarek w tym środowisku, test dymny je obsługuje przez `WODO_BROWSER`), urządzenia fizyczne, czytniki ekranu, pomiar kontrastu, nawigacja klawiaturą poza zdarzeniami użytymi w teście, wydruk, własny backend na porcie 8102. Chromium wymagał bibliotek systemowych (libnspr4, libnss3, libasound2) rozpakowanych do katalogu tymczasowego i podanych przez `LD_LIBRARY_PATH`.
