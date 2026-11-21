# Pulpit „Moje pola” — plan wdrożenia (frontend + backend)

Status: propozycja do uzgodnienia · Wariant C z porównania układów, po wdrożeniu wariantu A.

## 1. Cel i zasady

Użytkownik zapisuje **pola** i widzi na jednym ekranie ich stan. Pole to nazwany obszar, który można zdefiniować na trzy sposoby i dalej rozbudowywać o własne dane. Paszport przestaje być osobną listą: jest zakładką **jednego wybranego pola**.

- Pole = zbiór **części**: działki EGiB (po numerach lub kliknięciu) i/lub narysowane/zaimportowane wielokąty. Jedno pole może mieć kilka działek.
- Do pola dopinamy: deklaracje rolnika (uprawa, siew, nawadnianie…), strefy problemowe, notatki, zdjęcia (później), historię analiz.
- Logika biznesowa zostaje w backendzie (zasada z `AGENTS.md`). Frontend tylko wyświetla.
- Bez kont w pierwszej wersji (patrz §3.2), ale z prawdziwym zapisem po stronie serwera.

## 2. Model danych

```
workspace   id, secret_hash, created_at
field       id, workspace_id, name, color, crop, notes, tags[], archived,
            geometry (GeoJSON MultiPolygon, suma części), area_ha, bbox, created_at, updated_at
field_part  id, field_id, kind: parcel | drawn | imported,
            parcel_id (EGiB, dla kind=parcel), geometry, area_ha, label
field_attribute  id, field_id, key (np. current_crop, sowing_date, irrigation_events),
            value JSON, valid_from, source: declared | derived, updated_at
field_zone  id, field_id, geometry (punkt/wielokąt), type, observed_on, description
field_note  id, field_id, date, text, kind: observation | action | other
field_analysis  id, field_id, analysis_id, as_of, risk, confidence, created_at   -- migawka do pulpitu
```

Klucze `field_attribute` biorą się z istniejącego katalogu `docs/paszport_pola_15_danych_od_rolnika.csv` i `GET /api/passport/questions` (jedno źródło prawdy dla pytań).

Magazyn: osobny plik SQLite (`fields.sqlite`, obok cache z `wodo/store.py`), migracje jako numerowane skrypty SQL. Geometrie jako GeoJSON w tekście + kolumny bbox (wyszukiwanie przestrzenne nie jest potrzebne przy skali jednego użytkownika).

## 3. Backend

### 3.1 Struktura
Nowy pakiet `backend/wodo/fields/` (`models.py`, `repo.py`, `service.py`, `router.py`) podpięty przez `APIRouter` w `main.py`. `main.py` ma już ~490 linii, więc nie dokładamy tam endpointów.

### 3.2 Tożsamość bez kont
- `POST /api/workspaces` zwraca `{id, key}`. Klucz (losowy, długi) trafia do `localStorage`, serwer trzyma tylko hash.
- Każde żądanie niesie nagłówek `X-Workspace-Key`; brak lub błąd = 401. Zapytania zawsze filtrowane po `workspace_id`.
- Odzyskiwanie: eksport/import całego obszaru roboczego (GeoJSON + JSON) i opcjonalny „link do przeniesienia na inne urządzenie”.
- Konta (e-mail/OAuth) to osobny, późniejszy etap; model danych jest na to gotowy (`workspace` → `user`).

### 3.3 Endpointy

