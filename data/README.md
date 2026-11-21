# Dane WodoStrażnika

Repozytorium przechowuje manifest pochodzenia i dowody weryfikacji, a surowe zbiory pobiera na żądanie. Wersjonowanie wejść prowadzi SQLite, którego ścieżkę ustawia `WODO_CACHE_DIR`. Cache zawiera metadane źródeł, przeliczone serie dobowe, zredukowane cechy rastrów i raporty. Zakres pobrań ogranicza geometria lub punkt analizowanej działki.

`manifest.json` jest rejestrem zweryfikowanych publikacji i rzeczywistych pobrań. Zrzuty polityk dostawców i pełne zbiory danych nie są częścią repozytorium. Licencje i ograniczenia opisano w dokumentach `docs/DATA_LICENSES.md` oraz `docs/DATA_LIMITATIONS.md`.

Odświeżenie obserwacji następuje zgodnie z czasem życia źródła. Do jawnego sprawdzenia integralności i wygaszenia źródeł służy `scripts/cache_status.py`. `scripts/check_live.py` przechodzi przez pełną ścieżkę pobierania dla rzeczywistych działek.

Geometria działek nie leży w repozytorium: krajowy plik GeoParquet GUGiK / EGiB i jego indeks DuckDB trafiają do katalogu `data/parcels/` (katalog w .gitignore, montowany do kontenerów). Opis w `docs/PARCELS_DATA.md`.
