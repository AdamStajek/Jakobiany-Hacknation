# Dane działek (GUGiK / EGiB, GeoParquet)

Przewodnik dla deweloperów i operatorów. Opisuje, skąd aplikacja bierze geometrię działek, jak ją pobiera i indeksuje, jak sprawdzić gotowość oraz co zrobić, gdy coś nie działa.

## Streszczenie

- Głównym źródłem działek jest krajowy plik GeoParquet GUGiK z ewidencji gruntów i budynków (EGiB): [0_dzialki.parquet](https://opendata.geoportal.gov.pl/InneDane/latest_exports/eziudp_wfs/PARQUET/0_dzialki.parquet).
- Plik ma 4,59 GB. Usługa `parcels-updater` pobiera go w tle, buduje lokalny indeks DuckDB i podmienia go atomowo. API startuje od razu, a `/api/parcels/*` zwraca 503 do czasu publikacji indeksu.
- Pierwsze uruchomienie: pobranie ok. 25–30 min, budowa indeksu ok. 8 min, razem około pół godziny. Kolejne uruchomienia korzystają z istniejącego indeksu.
- Potrzeba co najmniej 40 GB wolnego miejsca w `data/parcels/` i 6 GB RAM dla Dockera.
- Usługa ULDK nie jest już głównym źródłem (patrz [Flaga ULDK](#flaga-uldk)).

## Wymagania (Windows + WSL2)

- Docker Desktop z włączoną integracją z WSL2 (Settings, Resources, WSL integration) albo Docker Engine w samej dystrybucji WSL.
- Repozytorium trzymaj w systemie plików Linuksa (np. `~/git/...`), nie w `/mnt/c`. Dostęp przez `/mnt/c` jest wolny. Dane działek trafiają do katalogu `data/parcels/` w repozytorium (bind mount), więc repozytorium musi leżeć w systemie plików Linuksa. Zawsze uruchamiaj `./start.sh`: ustawia on uid/gid kontenera na Twojego użytkownika, żeby updater mógł pisać do tego katalogu.
- Docker Desktop / WSL2: przydziel co najmniej 6 GB RAM (`.wslconfig`, `memory=6GB`) i co najmniej 40 GB wolnego miejsca na dysku wirtualnym.
- Dostęp HTTPS do `opendata.geoportal.gov.pl`.

## Uruchomienie jednym poleceniem

```bash
docker compose up --build
```

Compose uruchamia dwie usługi:

| Usługa | Rola |
|---|---|
| `wodo` | API i aplikacja, port 8080. Katalog `data/parcels/` jest zamontowany tylko do odczytu w `/var/lib/wodo-parcels`. Startuje od razu. |
| `parcels-updater` | Pętla `python -m wodo.parcels_data loop`. Pobiera plik, buduje indeks, publikuje go i usypia na `WODO_PARCELS_REFRESH_HOURS` (domyślnie 24 h). |

Dane leżą w katalogu hosta `data/parcels/` (zmienna `WODO_PARCELS_HOST_DIR`), montowanym do obu kontenerów jako `/var/lib/wodo-parcels`. Nie trafiają do gita ani do obrazu, przeżywają `docker compose down -v` i są wspólne dla uruchomienia z Dockerem i lokalnego backendu. Ponowne `./start.sh` nie pobiera niczego, jeśli ETag się zgadza.

## Jak sprawdzić postęp i gotowość

```bash
docker compose logs -f parcels-updater
curl localhost:8080/api/health
```

Blok `parcels` w `/api/health`:

- gotowe: `ready`, `rows`, `etag`, `last_modified`, `downloaded_at`, `age_hours`, `release`;
- w trakcie pobierania: `ready: false` oraz informacja o postępie (`progress`).

Dopóki indeks nie jest opublikowany, `/api/parcels/*` zwraca 503 z komunikatem „Dane działek są w trakcie pobierania…”. To oczekiwane zachowanie, nie błąd. Usługa `parcels-updater` ma healthcheck `python -m wodo.parcels_data healthcheck` (okres 60 s, 120 s na start).

## Ile to trwa

| Etap | Czas |
|---|---|
| Pobranie 4,59 GB, 12 połączeń Range | ok. 25–30 min z rozbiegiem (3–4,5 MB/s) |
| Budowa indeksu (4 wątki, limit pamięci 3 GB) | 472 s (ok. 8 min) |
| Razem przy pierwszym uruchomieniu | ok. 35–40 min |

Serwer ogranicza każde połączenie do ok. 0,7–1 MB/s, więc jedno połączenie potrzebowałoby 1,5–2 h. Dlatego pobieranie jest równoległe i wznawialne po przerwaniu.

## Operacje

Wymuszenie ponownego pobrania i przebudowy:

```bash
docker compose exec parcels-updater /app/.venv/bin/python -m wodo.parcels_data force
```

Usunięcie danych i start od zera:

```bash
docker compose down
rm -rf data/parcels
```

Polecenia CLI modułu: `python -m wodo.parcels_data refresh|force|status|healthcheck|loop`.

| Polecenie | Działanie |
|---|---|
| `refresh` | Sprawdza ETag i Last-Modified (HEAD), pobiera tylko przy braku danych lub zmianie. |
| `force` | Pobiera i przebudowuje bez względu na ETag. |
| `status` | Wypisuje stan opublikowanych danych. |
| `healthcheck` | Kod wyjścia dla Dockera. |
| `loop` | Pętla produkcyjna: `refresh`, potem sen. |

### Zmienne środowiskowe

| Zmienna | Domyślnie | Znaczenie |
|---|---|---|
| `WODO_PARCEL_SOURCE` | `parquet` | `parquet` lub `uldk`. |
| `WODO_PARCELS_DIR` | `/var/lib/wodo-parcels` w kontenerach, `data/parcels` lokalnie | Katalog danych. |
| `WODO_PARCELS_URL` | adres pliku GUGiK | Źródło pliku Parquet. |
| `WODO_PARCELS_REFRESH_HOURS` | 24 | Odstęp między sprawdzeniami. |
| `WODO_PARCELS_CONNECTIONS` | 12 | Liczba równoległych połączeń Range. |
| `WODO_PARCELS_MEMORY` | 3GB | Limit pamięci DuckDB przy budowie. |
| `WODO_PARCELS_THREADS` | 4 | Wątki budowy indeksu. |

Przy uruchomieniu backendu lokalnie, bez Dockera, dane są w `data/parcels/` (w `.gitignore` i `.dockerignore`).

### Flaga ULDK

```bash
WODO_PARCEL_SOURCE=uldk docker compose up
```

Tryb ULDK jest zachowany tylko jako opcja i działa wyłącznie wtedy, gdy sieć użytkownika nie jest zablokowana. Podczas hackathonu `uldk.gugik.gov.pl` przekierowywał każde zapytanie (302) na adres pułapki `integracja01.gugik.gov.pl/resp/uldk.php` z odpowiedzią o `Content-Length` 4294967296. Prawdopodobną przyczyną jest blokada IP wspólnego NAT-a. Nie należy kierować aplikacji na ten adres ani podnosić limitów pobierania.

## Architektura

```
opendata.geoportal.gov.pl  ->  parcels-updater  ->  data/parcels  ->  wodo (tylko odczyt)
   0_dzialki.parquet            pobranie + indeks     current -> releases/<ts>/
```

Układ katalogu `WODO_PARCELS_DIR`:

```
current -> releases/<ts>/        symlink podmieniany atomowo (to czyta API)
releases/<ts>/parcels.duckdb     indeks zapytań
releases/<ts>/meta.json          ETag, Last-Modified, liczba wierszy, daty
tmp/                             pobrania w toku (*.part i stan)
.lock                            flock: jeden pobierający naraz
```

### Cykl aktualizacji

1. Zapytanie HEAD o ETag i Last-Modified. Bez zmian oznacza koniec cyklu.
2. Pobranie równoległymi zakresami (`Range: bytes=a-b`). Serwer przyjmuje `Accept-Ranges: bytes`, ale odrzuca zakres sufiksowy `bytes=-N` kodem 416, więc używane są wyłącznie zakresy jawne. Weryfikacja magicznych bajtów `PAR1` na początku i końcu pliku.
3. Budowa indeksu w `releases/<ts>/`.
4. Atomowa podmiana symlinku `current`.
5. Usunięcie surowego pliku Parquet i starych wydań (zostają 2).
6. Sen przez `WODO_PARCELS_REFRESH_HOURS`.

Blokada `flock` zapobiega równoległym uruchomieniom. Błędy są logowane, a poprzednie dane pozostają w użyciu.

### Indeks

Plik źródłowy nie jest posortowany ani po identyfikatorze, ani przestrzennie: każda z 594 grup wierszy obejmuje cały kraj, a zakresy min/max identyfikatorów nakładają się. Odczyt bezpośredni z pliku wymagałby więc przejrzenia całości, dlatego budowany jest własny indeks w DuckDB:

- tabela `parcels` posortowana według kodu Mortona (krzywa Z) środka bbox, z kluczem sekwencyjnym. Dzięki temu strefy (zone maps) kolumn odcinają większość danych przy zapytaniu o punkt;
- wąskie tabele `by_id` (identyfikator wielkimi literami) i `by_name` (nazwa obrębu małymi literami, numer działki małymi literami);
- bez rozszerzenia spatial i bez indeksów ART;
- zapytanie o punkt: kandydaci z bbox, następnie dokładny test punkt w wielokącie w Shapely;
- wynik jest przeliczany z EPSG:2180 do EPSG:4326 i sprawdzany przez `validate_geometry`: Polska, 1 m² do 2000 ha, rozpiętość do 12 km, do 20 000 wierzchołków.

Dlaczego DuckDB, a nie SQLite lub GeoPackage: czyta Parquet bezpośrednio, jest kolumnowy, ma zone maps, sortowanie zewnętrzne ze zrzutem na dysk, a jako zależność to jedno niewielkie koło pip. Nie pobiera rozszerzeń w czasie działania, więc działa offline w kontenerze.

### Źródło geometrii a pole powierzchni

`area_ha` w API pochodzi z geometrii, nie z atrybutu `pole_ewidencyjne`. Przykłady rozbieżności w źródle: 301103_2.0001.121 ma deklarowane 0,7 ha, a geometria daje 0,2405 ha. 301103_2.0009.549/7: 5,8987 ha wobec 5,89373 ha z geometrii.

## Wymagania dysku i pamięci

| Zasób | Wartość | Uwagi |
|---|---|---|
| Surowy Parquet | 4,6 GB | Usuwany po udanej publikacji. |
| Indeks `parcels.duckdb` | 9,5 GB (9 511 383 040 B, ok. 8,9 GiB) | Jedno wydanie. |
| Pliki tymczasowe sortowania | co najmniej 14 GB | Tylko w czasie budowy. |
| Pierwsze uruchomienie | zalecane co najmniej 40 GB wolnego | Parquet + zrzut + nowy indeks. |
| Odświeżanie w stanie ustalonym | zalecane co najmniej 40 GB wolnego | Parquet 4,6 + zrzut + nowy indeks 9,5 + stary indeks 9,5. Stary indeks zostaje do publikacji nowego, zachowywane są 2 wydania. |
| RAM: API | niewielki | Bufor DuckDB. |
| RAM: budowa indeksu | ok. 3–4 GB (RSS ok. 3 GB) | Limit `WODO_PARCELS_MEMORY=3GB`. |
| RAM: Docker Desktop / WSL2 | co najmniej 6 GB | |

## Rozwiązywanie problemów

| Objaw | Przyczyna i działanie |
|---|---|
| `/api/parcels/*` zwraca 503 | Indeks jeszcze nie jest gotowy. Sprawdź `docker compose logs -f parcels-updater` i `/api/health`. |
| Pobieranie jest wolne | To limit serwera na połączenie. Nie zmieniaj adresu źródła. Sprawdź `WODO_PARCELS_CONNECTIONS` i swoje łącze. |
| Pobranie przerwane | Uruchom ponownie. Pobieranie jest wznawialne, błędy nie kasują poprzednich danych. |
| Brak miejsca na dysku | Zwolnij miejsce (patrz tabela) i uruchom `force`. Sprawdź `docker system df`. W razie potrzeby usuń `data/parcels/`. |
| Budowa kończy się zabiciem procesu (OOM) | Zwiększ pamięć WSL2 do co najmniej 6 GB lub obniż `WODO_PARCELS_MEMORY` i `WODO_PARCELS_THREADS`. |
| Powolne pliki w WSL | Repozytorium leży w `/mnt/c`. Przenieś je do systemu plików Linuksa. |
| Aktualizator „unhealthy” przez pierwsze minuty | Normalne podczas pobierania. Healthcheck ma 120 s na start i toleruje trwającą pracę. Przy powtarzającym się błędzie czytaj logi. |
| Wyszukiwanie po nazwie nie znajduje działki | W źródle 47 942 wierszy nie ma nazwy obrębu. Użyj identyfikatora lub punktu. |
| Przekierowanie 302 w trybie ULDK | Blokada sieciowa. Wróć do `WODO_PARCEL_SOURCE=parquet` (domyślnie). |

## Ustalenia o danych i pomiary

Źródło: GUGiK, EGiB, GeoParquet 1.1, geometria WKB, układ EPSG:2180. Pobrano 2026-11-21.

Plik:

- rozmiar 4 591 485 104 B (4,59 GB; 4,28 GiB), `Accept-Ranges: bytes`, ETag `"6b0109eb-111ac80b0"`, Last-Modified: Sat, 21 Nov 2026 03:03:07 GMT;
- magiczne bajty `PAR1` na początku i końcu potwierdzone;
- 38 909 091 wierszy, 594 grupy wierszy (ok. 65 tys. wierszy każda), autor GDAL 3.9.3 / parquet-cpp-arrow 14.0.1.

Kolumny: `id_dzialki`, `numer_dzialki`, `nazwa_obrebu`, `numer_obrebu`, `numer_jednostki`, `nazwa_gminy`, `data`, `pole_ewidencyjne`, `klasouzytki_egib`, `grupa_rejestrowa`, `pozostale_atrybuty`, `czas_pozyskania`, `geometry` (WKB; DuckDB 2.x czyta jako natywny GEOMETRY z CRS) oraz `geometry_bbox` (STRUCT xmin, ymin, xmax, ymax typu FLOAT32, to nie są kolumny najwyższego poziomu).

Kompletność i jakość:

- 380 różnych czterocyfrowych prefiksów TERYT (380 powiatów) i wszystkie 16 województw (prefiksy 02–32). 0 zduplikowanych identyfikatorów, 0 pustych geometrii;
- w próbce `data` = 2026-11-19, `czas_pozyskania` = 2026-11-20;
- format identyfikatorów jest taki sam jak w aplikacji (301103_2.0001.121, 301103_2.0009.549/7, a także formy AR_, np. 241603_2.0010.AR_3.204/70.);
- 1 166 identyfikatorów kończy się kropką (np. `081201_5.0018.`, `241606_4.0001.AR_19.7314.`). Wyrażenie regularne dopuszcza końcową kropkę;
- 47 942 wierszy ma pustą `nazwa_obrebu`. Wyszukiwanie po nazwie ich nie znajdzie, wyszukiwanie po identyfikatorze lub punkcie tak;
- część wierszy ma odstające wartości bbox (maksymalnie xmax 5 549 697, ymax 6 555 624). To błędne dane źródła, nieistotne dla wyszukiwania, ale warto o nich wiedzieć.

Kolejność osi: metadane CRS deklarują kolejność northing/easting, jednak zapisane rzędne są w kolejności (easting, northing). Przykład: 301103_2.0001.121 ma bbox x=336317..336917, y=475037..475151. Potwierdzono to wyszukiwaniem po punkcie w Lublinie, Gdańsku i Zakopanem, które trafiły w właściwe działki.

Czasy zapytań na rzeczywistych danych (pierwsze wywołanie na zimno / kolejne):

| Zapytanie | Zimno | Ciepło |
|---|---|---|
| id 301103_2.0009.549/7 | 56–188 ms | 7 ms |
| id 301103_2.0001.121 | 8 ms | 6 ms |
| id AR_ z końcową kropką | 27 ms | 6 ms |
| nazwa „Bonikowo 121” | 14 ms | 7 ms |
| nazwa „Kiełczewo 549/7” | 12 ms | 7 ms |
| sam numer „121” (limit 60 wyników) | 378 ms | 150 ms |
| punkt 16.644, 52.111 | 31 ms | 25 ms |
| punkt w Lublinie (066301_1.0034.AR_2.130, Stare Miasto) | 22 ms | 6 ms |
| punkt w Gdańsku (226101_1.0090.102/7) | 22 ms | 12 ms |
| punkt w Zakopanem (121701_1.0005.1067) | 32 ms | 8 ms |

## Znany problem: nakładka granic działek na mapie

Warstwa WMS z granicami działek w `frontend/src/app/shared/map/map-style.ts` (`integracja.gugik.gov.pl/cgi-bin/KrajowaIntegracjaEwidencjiGruntow`) jest przekierowywana na ten sam adres pułapki i nie działa. Wyszukiwanie i analiza działek nie zależą od tej warstwy. Zastąpienie jej własnymi danymi to osobne zadanie.

## Dalsze prace (poza zakresem)

- rysowanie wielokąta na mapie wraz z komunikatem błędu w interfejsie;
- zastąpienie nakładki granic działek własnymi danymi z indeksu;
- przybliżona powierzchnia działki wyznaczona z kliknięcia.

## Atrybucja i licencja

Dane pochodzą z portalu opendata.geoportal.gov.pl, wydawcą jest Główny Urząd Geodezji i Kartografii (GUGiK), a zbiór to EGiB. Wskazanie źródła: „Źródło: GUGiK / EGiB (dane otwarte, opendata.geoportal.gov.pl)”. Aplikacja pokazuje źródło w wynikach. Dokładny tekst warunków wykorzystania należy potwierdzić na portalu: https://opendata.geoportal.gov.pl/.