| Metoda i ścieżka | Zadanie |
|---|---|
| `POST /api/workspaces` | Utworzenie obszaru roboczego |
| `POST /api/fields/resolve` | **Podgląd bez zapisu**: wejście = lista numerów, lista ID lub geometria; wynik = rozpoznane części, suma geometrii, powierzchnia, **nierozpoznane** i **niejednoznaczne** numery, ostrzeżenia |
| `GET/POST /api/fields` | Lista i utworzenie pola (części w treści) |
| `GET/PATCH/DELETE /api/fields/{id}` | Szczegóły, zmiana nazwy/koloru/uprawy, archiwizacja |
| `PUT /api/fields/{id}/parts` | Zamiana zestawu części (przelicza sumę i powierzchnię) |
| `GET/PUT /api/fields/{id}/attributes` | Deklaracje rolnika |
| `GET/POST/PATCH/DELETE /api/fields/{id}/zones` | Strefy problemowe |
| `GET/POST/PATCH/DELETE /api/fields/{id}/notes` | Notatki i działania |
| `POST /api/fields/{id}/analysis` | Analiza na geometrii pola; zapis migawki do `field_analysis` |
| `GET /api/fields/{id}/passport` | Paszport zbudowany z geometrii pola + zapisanych atrybutów (bez ręcznego wpisywania za każdym razem) |
| `GET /api/fields/summary` | Dane pulpitu: liczba pól, status każdego (ryzyko, data ostatniej analizy, czy nieaktualna), „wymaga uwagi” |
| `GET /api/fields/export`, `POST /api/fields/import` | Kopia zapasowa i przenoszenie |

### 3.4 Zasady i limity
- Numery działek rozstrzyga istniejące `lookup()` / `by_point()` z `wodo/parcels_*`. Wiele numerów = wiele wywołań; limit np. **50 części na pole**.
- Suma geometrii: Shapely `unary_union` w EPSG:2180, powierzchnia liczona tam, a nie w WGS84. Części rozłączne są dozwolone (pole z dwóch oddalonych działek) z ostrzeżeniem o odległości.
- Analiza używa istniejącej ścieżki z `geojson`. Jeśli suma przekracza limit „analizowalności” z `wodo/geo.py`, w pierwszej wersji zwracamy ostrzeżenie i proponujemy analizę części osobno; agregacja wyników po częściach (średnia ważona powierzchnią) to etap późniejszy.
- Odświeżenie wielu pól naraz idzie przez istniejącą kolejkę/sloty analiz (por. `docs/LONG_RUNNING.md`), z limitem równoległości; to nie może blokować pozostałych użytkowników.
- Dane lokalizacyjne rolnika są danymi wrażliwymi: brak logowania treści geometrii, kasowanie na żądanie (`DELETE` usuwa też migawki), retencja nieużywanych obszarów roboczych (np. 12 miesięcy).

### 3.5 Testy backendu
Pytest: resolve (numery poprawne/błędne/niejednoznaczne), suma części, autoryzacja kluczem, izolacja obszarów roboczych, migawki analiz, limity, eksport/import w obie strony.

## 4. Frontend

### 4.1 Trasy i nawigacja
- `/` → **Pulpit** (przy pustej liście: zachęta „Dodaj pierwsze pole”), `/pola/nowe` → kreator, `/pola/:id` → szczegóły pola, `/analiza` → obecny widok analizy (z `?pole=:id` wypełnia dane).
- Nawigacja: **Pulpit · Analiza · Metody**. Zakładka „Paszporty pól” znika; paszport jest w szczegółach pola.
- Stare linki `/dzialka/:id…` zostają i działają jak dziś.

### 4.2 Struktura kodu (zgodnie z `FRONTEND_GUIDE_LLM.md`)
```
core/api/        types.ts + fields w ApiService (jedyne miejsce HTTP), nagłówek klucza przez interceptor
core/state/      fields.store.ts (lista, wybrane pole, podsumowanie), workspace.store.ts (klucz w localStorage)
shared/ui/       status-chip, field-card, tag-input
features/fields/ dashboard/, builder/, detail/ (zakładki: Przegląd, Mapa, Dane, Strefy i notatki, Analizy, Paszport)
```
Mapa wielu pól: rozszerzenie `shared/map/wodo-map` o wejście `fields` (kolory wg ryzyka) i zdarzenie `fieldClicked`. Mapa dalej nie woła API.

