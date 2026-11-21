# Warstwy uzupełniające P0

Paszport uruchamia obliczenia po wybraniu działki. Status i przyczyna braku znajdują się przy konkretnym polu JSON.

| Pola | Wejście |
|---|---|
| Typ uprawy i pewność CLMS | Backend odczytuje `CDSE_CLIENT_ID` i `CDSE_CLIENT_SECRET` klienta OAuth Sentinel Hub w Copernicus Data Space. Pobiera CTY i CTYCL na siatce 10 m. Zwraca kod klasy dominującej i średnią pewność ważoną powierzchnią przecięcia z działką. Klasyfikacja opisuje kampanię retrospektywnie. |
| Wilgotność 100–289 cm i jej percentyl | `CDSAPI_KEY` to osobisty token Climate Data Store z dostępem do reanalysis-era5-land-timeseries. Pierwsze pobranie zleca zadanie CDS. Kolejne żądanie sprawdza wynik. Średnia dobowa wymaga 24 godzin. Percentyl porównuje ten sam dzień roku w co najmniej dziesięciu poprzednich latach dla tej samej komórki i warstwy. |
| Powierzchnia, objętość i geometria zagłębień | Publiczny NMT GUGiK. Algorytm wypełnia obniżenia do przelewu i stosuje próg 0,25 m. Krawędzie pobranego wycinka i luki NMT pełnią rolę odpływów. Tak obliczony wynik może zaniżyć retencję zagłębień wychodzących poza wycinek. |
| Kierunek i akumulacja spływu | NMT całej zlewni z zasobów operatora. Wynik zawiera dwa osadzone COG w formacie data URI. Kody kierunków D8 to 1 dla wschodu, następnie kolejne potęgi dwójki zgodnie z ruchem wskazówek zegara. Akumulacja obejmuje komórkę bieżącą. |
| Odległości do cieku, rowu i stawu | Warstwy BDOT10k z zasobów operatora. Wynik jest najmniejszą odległością od geometrii działki w metrach. Przecięcie daje zero. Zasięg wyszukiwania wynosi 10 km. |
| Anomalie NDVI i NDMI | Scena Sentinel-2 oraz referencja dla tej samej działki, uprawy i fazy. Wymagane są trzy wcześniejsze lata i co najmniej 60% czystych pikseli na obserwację. Każdy rok ma taką samą wagę. |

## Pliki operatora

Ustaw `WODO_PASSPORT_LAYERS` na katalog danych czytelny dla backendu. W kontenerze zamontuj ten katalog tylko do odczytu i podaj jego ścieżkę wewnątrz kontenera.

- `bdot10k.gpkg` zawiera warstwy EPSG:2180 z indeksem przestrzennym GeoPackage: `OT_SWRS_L`, `OT_SWRM_L` i wyodrębnioną warstwę stawów `ponds`. Dane powinny obejmować również sąsiednie powiaty w promieniu wyszukiwania. Niepełny zasięg może zawyżać odległość.
- `basins/<identyfikator EGiB>.tif` to NMT obejmujący całą zlewnię dopływającą do działki. W nazwie zastąp ukośnik myślnikiem. Użyj kwadratowych pikseli w EPSG:2180, do miliona komórek na zlewnię. Raster wynikowy obejmuje prostokąt działki. Dobór zlewni i rozdzielczości należy do operatora.
- `sentinel_reference.csv` zawiera kolumny `parcel_id,observed_at,crop,stage,ndvi_mean,ndmi_mean,clear_pixel_pct`. Użyj identyfikatorów upraw i faz z aplikacji, dat ISO i tej samej metody maskowania oraz agregacji Sentinel‑2 co w paszporcie.
- Opcjonalny plik `era5/<lat>_<lon>.csv` zastępuje żądanie CDS. Współrzędne środka komórki podaj z jednym miejscem po przecinku, np. `52.0_19.0.csv`. Kolumny to `valid_time,latitude,longitude,swvl4`, czas UTC, wilgotność w m³/m³.

Opis kolekcji i warstw publikują [Sentinel Hub CDSE](https://documentation.v1.dataspace.copernicus.eu/APIs/SentinelHub/Data/clms/land-cover-and-land-use-mapping/croplands/crop-types/crop-types/clms_vlcc_crop-types_europe_10m_yearly_v1.html), [Climate Data Store](https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land-timeseries) i [Geoportal BDOT10k](https://www.geoportal.gov.pl/pl/dane/baza-danych-obiektow-topograficznych-bdot10k/).
