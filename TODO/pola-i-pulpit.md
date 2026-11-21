# TODO — pulpit „Moje pola”

- [ ] **Agregacja analizy po częściach** — gdy suma działek przekracza limit „analizowalności” (`wodo/geo.py`), analizować części osobno i łączyć wynik średnią ważoną powierzchnią. Priorytet: P1. Właściciel: —.
- [ ] **Zdjęcia i załączniki przy polu** — wymaga magazynu plików, limitów i usuwania wraz z kontem. Priorytet: P2. Właściciel: —.
- [ ] **Zadania z zaleceń raportu** — przycisk „Dodaj do zadań” przy zaleceniu (`recommendations[]`) z terminem z pola `when`. Priorytet: P1. Właściciel: —.
- [ ] **Tagi i grupowanie pól** (gospodarstwo, sezon, uprawa) oraz filtrowanie na pulpicie. Priorytet: P2. Właściciel: —.
- [ ] **Porównanie pól** — dwa lub więcej pól obok siebie (bilans, ryzyko, NDMI). Priorytet: P2. Właściciel: —.
- [ ] **Historia sezonów pola** — uprawa, siew i wynik per sezon; podstawa do płodozmianu. Priorytet: P2. Właściciel: —.
- [ ] **Import pól z innych źródeł** — Shapefile/GML z ARiMR/EGiB, wymaga konwersji układów (EPSG:2180 ↔ 4326). Priorytet: P2. Właściciel: —.
- [ ] **Udostępnianie pola do odczytu** (np. doradcy) przez link z wygasaniem — dopiero po decyzji o prywatności. Priorytet: P2. Właściciel: —.
- [ ] **Współdzielone pola i role w gospodarstwie** — wymaga modelu zespołu. Priorytet: —. Właściciel: —.

## Braki backendu zauważone przy pulpicie „Moje pola” (wersja okrojona, localStorage)

- [ ] **Lista „wymaga uwagi” z backendu** — dziś front tylko filtruje sygnały raportu (`metrics.risk`, `recent.dry_spell_days >= 7`, `recent.crop_balance_mm < 0`); progi są stałymi we froncie (`fields.store.ts`). Backend powinien zwracać gotową flagę/powód. Priorytet: P1. Właściciel: —.
- [ ] **Status pola bez ponownej analizy** — brak lekkiego endpointu „ostatni stan działki” (bez uruchamiania analizy); front pamięta tylko raporty uruchomione w tej przeglądarce. Priorytet: P1. Właściciel: —.
- [ ] **Jednoznaczny kod odpowiedzi wyszukiwania działek** — rozpoznanie numeru opiera się na pustej liście lub HTTP 404/422 z `/api/parcels/search`; brak odrębnego pola „niejednoznaczny”/„nie znaleziono”. Priorytet: P2. Właściciel: —.
- [ ] **Zbiorcze wyszukiwanie wielu numerów** — lista numerów to dziś N osobnych zapytań (po 4 równolegle, limit 40). Priorytet: P2. Właściciel: —.
- [ ] **Przycisk „Zapisz jako pole” w widoku raportu** — wymaga zmiany w `features/analysis`; na razie jest na pulpicie (bieżąca działka). Priorytet: P2. Właściciel: —.
- [ ] **Uprawa pola jako domyślna w formularzu analizy** — wymaga zmiany w `features/analysis`. Priorytet: P2. Właściciel: —.
