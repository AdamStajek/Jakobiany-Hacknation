# Źródła danych

| Kategoria | Integracja wykorzystana przez prototyp | Zakres i rozdzielczość |
|---|---|---|
| Działki | [GUGiK / ULDK](https://uldk.gugik.gov.pl/opis.html), wyszukanie przez identyfikator, nazwę i numer obrębu lub punkt | Geometria dostarczona przez EGiB. Pobranie zapisane przy działce. |
| Meteorologia | [NASA POWER Daily AG](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) z opadem, temperaturą, punktem rosy, wiatrem i promieniowaniem. [IMGW-PIB](https://danepubliczne.imgw.pl/pl/apiinfo) jako punkt porównania | NASA: dziennie w UTC, meteorologia 0,5° × 0,625°, promieniowanie zwykle 1°. Przetwarzane są tylko obserwacje do daty analizy. IMGW: lokalizacja oraz odległość od najbliższej użytecznej stacji, wybrane pomiary bieżące lub archiwum dobowe. |
| Satelita | [Sentinel-2 L2A / Microsoft Planetary Computer](https://planetarycomputer.microsoft.com/docs/) i alternatywny katalog [Earth Search](https://earth-search.aws.element84.com/v1), okna COG i maska SCL | 20 m w analizie. Stan sceny do 38 dni wstecz, porównania z maksymalnie trzema wcześniejszymi latami, datowane osobno. |
| Gleba | [ISRIC SoilGrids WCS](https://docs.isric.org/globaldata/soilgrids/SoilGrids_access.html) z parametrami wv0033 i wv1500 | Predykcja 250 m. Wycinki 0–5, 5–15, 15–30, 30–60 i 60–100 cm. Piksele wewnątrz działki lub piksel reprezentatywny. |
| Teren | [EU-DEM 25 m przez Open Topo Data](https://www.opentopodata.org/datasets/eudem/). Awaryjnie [Copernicus DEM GLO-30](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM) | Próbkowane wysokości i nachylenie z różnic centralnych na siatce 25 m. GLO-30: rzeczywisty raster powierzchni, okno 30 m, cięcie do granicy. |
| Pokrycie i hydrologia | [ESA WorldCover 2021 v200](https://worldcover2021.esa.int/) oraz [IMGW / hydro](https://danepubliczne.imgw.pl/api/data/hydro/) w bieżącym dniu | ESA 10 m, przeliczenie do 20 m dla udziałów pokrycia i pikseli stałej wody w promieniu 2 km. Wodowskaz w promieniu do 50 km z nazwą cieku, odległością i czasem obserwacji. |

## Zweryfikowane źródła alternatywne

- [Zbiorczy WFS EGiB](https://mapy.geoportal.gov.pl/wss/service/PZGIK/EGIB/WFS/UslugaZbiorcza) i [GeoParquet dla kraju](https://opendata.geoportal.gov.pl/InneDane/latest_exports/eziudp_wfs/PARQUET/0_dzialki.parquet) opisuje GUGiK. ULDK kieruje zapytania do WFS powiatu lub korzysta z bazy usługi zbiorczej. Prototyp używa tej ścieżki i nie pobiera bazy krajowej.
- [GUGiK NMT WCS](https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WCS/DigitalTerrainModelFormatTIFF) udostępnił metadane, ale ograniczone zapytania GetCoverage przekroczyły czas oczekiwania. Prototyp przeszedł na zweryfikowane odczyty EU-DEM.
- [Hydroportal Wód Polskich](https://wody.isok.gov.pl/hydroportal.html), [EDO WMS](https://drought.emergency.copernicus.eu/data/wms-service) oraz [Mapa IUNG](https://susza.iung.pulawy.pl/mapa-kategorii/) pozostają źródłami referencyjnymi do wizualnej kontroli. Prototyp nie wyciąga z tych map wartości analitycznych.
- [ISRIC](https://docs.isric.org/globaldata/soilgrids/) dokumentuje również WebDAV/VRT. Działający WCS zwrócił małe pliki GeoTIFF, więc nie jest potrzebna wstrzymana usługa REST.
- [Open-Meteo](https://open-meteo.com/en/docs/historical-weather-api) zwrócił 429 dla archiwum. Adapter ERA5-Land jest domyślnie wyłączony. Włączenie przez `WODO_NONCOMMERCIAL_OPEN_METEO=1` pozwala użyć go jako alternatywy przy braku NASA w uprawnionej, niekomercyjnej instancji. [Copernicus Climate Data Store](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land) udostępnia ERA5-Land bezpośrednio z odrębną licencją. Taka zmiana dostawcy wymaga osobnego testu pobierania, przeliczeń i wydajności.

Z Earth Search zweryfikowano katalog i przykładowe okno pasm. Dla większości testowanych okien AWS transfer przekraczał limit. Planetary Computer zapewnił pełne odczyty dla dwóch działek, przez anonimowe STAC i krótkotrwały token dostępu do danych. Token nie trafia do cache ani eksportów.

Metadane każdego uruchomienia zawierają URL, typ, czas pobrania, okres i rozdzielczość. Analiza historyczna używa dzisiejszej geometrii GUGiK oraz statycznych produktów z odrębnym oznaczeniem w raporcie. Daty przetworzenia publicznych produktów mogą być późniejsze niż data obserwacji.
