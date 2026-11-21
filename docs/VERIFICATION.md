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