### 4.3 Ekrany
1. **Pulpit** — pasek KPI (liczba pól, wymagają uwagi, najstarsza analiza), lista kart pól z kolorem i tekstem ryzyka (kolor + ikona + tekst), mapa wszystkich pól jako druga zakładka na telefonie, obok listy na desktopie. Filtry/sortowanie: ryzyko, nazwa, nieaktualne. Akcja „Odśwież analizy”.
2. **Kreator pola** — nazwa, kolor, uprawa; trzy sposoby dodawania części, które można łączyć:
   - **Numery działek**: pole tekstowe (po jednym w wierszu lub po przecinku, wklejanie z arkusza) → natychmiast `resolve` → lista z zielonym/czerwonym stanem każdego numeru i wyborem przy niejednoznacznych;
   - **Klik na mapie**: tryb „dodawaj działki” (kolejne kliknięcia dopisują/odejmują działki);
   - **Rysowanie / GeoJSON**: Terra Draw i import pliku, jak dziś.
   Podgląd sumy na mapie i powierzchnia na żywo; zapis dopiero po zatwierdzeniu.
3. **Szczegóły pola** — nagłówek ze statusem i akcją „Analizuj”; zakładki: Przegląd (ostatni raport), Mapa (części, strefy), Dane (deklaracje z formularza paszportu, zapisywane przy polu), Strefy i notatki (oś czasu), Analizy (historia), Paszport (jak dziś, ale z danych pola).

### 4.4 Telefon i desktop
Telefon: karty jedna pod drugą, przycisk „Dodaj pole” przyklejony nad dolną nawigacją, kreator jako pełnoekranowe kroki. Desktop: lista + mapa obok siebie, kreator jako panel boczny nad mapą.

### 4.5 Testy frontendu
Vitest: `fields.store`, parser listy numerów, mapowanie ryzyka na status. Playwright: dodanie pola z numerów, odświeżenie strony (pole zostaje), usunięcie.

## 5. Etapy

| Etap | Zakres | Wynik do pokazania |
|---|---|---|
| 0. Uzgodnienia | Decyzje z §7, aktualizacja `AGENTS.md` o nowy pakiet | Zatwierdzony zakres |
| 1. Szkielet | Backend: workspace, `fields`, `parts`, `resolve`, SQLite + testy. Front: store, trasa `/pola/nowe` z numerami działek | Zapis pola z numerów i odczyt po odświeżeniu |
| 2. Pulpit | `summary`, lista kart, mapa pól, statusy | Ekran „Moje pola” |
| 3. Dane pola | Atrybuty, strefy, notatki; zakładki szczegółów; kreator: klik i rysowanie | Pole z własnymi danymi |
| 4. Analiza i paszport | Analiza z pola + migawki, paszport z danych pola, usunięcie osobnej listy paszportów | Paszport jako widok pola |
| 5. Utrwalenie | Eksport/import, kopia zapasowa, odświeżanie wielu pól, retencja i kasowanie danych | Gotowe do pokazu i wdrożenia |

Etapy 1–2 dają użyteczny produkt same w sobie; 3–5 można przestawiać zależnie od terminu.

## 6. Ryzyka

- **Kolizja z równoległymi pracami** nad `backend/wodo/analysis.py`, `passport.py` i `core/api/*` — nowe moduły w osobnych plikach, wspólne tylko wywołania istniejących funkcji; zmiany w `ApiService` w małych, osobnych commitach.
- **Duże pola z wielu działek** przekraczają limit analizy — jawne ostrzeżenie w UI, analiza części jako obejście, agregacja później.
- **Utrata klucza** = utrata dostępu do pól bez kont — eksport/import i czytelna informacja przy pierwszym zapisie.
- **Dane lokalizacyjne** — minimalizacja, kasowanie na żądanie, bez publicznych linków do pól.
- **Wydajność listy statusów** — `summary` czyta migawki z bazy, nie uruchamia analiz.

## 7. Decyzje do podjęcia przed startem

1. Czy pierwsza wersja ma być bez kont (klucz w przeglądarce), czy od razu z logowaniem?
2. Czy pole może łączyć działki rozłączne (oddalone), czy tylko sąsiadujące?
3. Czy pulpit ma być stroną startową (`/`), a obecna analiza przejść na `/analiza`?
4. Jakie dane pola są obowiązkowe przy tworzeniu: tylko nazwa i części, czy też uprawa?
5. Czy zdjęcia/załączniki wchodzą w zakres (wymaga magazynu plików), czy zostają na później?
