# Pole Widzenia

**Jakobiany · HackNation 2026 · KOWR · Zatrzymaj wodę, chroń plony**

Pole Widzenia pomaga gospodarstwom zdecydować, kiedy sprawdzić zapas wody w glebie, jak ograniczyć straty wilgoci i od czego zacząć planowanie retencji. Wybierz działkę ewidencyjną, uprawę i datę. System pobierze źródła, przeliczy dane dla wskazanego pola i pokaże, z czego wynika każde zalecenie.

[Repozytorium kodu zespołu Jakobiany](https://github.com/AdamStajek/Jakobiany-Hacknation). Dostęp dla jury zespół nadaje zgodnie z instrukcją w HackTribe. Prezentację PDF (do 10 slajdów), film demonstracyjny (do 3 minut) i raporty z prototypu zespół przekazuje osobno.

## Uruchomienie

Operator potrzebuje Docker Compose i dostępu HTTPS do publicznych źródeł. Rolnik otwiera aplikację w zwykłej przeglądarce.

```bash
./start.sh
curl http://127.0.0.1:8080/health
```

Otwórz [aplikację lokalną](http://127.0.0.1:8080) lub [API OpenAPI](http://127.0.0.1:8080/docs). Przykład pokazu to działka 301103_2.0009.549/7, ziemniak i 5 lipca 2024. Typ uprawy historycznej wymaga potwierdzenia przez użytkownika.

`./start.sh` pobiera obraz Node z publicznego cache Google. Jeśli obrazu brakuje w cache, możesz wskazać Docker Hub w zmiennej `WODO_NODE_IMAGE`.

```bash
WODO_NODE_IMAGE=node:24-slim ./start.sh
```

Bez Dockera użyj Node.js 24, uv, Python 3.13 i fontów DejaVu. Na Ubuntu lub Debianie doinstaluj fonts-dejavu-core.

```bash
(cd backend && uv run --locked python -m wodo.parcels_data refresh)
npm --prefix frontend ci
./scripts/run.sh
```

Do wdrożenia zewnętrznego uruchom obraz za reverse proxy HTTPS i użyj wolumenu dla /var/lib/wodo. Obraz nasłuchuje na 8000, a Compose udostępnia go lokalnie na 8080. Hosting zewnętrzny wymaga konta i konfiguracji dostępu dla jury.

Aby korzystać z prognozy w analizie dzisiejszej daty, ustaw `WODO_NONCOMMERCIAL_OPEN_METEO=1` w środowisku backendu lub w pliku `.env` dla Docker Compose. Bez tej zmiennej raport pokazuje brak prognozy i stosuje reguły oparte na dostępnych danych. [Warunki bezpłatnego użycia Open-Meteo](https://open-meteo.com/en/terms).

## Dane działek

Geometrię działek wyszukuje własny indeks zbudowany z krajowego pliku GeoParquet GUGiK / EGiB (4,59 GB, 38,9 mln działek). Usługa `parcels-updater` pobiera plik i buduje indeks w tle po `docker compose up --build`. API startuje od razu, a `/api/parcels/*` zwraca 503, dopóki dane nie są gotowe. Pierwsze pobranie i budowa trwają ok. 35–40 min, potrzeba co najmniej 40 GB wolnego miejsca na wolumenie i 6 GB RAM dla Dockera (w WSL2 trzymaj repozytorium w systemie plików Linuksa). Postęp: `docker compose logs -f parcels-updater` oraz blok `parcels` w `curl localhost:8080/api/health`.

ULDK pozostaje tylko opcją (`WODO_PARCEL_SOURCE=uldk`), bo w sieci hackathonu usługa przekierowuje zapytania na adres pułapki. Znany problem: nakładka WMS z granicami działek na mapie jest przekierowywana tak samo i nie działa.

## Interfejs

Aplikacja jest projektowana najpierw na telefon (od 390 px), a na komputerze rozszerza się o stały pasek boczny. Nawigacja obejmuje Start, Analizuj pole, Moje pola i Jak to działa. Eksperymenty znajdziesz w sekcji Jak to działa. Na telefonie nawigacja jest na dole ekranu, na komputerze po lewej.

W sekcji Analiza działki pracujesz w trzech widokach: **Mapa** (wyszukiwanie i wskazanie działki, szkic własnej granicy), **Dane** (uprawa, data i parametry) oraz **Raport** (wyniki, wykresy, zalecenia, PDF i druk). Na telefonie przełączasz je u góry ekranu, a widok Raport staje się dostępny po uruchomieniu analizy. Na komputerze panel Dane jest zawsze obok, a po prawej wybierasz Mapę albo Raport. Jest motyw jasny, ciemny i systemowy.

## Funkcje

- Wyszukiwanie pełnym identyfikatorem, z mapy lub przez nazwę i numer obrębu. Można też narysować własną granicę na mapie.
- Sześć upraw, ruchomy przedział dziesięciu lat, opcjonalna faza, początek wegetacji, lokalna obserwacja i znane nawadnianie.
- Bilans pogodowy, porównania sezonowe, model strefy korzeni, indeksy Sentinel-2, pokrycie terenu, wody powierzchniowe, stacje IMGW i spadek terenu.
- Sugestie z katalogu działań KOWR rozszerzonego o wykopanie rowu melioracyjnego dla całego pola lub punktów z mapy, z uzasadnieniem, terminem i kosztem. Warunki i publikacje są w zakładce „Jak to działa?”.
- Scenariusz dodatkowej wody, raport PDF z granicą działki, eksperymentami i zaleceniami oraz druk.

## Architektura i dane

Angular, PrimeNG i ECharts renderują formularz, wykresy i raport, a MapLibre GL mapę z darmowymi podkładami (OpenStreetMap, ortofotomapa GUGiK; nakładka granic działek GUGiK jest chwilowo niedostępna). FastAPI udostępnia API i serwuje zbudowaną aplikację z tej samej domeny. Klienci źródeł działają równolegle. Moduł science.py liczy ET₀ FAO-56, ETc, scenariusze stanu początkowego i porównania historyczne. Moduł recommendations.py dopasowuje reguły katalogu KOWR do danych pola, prognozy i obserwacji rolnika, a ReportLab generuje dokument z obiektu raportu.

| API | Działanie |
|---|---|
| GET /health, /api/crops | Zasięg dat i słownik upraw |
| GET /api/parcels/{id}, /api/parcels/search, /api/parcels/by-point, POST /api/parcels/import | Wyszukiwanie i walidacja geometrii |
| POST /api/analysis | Pobranie danych i obliczenie oceny |
| GET /api/analysis/{id} | Odczyt raportu |
| GET /api/analysis/{id}/provenance, /api/analysis/{id}/report | Metadane oraz eksport PDF |
| GET /api/recommendations/catalog | 61 działań, warunki, wpływ na areał uprawny i źródła |
| GET /api/data-sources/status | Dostępność źródeł w ostatniej analizie |

Geometria pochodzi z krajowego zbioru EGiB GUGiK (GeoParquet, lokalny indeks). NASA POWER i IMGW dostarczają meteorologię, Sentinel-2 obserwacje powierzchni, SoilGrids charakterystyki retencji, ESA WorldCover informację o pokryciu i wodach, a Copernicus modele powierzchni. IMGW hydro uzupełnia bieżący raport o najbliższy przydatny wodowskaz. Źródła są pobierane na żądanie według ważności cache. SQLite przechowuje metadane, serie i pochodne z sumą SHA-256. Identyfikator raportu jest losowy i wygasa najpóźniej po 14 dniach. Raporty i zalecenia są obliczane po każdym uruchomieniu analizy. Pełne zbiory dostawców pozostają poza repozytorium.

### Lokalna kopia granic działek

Jeśli ULDK zwróci błąd lub pusty wynik, aplikacja sprawdza lokalny GeoPackage dla pełnych identyfikatorów EGiB zaczynających się od `2607` i dla kliknięć na mapie w zasięgu kopii. Szuka pliku `.wodo-cache/egib/ostrowiecki-2607.gpkg`. Docker Compose montuje katalog `.wodo-cache/egib` tylko do odczytu. Przy uruchomieniu bez Compose ścieżkę można ustawić przez `WODO_EGIB_GPKG`.

### Paszport pola na żądanie

Wybierz działkę EGiB i datę w aplikacji, a następnie kliknij **Pokaż paszport pola**. Dane można rozwinąć na ekranie lub zapisać jako JSON. Aplikacja wysyła dane i obserwacje przez `POST /api/passport`. API obsługuje też `GET /api/passport?parcel_id=301103_2.0009.549%2F7&as_of=2024-07-05` z domyślną datą dzisiejszą. API pobiera dane równolegle i korzysta z istniejącej pamięci podręcznej SQLite.

Paszport zawiera wartości, metadane i statusy dla katalogu CSV. `unsupported` oznacza brak implementacji pola, `error` błąd źródła, a `missing` brak wartości dla działki lub daty. Konektory obejmują dane EGiB i administracyjne z ULDK, wysokość i nachylenie z NMT, profil gleby i retencję z SoilGrids, Sentinel‑2 oraz pogodę i wilgotność modelową z Open‑Meteo. Wybrana uprawa, data siewu, faza i dawka nawadniania z formularza trafiają do bilansu FAO‑56. Wartość ubytku odpowiada początkowo pełnemu zapasowi wody, a metadane zawierają zakres obu scenariuszy początkowych. Zmienna `WODO_NONCOMMERCIAL_OPEN_METEO=1` w środowisku backendu włącza bezpłatne API Open‑Meteo do użytku niekomercyjnego.

Kod, testy, dokumentację i materiały przygotowano z pomocą OpenAI Codex. W działającej aplikacji wnioskowanie jest deterministyczne. Użytkownik może odtworzyć powód zalecenia na podstawie danych i reguły.

## Testy i walidacja

```bash
(cd backend && uv run --locked python -m pytest -q tests/test_wodo.py)
python3 scripts/check_live.py
(cd frontend && npx playwright install chromium && npm run test:e2e)
```

Test ET₀ sprawdza dobowy przykład 18 FAO-56 (3,9 mm/d ±0,15), a test retencji przykład 36 (TAW 36 mm, RAW 10,8 mm). Testy sprawdzają też bilans masy, współrzędne, chmury, odmowy wejść i zakres dat. Weryfikacja rzeczywistych danych obejmuje trzy regiony. Do pomiaru na zimno ustaw nowy katalog przez WODO_CACHE_DIR.

## Bezpieczeństwo, koszty i skala

Aplikacja nie wymaga kont rolników. Backend ogranicza źródła sieciowe, rozmiar wejść, czasy odpowiedzi, tempo i liczbę jednoczesnych analiz. Komunikat dla użytkownika nie zawiera szczegółów wyjątku. Operator powinien trzymać cache poza webrootem i włączyć TLS przy publikacji. Dostawcy otrzymują identyfikatory lub położenia konieczne do pobrania danych.

Uruchomienie lokalne nie wymaga opłat za dane ani AI. Szacunek dla małego wdrożenia to jedna instancja 2 vCPU, 2–4 GB RAM i kilka GB trwałego wolumenu na cache oraz ok. 40 GB na dane działek. Przykładowa cena małej instancji 2 vCPU z 4 GB RAM to 5,49 EUR miesięcznie netto bez publicznego IPv4. Domena, kopie i większy ruch mogą zwiększyć koszt. [Cennik Hetzner](https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/). Przy większej skali potrzebne byłyby współdzielony cache, własne kafelki i DEM, monitoring limitów i uzgodnione budżety zapytań. Open-Meteo ma odrębne warunki dla dostępu komercyjnego.

## Źródła danych

| Kategoria | Integracja wykorzystana przez prototyp | Zakres i rozdzielczość |
|---|---|---|
| Działki | [GUGiK / EGiB, krajowy GeoParquet](https://opendata.geoportal.gov.pl/InneDane/latest_exports/eziudp_wfs/PARQUET/0_dzialki.parquet) z lokalnym indeksem DuckDB, wyszukanie przez identyfikator, nazwę i numer obrębu lub punkt. ULDK tylko jako opcja (`WODO_PARCEL_SOURCE=uldk`) | 38 909 091 działek, 380 powiatów, geometria WKB w EPSG:2180, aktualizacja plików GUGiK z 2026-11-19/20. Pobranie i ETag zapisane przy danych. |
| Meteorologia | [NASA POWER Daily AG](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) z opadem, temperaturą, punktem rosy, wiatrem i promieniowaniem. [IMGW-PIB](https://danepubliczne.imgw.pl/pl/apiinfo) jako punkt porównania | NASA: dziennie w UTC, meteorologia 0,5° × 0,625°, promieniowanie zwykle 1°. Przetwarzane są tylko obserwacje do daty analizy. IMGW: lokalizacja oraz odległość od najbliższej użytecznej stacji, wybrane pomiary bieżące lub archiwum dobowe. |
| Satelita | [Sentinel-2 L2A / Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/docs/) i alternatywny katalog [Earth Search](https://earth-search.aws.element84.com/v1), okna COG i maska SCL | 20 m w analizie. Stan sceny do 38 dni wstecz, porównania z maksymalnie trzema wcześniejszymi latami, datowane osobno. |
| Gleba | [ISRIC SoilGrids WCS](https://docs.isric.org/globaldata/soilgrids/SoilGrids_access.html) z parametrami wv0033 i wv1500 | Predykcja 250 m. Wycinki 0–5, 5–15, 15–30, 30–60 i 60–100 cm. Piksele wewnątrz działki lub piksel reprezentatywny. |
| Teren | [EU-DEM 25 m przez Open Topo Data](https://www.opentopodata.org/datasets/eudem/). Awaryjnie [Copernicus DEM GLO-30](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) | Próbkowane wysokości i nachylenie z różnic centralnych na siatce 25 m. GLO-30: rzeczywisty raster powierzchni, okno 30 m, cięcie do granicy. |
| Pokrycie i hydrologia | [ESA WorldCover 2021 v200](https://worldcover2021.esa.int/) oraz [IMGW / hydro](https://danepubliczne.imgw.pl/api/data/hydro/) w bieżącym dniu | ESA 10 m, przeliczenie do 20 m dla udziałów pokrycia i pikseli stałej wody w promieniu 2 km. Wodowskaz w promieniu do 50 km z nazwą cieku, odległością i czasem obserwacji. |


Indeks EGiB powstaje przed analizą. W pomiarze zespołu plik pobrano 21 listopada 2026 r. Usługa co 24 godziny sprawdza ETag dostawcy. Dane pogodowe, wycinki rastrów i odczyty stacji są pobierane na żądanie. Przy każdym raporcie można sprawdzić dostawcę, datę obserwacji i czas pobrania w metadanych.

## Dane, oprogramowanie i prawa

Własny kod i dokumentacja zespołu pozostają prywatne w okresie wskazanym przez KOWR. Nabycie praw do własnych elementów nie przenosi praw producentów danych, bibliotek ani usług. Testy wykonano bez kluczy do dostawców danych i bez ponownej publikacji pełnych zbiorów.

| Element | Warunki i atrybucja |
|---|---|
| GUGiK / EGiB (GeoParquet, opendata.geoportal.gov.pl) | Dane otwarte Głównego Urzędu Geodezji i Kartografii z portalu [opendata.geoportal.gov.pl](https://opendata.geoportal.gov.pl/). Atrybucja: „Źródło: GUGiK / EGiB (dane otwarte, opendata.geoportal.gov.pl)”. Dokładny tekst warunków wykorzystania należy potwierdzić na portalu, w dokumentacji nie podajemy nazwy ani numeru licencji bez takiego sprawdzenia. Aplikacja pokazuje źródło w wynikach, na mapie i w PDF. Pełny plik nie jest częścią repozytorium ani obrazu: leży w wolumenie Dockera i jest usuwany po zbudowaniu indeksu. |
| GUGiK ULDK | Tylko opcjonalne źródło (`WODO_PARCEL_SOURCE=uldk`). [Warunki ULDK](https://uldk.gugik.gov.pl/opis.html#_faq) wskazują bezpłatne użycie, także komercyjne, i obowiązek wskazania źródła. |
| NASA POWER | [NASA POWER, dokumentacja](https://power.larc.nasa.gov/docs/) i [NASA Earthdata policy](https://www.earthdata.nasa.gov/engage/open-data-services-and-software). Dane publiczne, atrybucja projektu POWER i wejść MERRA-2, GEOS, CERES. Wykazywać wersje i chwilę pobrania. |
| IMGW-PIB | [Regulamin i ponowne wykorzystanie](https://danepubliczne.imgw.pl/pl/datastore). Dane stacji i wodowskazów mają oznaczenie źródła oraz przetworzenia. Publikując inny produkt lub zmieniając przeznaczenie należy sprawdzić zasady dla konkretnego zbioru. |
| Sentinel-2 / Planetary Computer i Earth Search | [Copernicus Sentinel Data Legal Notice](https://ewds.climate.copernicus.eu/licences/ec-sentinel). Zmodyfikowane dane z oznaczeniem „Contains modified Copernicus Sentinel data” i rokiem sceny. Dostęp do publicznego archiwum zapewniają [Planetary Computer na jego warunkach usługi](https://planetarycomputer.microsoft.com/terms) oraz Earth Search na AWS. Przyszłe wdrożenie korzysta z własnych ścieżek dostępu do danych zgodnych z licencją Sentinel. |
| ISRIC SoilGrids 2.0 | [ISRIC](https://www.isric.org/explore/soilgrids), CC BY 4.0. Raport wskazuje źródło i przeliczenie warstw. |
| ESA WorldCover | [Instrukcja ESA WorldCover 2021](https://worldcover2021.esa.int/data/docs/WorldCover_PUM_V2.0.pdf), CC BY 4.0. Atrybucja ESA WorldCover 2021 oraz informacji Sentinel. |
| EU-DEM / Open Topo Data | [Dokumentacja zbioru](https://www.opentopodata.org/datasets/eudem/) i [warunki usługi](https://www.opentopodata.org/). Użycie z atrybucją Copernicus/EU-DEM. Publiczny endpoint ma limity 100 punktów, 1 zapytanie/s, 1000 zapytań/dzień. Przy większym wdrożeniu użyć własnego hostingu danych zgodnie z licencją. |
| Copernicus GLO-30 | [Warunki Copernicus DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM). Wymagana atrybucja DLR, Airbus, EU i ESA. |
| OpenStreetMap | [ODbL dla danych](https://www.openstreetmap.org/copyright) i oddzielna [polityka kafelków](https://operations.osmfoundation.org/policies/tiles/). Użycie interaktywne w przeglądarce, bez masowego pobierania. Do produkcji wybrać hosting map odpowiadający skali. |
| Open-Meteo / ERA5-Land | [Warunki API](https://open-meteo.com/en/terms) ograniczają bezpłatny endpoint do użytku niekomercyjnego. Adapter wyłączony w standardowym uruchomieniu. [Licencja produktu w CDS](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land?tab=overview) to odrębne warunki od dostępu przez Open-Meteo. |
| Metody | [FAO Irrigation and Drainage Paper 56](https://www.fao.org/4/X0490E/x0490e00.htm), własna implementacja wzorów i odwołanie do tabel 12, 19, 22. Tabele nie są kopiowane w całości. |
| Narzędzia AI | Codex od OpenAI wspierał przygotowanie kodu, testów, tekstu i grafiki z prawdziwych zrzutów. [Warunki OpenAI](https://openai.com/policies/terms-of-use/). W czasie wykonywania analiza nie wywołuje modelu językowego ani płatnego API AI. |

### Komponenty

Angular, RxJS, Playwright i TypeScript: MIT lub Apache-2.0 zgodnie z metadanymi konkretnej paczki. PrimeNG (wydanie Community, MIT), Tailwind CSS (MIT), ECharts (Apache-2.0), ngx-echarts (MIT), MapLibre GL JS (BSD-3-Clause) i Turf.js (MIT). Podkłady: OpenStreetMap (ODbL, atrybucja na mapie) oraz ortofotomapa GUGiK (usługa publiczna, atrybucja na mapie). Nakładka WMS z granicami działek GUGiK jest obecnie niedostępna (przekierowanie usługi). FastAPI, HTTPX, Uvicorn i Starlette: MIT lub BSD-3-Clause. NumPy, Shapely, Rasterio, PyProj i ReportLab: licencje BSD zgodnie z metadanymi danego pakietu. Dane i biblioteki dołączane przez koła Rasterio i PyProj obejmują GDAL, PROJ i ich zależności z deklaracjami w plikach licencji kół. Font DejaVu zachowuje licencję Bitstream Vera i warunki rozszerzeń projektu. SQLite jest w domenie publicznej. DuckDB (indeks działek): licencja MIT. Expat używa licencji MIT, pakiety systemowe obrazu Debiana mają własne deklaracje w katalogu /usr/share/doc. Testy korzystają z Pytest (MIT). Narzędzia budowania: Node (MIT i licencje zależności), npm (Artistic-2.0), uv (MIT/Apache-2.0), Ruff (MIT), FFmpeg (LGPL/GPL według zainstalowanej kompilacji).

Terra Draw obsługuje szkicowanie granicy na mapie (MIT). Do powiadomień przeglądarkowych służy pywebpush (MPL-2.0), a postęp dłuższych analiz przesyłają WebSockety. Wersje pakietów i źródła dystrybucji zawierają [plik blokady backendu](backend/uv.lock) i [plik blokady frontendu](frontend/package-lock.json). Przy dystrybucji binarnej należy zachować dołączone pliki licencji i obowiązkowe atrybucje.

## Interpretacja wyniku

- Pogoda NASA POWER opisuje obszar o rozmiarze kilkudziesięciu kilometrów. Przeliczenia wietrzności, promieniowania i opadu nie odtwarzają lokalnych burz. Pomiar IMGW stanowi osobny punkt odniesienia. Rozbieżność nie jest automatycznie korygowana.
- ET₀ FAO-56 obliczamy z temperatury, punktu rosy, wiatru 2 m, promieniowania i wysokości modelowej. Gdy w ostatnich 100 dniach zabraknie promieniowania, a temperatura jest dostępna, uzupełniamy ET₀ metodą Hargreavesa z FAO-56 i jawnie podajemy użyte dni. Zapotrzebowanie ETc powstaje przez przemnożenie dziennego ET₀ przez Kc. Daty rozwoju są przybliżeniem. Faza wprowadzona ręcznie dotyczy dnia analizy, a podana data startowa wpływa na cały sezon obliczeń.
- Bilans 30 dni porównuje wyłącznie wspólne daty opadu i ET₀, przy minimum 90% kompletności. Przerwy z opadem poniżej 1 mm nie przechodzą przez brakujący dzień. Gdy ostatnia pełna doba jest do 10 dni wcześniej, można pokazać oddzielne okno kończące się tego dnia. Historia odnosi do równorzędnych 30 dni w maksymalnie 10 poprzednich latach. Wykres zawiera tylko ukończone okna kwiecień–wrzesień w dziesięcioletnim okresie.
- Różnica predykcji SoilGrids przy 33 i 1500 kPa określa TAW po przemnożeniu przez nakładające się odcinki profilu. RAW = p · TAW. FAO-56 Ks ogranicza pobór wody po wyczerpaniu RAW. Dwa początki bilansu pokazują wrażliwość na stan startowy, bez estymacji prawdopodobieństwa. Okno do 90 dni wymaga minimum 21 kolejnych pełnych dni. Retencja przy 33 kPa jest przybliżeniem polowej pojemności wodnej, szczególnie dla piasków. Brak rozróżnienia warstw kamienistych, aktywnego wzrostu korzeni, podsiąku, spływu, zamarznięcia i przesychania poza uproszczonym modelem. Ilości wody nie są zaleceniami nawadniania.
- NDVI = (B08−B04)/(B08+B04), NDMI = (B08−B11)/(B08+B11), NDWI w definicji McFeetersa = (B03−B08)/(B03+B08). Przeliczamy odbicie ze skali i przesunięcia sceny. W Planetary Computer stosujemy korektę −1000 DN dla baz przetwarzania ≥04.00 zgodnie z dokumentacją Copernicus. Obliczamy medianę pikseli o SCL 4/5, bez chmur, cieni, śniegu i wody. Minimum 3 użyteczne piksele oraz 60% pokrycia. Indeksy dotyczą odbicia od powierzchni. Płodozmian oraz fazy rozwoju często wyjaśniają zmiany wskaźnika podobnie jak niedobór wody. Zimą, po zbiorach i przy małych działkach jest mniej danych użytecznych. Porównania sezonowe są próbą, bez gwarancji reprezentacji każdego roku.
- Klasa WorldCover pochodzi z 2021 r. Może rozpoznać pobliską stałą wodę, ale pomija małe rowy, wody okresowe i zmiany użytkowania. Szacowana odległość do najbliższego piksela to odległość od granicy, nie odległość do brzegu w terenie ani dowód możliwości poboru. Brak wskazania w promieniu 2 km oznacza brak wykrytego piksela. Hydro IMGW dostarcza stan wodowskazu tylko bieżącego dnia. Wysokość modelu powierzchni 25–30 m może obejmować roślinność i budynki. Prototyp nie wyznacza osi spływu ani miejsc robót ziemnych.
- Poszczególne źródła mają odrębny zasięg czasu i aktualność. Porównania pogodowe i satelitarne nie używają obserwacji po dacie analizy. Dzisiejsze granice, statyczna gleba i późniejsze pokrycie terenu są oznaczone jako kontekst. Rok publikacji może być późniejszy od obserwacji.
- Próg nachylenia 3% i flaga pokrycia rolniczego 40% są regułami przesiewowymi prototypu. Stopień pewności wynika z dostępności wejść. Braku kalibracji tego stopnia na polskich pomiarach terenowych. Jury dysponuje własnymi danymi referencyjnymi.
- Scenariusz zatrzymanego opadu wprowadza zadaną hipotetyczną wodę kolejnego dnia i porównuje jej wpływ na ubytek przy tym samym zapotrzebowaniu. Nie szacuje ilości wody uzyskanej w wyniku założenia międzyplonu, kosztu czy zwrotu finansowego.

Aby sprawdzić konkretne zalecenie, otwórz jego uzasadnienie w raporcie, odczytaj datę i kompletność danych, a następnie porównaj warunek reguły z katalogiem pod `/api/recommendations/catalog`. Stan gleby można skonfrontować z obserwacją w terenie. Dokładność wilgotności dla pojedynczej działki wymaga porównania z pomiarami na kilku głębokościach i dziennikiem nawodnień. Zespół nie przeprowadził takiej walidacji terenowej.

## Pomiary prototypu

Pomiar wykonano 21.11.2026 z lokalnego klienta HTTP na uruchomionym FastAPI. Świeży cache przed serią. Każdy pomiar zaczął się od wstępnego wyszukania działki, tak jak w przeglądarce. Drugi przebieg dotyczył tego samego wejścia i ponownie obliczył raport z cache źródeł. Czas nie obejmuje czekania na kafelki ani pobierania gotowego PDF.

| Region | Działka | Analiza | Zimny cache | Ciepły cache | Lata porównania 30 dni |
|---|---|---|---:|---:|---:|
| wielkopolskie | 301103_2.0009.549/7 | 2024-07-05 | 10.579 s | 0.126 s | 10 |
| lubelskie | 062010_2.0008.14 | 2023-07-20 | 5.119 s | 0.091 s | 10 |
| warmińsko-mazurskie | 280104_5.0006.98/2 | 2026-11-21 | 6.782 s | 0.128 s | 10 |

Przy większym ruchu dwa równoległe zadania analizy mogą wyczerpać limit instancji. Czasy w tabeli dotyczą pojedynczych żądań. Przepustowość krajowego wdrożenia wymaga testu obciążeniowego.
