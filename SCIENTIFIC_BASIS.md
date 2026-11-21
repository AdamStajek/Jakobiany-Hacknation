# Analiza datowanego paszportu pola

Stan przeglądu i walidacji: 21 listopada 2026. Przeczytano opis techniczny zadania konkursowego KOWR i lokalny załącznik naukowy. Analiza odpowiada na pytanie, które wnioski można wyciągnąć z konkretnego eksportu. Historia modelowa dotyczy wskazanej uprawy przy niezmiennym sposobie gospodarowania.

## Przegląd i dobór metod

Wyszukiwanie internetowe obejmowało połączenia haseł „FAO 56 revised”, „root zone depletion”, „validation satellite evapotranspiration Europe”, „cover crop water storage meta analysis termination” i „European agricultural drought”. Sprawdzono dokumentację FAO, publikacje wydawców i rekordy pełnotekstowe. Przegląd jest ukierunkowany; nie wykonano systematycznego screeningu wszystkich pięciu wskazanych indeksów ani niezależnej replikacji prac.

| Źródło i rodzaj dowodu | Wejście i walidacja | Znaczenie dla polskiej działki |
|---|---|---|
| Allen, Pereira, Raes i Smith (1998), *Crop evapotranspiration – Guidelines for computing crop water requirements*, wytyczne referencyjne FAO, [rozdział 8](https://www.fao.org/4/x0490e/x0490e0e.htm) | Profil retencji, głębokość korzeni, pogoda, faza i nawodnienie. Przykłady obliczeniowe. | Wspólna definicja TAW, RAW i Ks. Parametry gatunkowe wymagają lokalnej weryfikacji. |
| *Crop evapotranspiration*, wydanie drugie (2025), [FAO-56 Rev. 1](https://agrhysmo.agr.unipi.it/wp-content/uploads/2025/09/FAO56%202025.pdf) oraz *Innovations in the Revised FAO56 Guidelines for Computing Crop Water Requirements: Data, Calculation Methods, Irrigation, and Climate Change Challenges* (2026), [Water](https://www.mdpi.com/2073-4441/18/7/793) | Oddzielny współczynnik transpiracji i parowania ułatwia interpretację po zwilżeniu powierzchni. | Wersja jednoelementowa pozostaje przybliżeniem. Paszport nie dostarcza ciągłego dziennika zwilżenia i pokrycia gleby. |
| Kröcher i wsp. (2026), *Monitoring changes in the landscape water balance: validation of satellite- and model-based evapotranspiration data in Lusatia, Germany*, artykuł recenzowany, [DOI](https://doi.org/10.1007/s10661-026-15120-8) | MOD16, Landsat i CERv2 względem lizymetrów i kowariancji wirów. Nawet na stanowiskach trawiastych RMSD 0,58–1,02 mm/d. | Łużyce są istotnym porównaniem regionalnym. Błędy zależą od pokrycia. Nie używamy ich jako przedziałów błędu polskiej działki. |
| *High resolution (1 km-daily) potential evapotranspiration dataset over Europe and the Mediterranean region* (2025), Journal of Hydrology, [DOI](https://doi.org/10.1016/j.jhydrol.2025.133839) | Porównanie metod PET z 38 stacjami FLUXNET i innymi produktami. | PET zależy od definicji powierzchni. Unikamy mieszania z rzeczywistą ET. Dostęp do omówienia wyników, bez reprodukcji parametrów. |
| *A meta-analysis on cover crop impact on soil water storage, succeeding crop yield, and water-use efficiency* (2021), [Agricultural Water Management](https://www.sciencedirect.com/science/article/pii/S0378377421003504) | 117 badań, porównania zapasu przed siewem, wydajności wykorzystania wody i plonu. Znak efektu zależy m.in. od głębokości profilu. | Brak podstaw do uniwersalnej dawki dodatkowej retencji po międzyplonie. |
| *Cover crop functional groups and performance moderate improvements in soil hydrology*, [artykuł wydawcy](https://www.sciencedirect.com/science/article/pii/S0167880926003816) | Synteza 146 badań w 34 krajach. Efekty zależą od biomasy, intensywności uprawy i czasu stosowania. | Brakuje odpowiednika lokalnej próby kontrolnej i historii praktyk. Nie przenosimy średniej na analizowane pole. |

HYDRUS wymaga krzywych przewodności i warunków brzegowych; SWAT wymaga parametrów zlewni. AquaCrop i APSIM potrzebują kalibracji fenologii oraz danych o gospodarowaniu. Predykcja plonu wymaga dodatkowo odmiany, nawożenia i obserwacji referencyjnych. Asymilacja wymaga operatora obserwacji, błędów i ich współzależności. Część pogody i wilgotności pochodzi ze wspólnej reanalizy. Traktowanie ich jako niezależnych pomiarów zaniżyłoby niepewność. Dziesięć sezonów pozwala opisać zdarzenia w próbie; nie dopasowujemy SPI/SPEI ani trendu klimatycznego. Wskaźnik IUNG wymaga zgodnych definicji uprawy, gleby, ewapotranspiracji i okresu raportowania.

## Przepływ danych i równania

Kontrakt wejścia pochodzi z funkcji fields_for w backend/wodo/passport.py. Katalog docs/paszport_pola_katalog_danych.csv opisuje źródła, jednostki i metody pozyskania pól. P0 opisuje priorytet, nie obecność pomiaru. O użyciu decydują status, typ wartości, jednostka i data dostępności. Dla starszych eksportów bez daty publikacji zachowawczo przyjmujemy datę pobrania lub złożenia paszportu jako najpóźniejszy potwierdzony dzień dostępności. Przy wcześniejszej dacie rozpatrywane są tylko datowane serie. Brak archiwalnej wersji produktu ogranicza rekonstrukcję decyzji.

| Dane → metoda | Jednostki i obliczenie | Wynik i interpretacja |
|---|---|---|
| Opad i referencyjna ET → różnica strumieni | B = Σ(P−ET0), wszystkie dni okna muszą wystąpić; 30 dni i pełne miesiące kalendarzowe. mm | water_balance, historical_analysis. Ujemna wartość sygnalizuje przewagę popytu atmosferycznego. |
| ERA5-Land → całka po grubości warstwy | W = Σ 10 Δz θ, Δz w cm, θ w m³/m³. Suma do metra tylko dla trzech kompletnych warstw. | modelled_soil_profile. Woda całkowita modelowanej komórki; obejmuje również wodę niedostępną dla korzeni. |
| SoilGrids i uprawa → FAO | TAW = 1000 Σ(θ33−θ1500) Δz, Δz w m w obrębie korzeni. RAW = p TAW. | Pojemność i próg poboru. Głębokości efektywne i p w tabeli CROPS w science.py, na podstawie tabel FAO 12 i 22. Daty faz są przybliżeniami inżynieryjnymi. |
| Dzienny zbiornik → bilans korzeni | S* = min(TAW,S+P+I), Q = max(0,S+P+I−TAW), Ks = min(1,S*/(TAW−RAW)), ETc = Kc ET0, ETa = min(S*,Ks ETc), S' = S*−ETa, Dr = TAW−S'. Wszystkie strumienie w mm/krok dobowy. | science.bucket, passport.water_balance, field_analysis.analyze_field. Q oznacza przepełnienie; brak pomiaru odpływu i rozdziału transportu. Ks wyliczany z końcowego S opisuje warunki poboru przy tym zapasie. |
| Nieznany zapas początkowy → dwa przebiegi | S początkowe 0 lub TAW. Dostępny zapas końcowy od TAW−Dr_max do TAW−Dr_min. Hipotetyczny impuls netto 1 mm zwiększa zapas o min(1,Dr) mm. | soil_water_availability i scenario_analysis. Jest to czułość na inicjalizację i jednostkowy dopływ. Brak rozkładu prawdopodobieństwa parametrów. |
| Dziesięć kompletnych sezonów → symulacja porównawcza | Pełny profil na starcie, I=0, ta sama uprawa, opad i ET0 z każdego roku. Niedobór sezonowy Σ(ETc−ETa) w mm; częstość 100 n/N dla niedoboru dodatniego po zaokrągleniu do 0,1 mm. Epizod jest nieprzerwanym ciągiem dni z dodatnim modelowanym niedoborem. | historical_analysis. Daty, długości i dotkliwość pochodzą z modelu, rzeczywisty płodozmian i nawodnienie pozostają nieznane. |
| NMT → pojemność zagłębienia | Dla objętości V w m³ i powierzchni A w ha równoważna głębokość h=V/(10A) mm. Próg identyfikacji 0,25 m pochodzi z istniejącego procesu NMT. | retention_potential. Konieczna weryfikacja odpływu, napełnienia, drenów, sąsiednich pól i warunków formalnych. |
| Sentinel-2 → różnica od tła | Średnia sceny minus średnia z rocznych średnich tej samej uprawy i fazy. Filtry pokrycia i liczby sezonów w docs/PASSPORT_P0.md. | satellite_context. Oba wskaźniki bezwymiarowe, niespecyficzne dla niedoboru wody. |

## Integracja i walidacja

POST /api/analysis/passport?as_of=RRRR-MM-DD przyjmuje JSON uzyskany z API paszportu. Alternatywnie zaimportuj wodo.field_analysis.analyze_field i przekaż słownik oraz datetime.date. Samo obliczenie działa offline. Rejestr metod jest serializowany w methods, ścieżki do rekordów wejściowych w calculation_trace. Schemat sekcji raportu znajduje się w docs/field-analysis.schema.json. Odpowiedź paszportu i raport są osobnymi dokumentami. Istniejący generator PDF ma własny kontrakt.

Próby jednostkowe obejmują publikowany przykład FAO, bilans masy zbiornika, brak próbek, rok przestępny, zachmurzenie, zagłębienia i przepływ po NMT, zakres niepewności stanu korzeni oraz datę historyczną. W syntetycznej próbie TAW=100 mm, RAW=40 mm, Dr=30–70 mm daje Ks od 0,5 do 1. Opad 2 i ET0 4 mm/d przez 30 dni dają −60 mm. Ten sam bilans atmosferyczny dopuszcza różne stany poboru. To sprawdzenie własności modelu; przewaga predykcyjna nad bilansem P−ET0 pozostaje niezmierzona.

Przykład archiwalny docs/field-analysis-example.json pochodzi z przebiegu rzeczywistego dla 5 lipca 2024, obejmującego 213 rekordów i tylko dwa poprawne pola metadanych. Drugi przykład i jego wejście dotyczą działki w Kościanie. Miarodajnym testem zewnętrznym byłyby wielogłębokościowe pomiary wilgotności i dziennik nawodnień z tej samej działki. Kolejne potrzebne dane to pomiary retencji w rdzeniach, daty rozwoju uprawy, sieć drenarska oraz opad na polu. Bez nich brak podstaw do obliczenia RMSE polowej wilgotności, błędu dawki, efektu plonotwórczego czy ekonomicznego. Nie wykonano terenowej walidacji.

### Kontrola przenoszalności metod

W pracy *Addressing soil data needs and data gaps in catchment-scale environmental modelling: the European perspective* porównano funkcje pedotransferowe z pomiarami EU-HYDI. Uziarnienie, gęstość i węgiel organiczny umożliwiają estymację części parametrów, ale ich dostępność i zgodność metod pomiarowych decydują o przydatności funkcji. W analizowanym paszporcie dostępny jest już profil retencji SoilGrids. Ponowne przeliczenie go z tych samych predyktorów prowadziłoby do współzależnych estymat. [SOIL, 2024](https://soil.copernicus.org/articles/10/587/2024/soil-10-587-2024.html)

Badanie CLM5-PDAF dla 13 europejskich stanowisk leśnych wykazało spadek błędu wilgotności po asymilacji pomiarów oraz wzrost błędu ET. Różnica ekosystemu i brak sond polowych ograniczają przenoszalność na analizowane uprawy. Regionalna walidacja SoilGrids obejmuje krzyżową walidację przestrzenną właściwości gleby. Rozrzut wyniku na konkretnej działce wymaga osobnego badania. [HESS, 2024](https://hess.copernicus.org/articles/28/1001/2024/hess-28-1001-2024.pdf), [SoilGrids 2.0](https://soil.copernicus.org/articles/7/217/2021/index.html)

### Wynik uruchomienia

Pełny zestaw backendu: 27 testów zaliczonych, w tym odtworzenie JSON Kościana przez HTTP. Dwa ostrzeżenia dotyczą bibliotek Starlette i operacji macierzowej w istniejącym module NMT. Średnia z 1000 wywołań funkcji na gotowym paszporcie Kościana wyniosła 0,69 ms, a na niepełnym archiwalnym 0,27 ms. Pomiar obejmuje obliczenia w pamięci. Pobranie źródeł, transmisja i renderowanie PDF wymagają osobnego pomiaru czasu całego raportu.

Dla ziemniaka w Kościanie oszacowana pojemność dostępna wyniosła około 115 mm, a próg łatwo dostępnej wody około 40 mm. W dziesięciu symulowanych sezonach 2016–2025 wystąpiło 19 ciągłych epizodów dodatniego niezaspokojonego zapotrzebowania. Każdy sezon miał taki epizod. Kryterium wykrywa również niewielkie ograniczenie ET. Tego wyniku nie należy przeliczać na ryzyko straty plonu ani częstość oficjalnie stwierdzonej suszy rolniczej.

### Raport dla gospodarstwa

Pole `farmer_report` zawiera krótką ocenę sytuacji oraz działania z terminem i uzasadnieniem. Widok paszportu wyświetla je przed tabelą danych. Do wydruku służy również `POST /api/analysis/passport?as_of=RRRR-MM-DD&format=pdf`. Przykład dla ziemniaka jest dostępny w [jednostronicowym raporcie dla Kościana](docs/raport-pola-koscian.pdf).

Termin kontroli wyznacza miesiąc pierwszego modelowanego niedoboru w każdym sezonie, w którym taki epizod wystąpił. Każdy sezon wnosi jeden głos. Przy remisie raport wymienia wszystkie najczęstsze miesiące. Próba porównania pasa z resztkami i sąsiedniego pasa uprawianego jak zwykle jest propozycją do sprawdzenia w gospodarstwie; model nie przypisuje jej stałej oszczędności wody.
