# Macierz wymagań KOWR

Podstawą oceny są [regulamin KOWR](https://mudnibfuppwadjkynscc.supabase.co/storage/v1/object/public/task-files/057d36b5-cb92-4062-9393-983cb8a96088/files/18541921-409f-4e24-a3a5-85a1cf240097.pdf) i [opis techniczny](https://mudnibfuppwadjkynscc.supabase.co/storage/v1/object/public/task-files/057d36b5-cb92-4062-9393-983cb8a96088/files/e71532fb-bc29-4fb6-8cd6-92fe51530540.pdf). Oba odczytano 21.11.2026. Strona zadania zawierała te dwa pliki. Opis wymienia osobny załącznik naukowy bez adresu lub osadzonego pliku. Wyszukiwanie i przegląd katalogu roboczego nie ujawniły załącznika ani przesłanego pliku MD. Metody oparto na źródłach opisanych w dokumentacji metod. Regulamin zadania ma pierwszeństwo w razie rozbieżności.

| Źródło | Wymaganie i dowód docelowy | Weryfikacja |
|---|---|---|
| Opis 3.1–3.2, 5.4 | Polski interfejs w zwykłej przeglądarce bez opłat, instalacji i GIS. Test przeglądarkowy, formularze i mapa. Mobilność jako atut. | Zrealizowane. Chromium, Firefox i WebKit na Linux. Viewport 390 px. Windows, Safari oraz markowe kompilacje Edge i Opera bez osobnego testu. |
| Opis 3.2–3.3 | Dowolny identyfikator lub wskazanie na mapie, granice i wybór uprawy. Test indeksu GeoParquet GUGiK / EGiB i E2E. | Zrealizowane. Test punktu, pełnego ID i niepełnej nazwy w check_live.py oraz backend/tests/test_parcels.py. Pomiar: wyszukiwanie 6–190 ms. Nakładka WMS z granicami działek na mapie nie działa (przekierowanie usługi GUGiK). Geometria i wyświetlenie E2E. JSON i geometria w testach. |
| Opis 3.2–3.3, 6 | Dzień bieżący i dowolna data z ostatnich 10 lat, ocena bieżąca i wieloletnia. Testy braku przyszłych obserwacji i pokrycia. | Zrealizowane. Dwa lata historyczne, dzień bieżący i test daty granicznej. Dziesięć zestawów porównawczych na działkę. Bieżąca doba może być niepełna. |
| Opis 3.2–3.3 | Meteorologia, obserwacje satelitarne z kontekstem uprawy, gleba, hydrologia, lokalizacja/granice, pokrycie i rzeźba terenu. Testy integracyjne dostawców. | Zrealizowane na działkach raportowych. Rzeczywiste Sentinel-2, SoilGrids, NASA/IMGW, WorldCover i Copernicus EU-DEM. Bieżący wodowskaz IMGW testowano na Warmii. |
| Opis 3.2–3.3 | Ocena i przyczyny przed rekomendacjami, zalecenia retencyjne i agrotechniczne, opcjonalne nawadnianie. Weryfikacja reguł i przykładowe raporty. | Zrealizowane. Ocena, bilans i rekomendacje z dowodami w działającym raporcie. Nawadnianie warunkowe, bez precyzyjnej dawki. |
| Opis 3.3 | Obliczenia dynamiczne z realnych danych, daty, źródła, dokładność, niepewność i jawne braki. Testy zmienności wyniku i awarii. | Zrealizowane. Test różnic upraw, braków i odcięcia czasowego. Cechy ze źródeł na żywo i runtime reguł. |
| Opis 3.3, 4.1 | Zapis lub druk raportu, przykłady wygenerowane przez prototyp. Test eksportu. | Zrealizowane. Dwa PDF i eksport przeglądarkowy zweryfikowany w E2E. |
| Opis 4.1, 4.3, regulamin §2 i §5 | Zespół, tytuł i opis, prywatny link oraz dostęp jury według HackTribe. | Kod i materiały przesłano do zweryfikowanego prywatnego repozytorium. Uprawnienia jury i wysłanie formularza pozostają czynnościami w HackTribe. |
| Opis 4.1–4.2, 5.1, 5.3, 5.5 | README, uruchomienie, funkcje, architektura, źródła, zakresy i daty pobrania, licencje, AI, ograniczenia, walidacja, skalowanie, koszty. | Zrealizowane. README, rejestry DATA_*, COMPONENTS.tsv, rzeczywiste pomiary, manifest i weryfikacja. |
| Opis 4.1 | PDF do 10 slajdów, film do 3 minut, prototyp dostępny z URL lub instrukcji. | Zrealizowane lokalnie. PDF 8 slajdów, MP4 poniżej 3 minut, prototyp oraz instrukcja. Adres publiczny opcjonalny. |
| Opis 5.2, regulamin §2.10 i §5 | Dane bezpłatne i legalne, warunki użycia zewnętrznych elementów i przekazania praw do własnych elementów. | Warunki i atrybucje opisane w DATA_LICENSES.md, w tym warunki dla ewentualnego wdrożenia komercyjnego. |
| Opis 5.6 | Bezpieczeństwo prototypu i minimalizacja danych osobowych. | Zrealizowane w zakresie prototypu. Test nieprawidłowych wejść, limitów, uprawnień URL i trwałego cache. |
| Opis 6 | Test bieżący i historyczny, dowolne regiony i działki, prezentacja 1–3 działek jury. | Zrealizowane dla trzech regionów. Próba na działkach i danych referencyjnych jury pozostaje etapem oceny. |
| Opis 7 | Wartość 25%, dane 25%, innowacja 20%, prostota 15%, prototyp 15%. 30 s to preferencja, mierzona osobno na zimno i ciepło. | Przebiegi na zimno i ciepło zapisane w live-verification.json. Wyniki zależą od dostępności danych. Brak twardego limitu w regulaminie; analiza i budżet 24 s opisane w [LONG_RUNNING.md](LONG_RUNNING.md), postęp na żywo przez WebSocket. |
| Regulamin §2, §3, §5–7 | Rejestracja 1–6 osób, upoważnione zgłoszenie, terminy, finał 2–3 min plus do 2 min pytań, prawa zespołu, zgody indywidualne. | Czynności zespołu |

## Wymagania rozszerzone z instrukcji projektu

| Punkt | Implementacja i test | Status |
|---|---|---|
| 2, 7. Formularz, mapa, import, postęp i dostępność | Angular, MapLibre GL, pola oznaczone etykietami, błędy statusowe, responsywność, test E2E. | Działa w uruchomionych przeglądarkach. |
| 3.1. Pełne ID, numer i obręb, punkt, WKT/WKB | geo.py, testy geometrii i check_live.py. Krajowy GeoParquet GUGiK / EGiB z lokalnym indeksem DuckDB (parcels_data.py, parcels_index.py). ULDK i WFS jako opcje. | Zrealizowane na GeoParquet. ULDK dostępny za flagą WODO_PARCEL_SOURCE=uldk. Szczegóły w PARCELS_DATA.md. |
| 3.2–3.3. IMGW, odniesienie historyczne i licencja Open-Meteo | weather.py, żądania synop/meteo/hydro i archiwum stacji. NASA POWER stanowi główne źródło. | Zrealizowane dla pogody. Prognoza jest poza bieżącym raportem. |
| 3.4. STAC, COG, SCL i sezonowe porównania | spatial.py, Earth Search i Planetary Computer, źródła pasm w manifeście. | Zrealizowane. Zasięg scen zależy od daty i zachmurzenia. |
| 3.5. Gleba bez zależności od REST SoilGrids | WCS, predykcja retencji przy 33/1500 kPa, warstwy, testy braku danych. | Zrealizowane dla pojemności. Tekstury i węgla organicznego nie modelujemy. |
| 3.6. Teren, użytkowanie, hydrologia | Nachylenie, pokrycie, odległość do stałej wody i wodowskaz. | Opisano ograniczenia rowów i cieków poniżej rozdzielczości, osi spływu i pokrycia z 2021 r. |
| 4. Historyczne zapytanie i stan dostępny w dniu | science.py, test przyszłej obserwacji, ruchome tło i oddzielne daty źródeł. | Zrealizowane. Zakres historycznych scen jest osobny. |
| 5. FAO-56, Kc, TAW/RAW, bilans, rekomendacje i niepewność | Testy przykładów FAO, bilansu, braku danych, małych działek i nieużytku. | Bilans przesiewowy; brak kalibracji polowej i hydraulicznych zaleceń precyzyjnych. |
| 6. Wyjaśnienia, scenariusz i priorytety | Dlaczego, okresy historyczne, mapa wody i porównanie z dodatkowym opadem. | Zrealizowane dla efektu dodatkowej wody. Scenariusze zmian materii organicznej i międzyplonów bez estymacji ilościowej. |
| 8–12. Start, źródła, kontrola integralności, tempo, API i bezpieczeństwo | Compose, OpenAPI, scripts/check_live.py, scripts/cache_status.py, test zakresów i danych wejściowych. | Zrealizowane dla lokalnego prototypu. |
| 13. Testy i walidacja | test_wodo.py, check_live.py, frontend/e2e/smoke.mjs oraz VERIFICATION.md. | Wyniki i braki sprzętowe w weryfikacji. |
| 14. Paczka zgłoszeniowa | Raporty, slajdy, wideo, skrypt, prywatne repo, README, manifest i instrukcja. | Materiały lokalne i repo. Zgłoszenie na koncie zespołu poza prototypem. |
