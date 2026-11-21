# WodoStrażnik

**Jakobiany · HackNation 2026 · KOWR · Zatrzymaj wodę, chroń plony**

WodoStrażnik pomaga gospodarstwom zdecydować, kiedy sprawdzić zapas wody w glebie, jak ograniczyć straty wilgoci i od czego zacząć planowanie retencji. Wybierz działkę ewidencyjną, uprawę i datę. System pobierze źródła, przeliczy dane dla wskazanego pola i pokaże, z czego wynika każde zalecenie.

## Uruchomienie

Operator potrzebuje Docker Compose i dostępu HTTPS do publicznych źródeł. Rolnik otwiera aplikację w zwykłej przeglądarce.

```bash
docker compose up --build -d
curl http://127.0.0.1:8080/health
```

Otwórz [aplikację lokalną](http://127.0.0.1:8080) lub [API OpenAPI](http://127.0.0.1:8080/docs). Przykład pokazu to działka 301103_2.0009.549/7, ziemniak i 5 lipca 2024. Typ uprawy historycznej wymaga potwierdzenia przez użytkownika.

Bez Dockera użyj Node.js 24, uv, Python 3.13 i fontów DejaVu. Na Ubuntu lub Debianie doinstaluj fonts-dejavu-core.

```bash
npm --prefix frontend ci
./scripts/run.sh
```

Do wdrożenia zewnętrznego uruchom obraz za reverse proxy HTTPS i użyj wolumenu dla /var/lib/wodo. Obraz nasłuchuje na 8000, a Compose udostępnia go lokalnie na 8080. Hosting zewnętrzny wymaga konta i konfiguracji dostępu dla jury.

## Dane działek

Geometrię działek wyszukuje własny indeks zbudowany z krajowego pliku GeoParquet GUGiK / EGiB (4,59 GB, 38,9 mln działek). Usługa `parcels-updater` pobiera plik i buduje indeks w tle po `docker compose up --build`. API startuje od razu, a `/api/parcels/*` zwraca 503, dopóki dane nie są gotowe. Pierwsze pobranie i budowa trwają ok. 35–40 min, potrzeba co najmniej 40 GB wolnego miejsca na wolumenie i 6 GB RAM dla Dockera (w WSL2 trzymaj repozytorium w systemie plików Linuksa). Postęp: `docker compose logs -f parcels-updater` oraz blok `parcels` w `curl localhost:8080/api/health`.

ULDK pozostaje tylko opcją (`WODO_PARCEL_SOURCE=uldk`), bo w sieci hackathonu usługa przekierowuje zapytania na adres pułapki. Znany problem: nakładka WMS z granicami działek na mapie jest przekierowywana tak samo i nie działa. Szczegóły, polecenia operacyjne i pomiary: [Dane działek](docs/PARCELS_DATA.md).

## Funkcje

- Wyszukiwanie pełnym identyfikatorem, z mapy lub przez nazwę i numer obrębu. Import Polygon lub MultiPolygon GeoJSON w WGS 84.
- Sześć upraw, ruchomy przedział dziesięciu lat, opcjonalna faza, początek wegetacji, lokalna obserwacja i znane nawadnianie.
- Bilans pogodowy, porównania sezonowe, model strefy korzeni, indeksy Sentinel-2, pokrycie terenu, wody powierzchniowe, stacje IMGW i spadek terenu.
- Uzasadnienia działań, scenariusz dodatkowej wody, PDF z granicą, druk i eksport JSON.

## Architektura i dane

Angular, PrimeNG i ECharts renderują formularz, wykresy i raport, a MapLibre GL mapę z darmowymi podkładami (OpenStreetMap, ortofotomapa GUGiK; nakładka granic działek GUGiK jest chwilowo niedostępna). FastAPI udostępnia API i serwuje zbudowaną aplikację z tej samej domeny. Klienci źródeł działają równolegle. Moduł science.py liczy ET₀ FAO-56, ETc, scenariusze stanu początkowego i porównania historyczne. Moduł analysis.py wybiera reguły na podstawie obliczeń, a ReportLab generuje dokument z obiektu raportu.

| API | Działanie |
|---|---|
| GET /health, /api/crops | Zasięg dat i słownik upraw |
| GET /api/parcels/{id}, /api/parcels/search, /api/parcels/by-point, POST /api/parcels/import | Wyszukiwanie i walidacja geometrii |
| POST /api/analysis | Pobranie danych i obliczenie oceny |
| GET /api/analysis/{id} | Odczyt raportu |
| GET /api/analysis/{id}/provenance, /api/analysis/{id}/report | Metadane oraz eksport PDF lub JSON |
| GET /api/data-sources/status | Dostępność źródeł w ostatniej analizie |

Geometria pochodzi z krajowego zbioru EGiB GUGiK (GeoParquet, lokalny indeks). NASA POWER i IMGW dostarczają meteorologię, Sentinel-2 obserwacje powierzchni, SoilGrids charakterystyki retencji, ESA WorldCover informację o pokryciu i wodach, a Copernicus modele powierzchni. IMGW hydro uzupełnia bieżący raport o najbliższy przydatny wodowskaz. Źródła są pobierane na żądanie według ważności cache. SQLite przechowuje metadane, serie i pochodne z sumą SHA-256. Identyfikator raportu jest losowy i wygasa najpóźniej po 14 dniach. Raporty i zalecenia są obliczane po każdym uruchomieniu analizy. Pełne zbiory dostawców pozostają poza repozytorium.

- [Dane działek: pobieranie, indeks, operacje](docs/PARCELS_DATA.md)
- [Źródła i zakres](docs/DATA_SOURCES.md)
- [Licencje i komponenty](docs/DATA_LICENSES.md)
- [Metoda i ograniczenia](docs/DATA_LIMITATIONS.md)
- [Metadane pobrań i pomiary](submission/live-verification.json)
- [Macierz wymagań](docs/REQUIREMENTS_MATRIX.md)
- [Lista zgłoszeniowa](SUBMISSION_CHECKLIST.md)

### Lokalna kopia granic działek

Jeśli ULDK zwróci błąd lub pusty wynik, aplikacja sprawdza lokalny GeoPackage dla pełnych identyfikatorów EGiB zaczynających się od `2607` i dla kliknięć na mapie w zasięgu kopii. Szuka pliku `.wodo-cache/egib/ostrowiecki-2607.gpkg`. Docker Compose montuje katalog `.wodo-cache/egib` tylko do odczytu. Przy uruchomieniu bez Compose ścieżkę można ustawić przez `WODO_EGIB_GPKG`.

### Paszport pola na żądanie

[Konfiguracja źródeł i referencji dla pól P0](docs/PASSPORT_P0.md).

Wybierz działkę EGiB i datę w aplikacji, a następnie kliknij **Pokaż paszport pola**. Dane można rozwinąć na ekranie lub zapisać jako JSON. To uruchamia `GET /api/passport?parcel_id=301103_2.0009.549%2F7&as_of=2024-07-05`. Domyślna data to dziś. API pobiera dane równolegle i korzysta z istniejącej pamięci podręcznej SQLite.

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
