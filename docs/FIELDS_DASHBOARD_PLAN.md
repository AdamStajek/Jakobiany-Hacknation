# Pulpit „Moje pola” — plan wdrożenia (frontend + backend)

Status: propozycja do uzgodnienia · Wariant C z porównania układów, po wdrożeniu wariantu A.

## 1. Cel i zasady

Zalogowany użytkownik zapisuje **pola**, prowadzi na nich dane i dostaje **powiadomienia, gdy na polu trzeba coś zrobić**. Pole to nazwany obszar, który można zdefiniować na trzy sposoby i dalej rozbudowywać o własne dane. Paszport przestaje być osobną listą: jest zakładką **jednego wybranego pola**.

**Logowanie jest opcjonalne.** Rdzeń aplikacji działa bez konta, a konto dokłada funkcje. **Konta zakładamy my** (na start: `user/user` i `admin/admin`, patrz §3.2); samodzielna rejestracja nie wchodzi w pierwszą wersję.

| | Gość (bez logowania) | Zalogowany |
|---|---|---|
| Wyszukanie i wybór działki, mapa | tak | tak |
| Analiza, raport, PDF/JSON, link do raportu | tak | tak |
| Paszport jednorazowy (formularz) | tak | tak |
| Jak to działa, źródła, ograniczenia | tak | tak |
| Pola tymczasowe w przeglądarce (bez synchronizacji, do importu po zalogowaniu) | tak | — |
| Zapisane na serwerze pola i pulpit | nie | tak |
| Dane pola: deklaracje, strefy, notatki, historia analiz | nie | tak |
| Zadania z terminem i powiadomienia | nie | tak |
| Dostęp z wielu urządzeń, eksport i kasowanie danych | nie | tak |
| Zakładanie kont i podgląd użytkowników | nie | tylko rola `admin` |

Zasady:
- Żaden dotychczasowy przepływ nie wymaga logowania. Brak konta nigdy nie blokuje analizy.
- Przy próbie zapisu (np. „Zapisz jako pole” po analizie) pokazujemy zaproszenie do zalogowania i **wracamy dokładnie tam, gdzie użytkownik był**, ze stanem (działka, raport) zachowanym.
- Pole = zbiór **części**: działki EGiB (po numerach lub kliknięciu) i/lub narysowane/zaimportowane wielokąty. Jedno pole może mieć kilka działek.
- Logika biznesowa (ryzyko, reguły powiadomień) jest w backendzie; frontend tylko wyświetla.

## 2. Model danych

```
user              id, username (unikalny), password_hash, role: user | admin, display_name,
                  email? (opcjonalny, tylko do powiadomień e-mail), must_change_password,
                  created_at, last_login_at, disabled_at, deleted_at
session           id, user_id, token_hash, created_at, expires_at, user_agent
field             id, user_id, name, color, crop, notes, tags[], archived,
                  geometry (GeoJSON MultiPolygon, suma części), area_ha, bbox, created_at, updated_at
field_part        id, field_id, kind: parcel | drawn | imported, parcel_id?, geometry, area_ha, label
field_attribute   id, field_id, key, value JSON, valid_from, source: declared | derived, updated_at
field_zone        id, field_id, geometry (punkt/wielokąt), type, observed_on, description
field_note        id, field_id, date, text, kind: observation | action | other
field_task        id, field_id, title, due_on?, status: open | done | dismissed,
                  source: user | recommendation, recommendation_key?, created_at, done_at
field_analysis    id, field_id, analysis_id, as_of, risk, confidence, created_at   -- migawka dla pulpitu
notification      id, user_id, field_id?, kind, title, body, action_url, dedupe_key,
                  created_at, read_at?, delivered_channels[]
notification_pref user_id, channel: inapp | email | push, kinds[], digest: off | daily | weekly,
                  quiet_hours, enabled
push_subscription id, user_id, endpoint, keys, created_at                       -- Web Push (etap późniejszy)
```

Klucze `field_attribute` pochodzą z `docs/paszport_pola_15_danych_od_rolnika.csv` i `GET /api/passport/questions` (jedno źródło prawdy dla pytań).

Magazyn: osobny plik SQLite (`app.sqlite`, obok cache z `wodo/store.py`), migracje jako numerowane skrypty SQL. Geometrie jako GeoJSON w tekście + kolumny bbox (przy skali jednego użytkownika wyszukiwanie przestrzenne nie jest potrzebne).

## 3. Backend

### 3.1 Struktura
Nowe pakiety: `backend/wodo/auth/` (logowanie, sesje), `backend/wodo/fields/` (pola i ich dane), `backend/wodo/notify/` (reguły, kolejka, wysyłka). Każdy z własnym `APIRouter` podpiętym w `main.py` (ma już ~490 linii, nie dokładamy tam endpointów).

### 3.2 Logowanie (opcjonalne, konta zakładamy my)
- **Login i hasło.** Na start nie ma rejestracji ani wysyłki e-maili, więc odpada link na pocztę i SMTP z pierwszej wersji. Hasła w bazie wyłącznie jako hash (`hashlib.scrypt` z biblioteki standardowej, osobna sól na użytkownika; bez nowych zależności).
- **Konta startowe** zakładane skryptem inicjalizującym przy pierwszym uruchomieniu (`user/user`, rola `user`; `admin/admin`, rola `admin`). To dane wyłącznie na potrzeby startu i pokazu:
  - skrypt nie nadpisuje istniejących kont i bierze nazwy/hasła ze zmiennych środowiskowych (`WODO_SEED_USERS`), a domyślne `user/user` i `admin/admin` stosuje tylko, gdy zmiennej nie ma i serwer działa w trybie deweloperskim/demo,
  - oba konta mają `must_change_password`: przy pierwszym logowaniu UI wymusza nowe hasło **dla `admin`**; dla `user` pozostaje decyzja zespołu (patrz §7),
  - przed publicznym wdrożeniem hasła domyślne muszą zniknąć (punkt kontrolny w etapie 8; serwer w trybie produkcyjnym odmawia startu z domyślnym hasłem admina).
- `POST /api/auth/login {username, password}` → sesja: ciasteczko **HttpOnly, Secure, SameSite=Lax**, sesja po stronie serwera (w bazie tylko hash), rotacja przy logowaniu, wygasanie po 30 dniach bezczynności. `POST /api/auth/logout`, `GET /api/me`, `POST /api/me/password`.
- Ochrona: limity prób logowania na użytkownika i IP z rosnącym opóźnieniem, jednakowa odpowiedź dla błędnego loginu i hasła, nagłówek `X-Requested-With` dla żądań zmieniających stan, ten sam origin (proxy), brak CORS.
- **Rola `admin`:** `GET/POST/PATCH /api/admin/users` (zakładanie konta, reset hasła, wyłączenie konta), lista kont. Bez dostępu do geometrii i danych pól innych użytkowników. Prosty ekran w aplikacji (`/konto/uzytkownicy`).
- Usunięcie danych: `DELETE /api/me` usuwa konto, pola, migawki i powiadomienia (admin może zrobić to na prośbę użytkownika).
- Później (poza pierwszą wersją): samodzielna rejestracja i odzyskiwanie hasła e-mailem (logowanie przez zewnętrznych dostawców odpuszczamy). Model `user` jest na to gotowy.
- **Zależność od ciasteczka tylko dla endpointów kont i pól.** Endpointy rdzenia (`/api/parcels/*`, `/api/analysis*`, `/api/passport*`, `/api/crops`, `/api/health`) pozostają publiczne, bez zmian kontraktu.

### 3.3 Endpointy pól (wymagają sesji)

| Metoda i ścieżka | Zadanie |
|---|---|
| `POST /api/fields/resolve` | **Podgląd bez zapisu**: wejście = lista numerów, ID lub geometria; wynik = rozpoznane części, suma, powierzchnia, **nierozpoznane** i **niejednoznaczne** numery, ostrzeżenia. Dostępny też dla gościa (to tylko wyszukiwanie działek) |
| `GET/POST /api/fields` | Lista i utworzenie pola (części w treści) |
| `GET/PATCH/DELETE /api/fields/{id}` | Szczegóły, zmiana nazwy/koloru/uprawy, archiwizacja |
| `PUT /api/fields/{id}/parts` | Zamiana zestawu części (przelicza sumę i powierzchnię) |
| `GET/PUT /api/fields/{id}/attributes` | Deklaracje rolnika |
| `GET/POST/PATCH/DELETE /api/fields/{id}/zones`, `/notes` | Strefy problemowe i notatki |
| `GET/POST/PATCH/DELETE /api/fields/{id}/tasks` | Zadania (z terminem), także tworzone z zaleceń raportu |
| `POST /api/fields/{id}/analysis` | Analiza na geometrii pola; zapis migawki do `field_analysis` |
| `GET /api/fields/{id}/passport` | Paszport z geometrii pola i zapisanych atrybutów |
| `GET /api/fields/summary` | Dane pulpitu: status każdego pola (ryzyko, data analizy, nieaktualne), liczba zadań do zrobienia, „wymaga uwagi” |
| `GET /api/fields/export`, `POST /api/fields/import` | Kopia zapasowa i przenoszenie (w tym import pól z przeglądarki gościa) |

### 3.4 Powiadomienia
Cel: gdy na polu **jest wymagana akcja**, użytkownik się o tym dowiaduje, bez wchodzenia do aplikacji. Pierwsza wersja opiera się wyłącznie na **sygnałach, które analiza już liczy**; wszystko, czego brakuje, jest w katalogu [`TODO/`](../TODO/README.md) (`TODO/powiadomienia.md`).

**Sygnały dostępne dziś w raporcie** (`report.metrics`, `recommendations`, `confidence`, `missing`):

| Sygnał | Skąd | Użycie w powiadomieniu |
|---|---|---|
| `metrics.risk` (m.in. „Podwyższone”, „Sygnał niedoboru”, „Niepewne”) | `wodo/science.py` | Zmiana poziomu względem poprzedniej migawki |
| `recent.dry_spell_days`, `recent.crop_balance_mm`, `rain_anomaly_mm` | `science.py` | Próg długiej suszy / ujemnego bilansu |
| `root.initially_dry/wet.depletion_mm` względem `raw_mm` | `science.py` | Zapas wody przy korzeniach poniżej progu RAW |
| `recommendations[].when`, `.group` | `wodo/analysis.py`, `farmer_report.py` | Zalecenie z oknem czasowym staje się aktualne |
| `satellite_comparison` (NDVI/NDMI vs sezon) | `analysis.py` | Wyraźne odchylenie od mediany sezonowej |
| `confidence`, `missing` | `analysis.py` | „Brakuje danych, żeby ocenić pole” |
| Wodowskaz IMGW (`gauge_cm`) | źródło `gauge` | Tylko jako informacja w treści |

**Zdarzenia pierwszej wersji:** (1) wzrost poziomu ryzyka pola, (2) przekroczenie progu suszy lub bilansu, (3) termin zadania użytkownika, (4) nieaktualna analiza w sezonie, (5) brak danych wpływających na wynik.

**Mechanizm:**
1. **Zadanie okresowe** (raz na dobę, w nocy): odświeża analizy pól użytkowników z włączonymi powiadomieniami przez istniejącą kolejkę/sloty (por. `docs/LONG_RUNNING.md`), z limitem pól na użytkownika (np. 20) i na przebieg.
2. **Silnik reguł** porównuje nowy stan z poprzednią migawką i tworzy `notification` z `dedupe_key` (to samo zdarzenie nie powtarza się codziennie). Każda reguła zwraca tekst „dlaczego” i link do pola.
3. **Dostarczanie** w pierwszej wersji **tylko w aplikacji** (dzwonek i lista). E-mail (wymaga adresu i SMTP) i Web Push (PWA, VAPID) to etap późniejszy, z zgodą per kanał, podsumowaniami i godzinami ciszy.

Endpointy: `GET /api/notifications`, `POST /api/notifications/{id}/read`, `POST /api/notifications/read-all`, `GET/PUT /api/notification-prefs`; później `POST/DELETE /api/push-subscriptions`.

### 3.5 Zasady i limity
- Numery działek rozstrzyga istniejące `lookup()` / `by_point()`; limit np. **50 części na pole**.
- Suma geometrii: Shapely `unary_union` w EPSG:2180, powierzchnia liczona tam. Części rozłączne dozwolone, z ostrzeżeniem o odległości.
- Analiza używa istniejącej ścieżki z `geojson`. Jeśli suma przekracza limit „analizowalności” z `wodo/geo.py`, w pierwszej wersji zwracamy ostrzeżenie i proponujemy analizę części osobno; agregacja po częściach (średnia ważona powierzchnią) to etap późniejszy.
- Dane lokalizacyjne (i opcjonalny e-mail) są danymi osobowymi: zgoda na powiadomienia per kanał, kasowanie konta usuwa wszystko, bez logowania treści geometrii, retencja nieaktywnych kont (np. 12 miesięcy, z ostrzeżeniem e-mailem), brak publicznych linków do pól.

### 3.6 Testy backendu
Pytest: logowanie (poprawne, złe hasło, blokada po wielu próbach, wygasła sesja, zmiana hasła, hasło tylko jako hash), role (admin zakłada konta, user nie), seed kont (nie nadpisuje, odmowa domyślnego hasła w trybie produkcyjnym), izolacja danych między użytkownikami, rdzeń nadal działa bez sesji, resolve, suma części, migawki, reguły powiadomień (deduplikacja, progi), preferencje i godziny ciszy, kasowanie konta.

## 4. Frontend

### 4.1 Trasy i nawigacja
- Gość: `/` = **analiza** (jak dziś). Zalogowany: `/` przekierowuje na **pulpit** `/pola`.
- Trasy: `/pola` (pulpit), `/pola/nowe` (kreator), `/pola/:id` (szczegóły), `/konto` (profil, hasło, powiadomienia, eksport, usunięcie konta), `/konto/uzytkownicy` (tylko admin), `/zaloguj`, `/analiza`, `/metody`. Stare `/dzialka/:id…` działają bez zmian.
- Nawigacja: **Analiza · Moje pola · Metody**. „Moje pola” dla gościa prowadzi do ekranu z opisem korzyści i przyciskiem logowania (nie do ślepej uliczki). Menu konta w pasku bocznym (desktop) i w górnym pasku (telefon); dzwonek powiadomień z licznikiem po zalogowaniu.
- Strażnik tras tylko dla `/pola*` i `/konto`; reszta zawsze dostępna.

### 4.2 Struktura kodu (zgodnie z `FRONTEND_GUIDE_LLM.md`)
```
core/api/        typy + metody w ApiService (jedyne miejsce HTTP); interceptor 401 → stan „gość”
core/state/      auth.store.ts (sesja z GET /api/me), fields.store.ts, notifications.store.ts
shared/ui/       status-chip, field-card, tag-input, login-prompt (zaproszenie do zalogowania)
features/auth/   login-page (login i hasło, zmiana hasła przy pierwszym logowaniu)
features/fields/ dashboard/, builder/, detail/ (zakładki: Przegląd, Mapa, Dane, Strefy i notatki, Zadania, Analizy, Paszport)
features/account/ profil, powiadomienia (kategorie, później kanały), eksport, usunięcie konta, użytkownicy (admin)
```
Mapa wielu pól: `shared/map/wodo-map` dostaje wejście `fields` (kolory wg ryzyka) i zdarzenie `fieldClicked`; dalej nie woła API.

### 4.3 Ekrany
1. **Logowanie** — login i hasło, czytelny błąd i informacja o blokadzie po wielu próbach, wymuszona zmiana hasła, powrót na zapamiętany adres (`returnUrl`). Bez rejestracji; wskazówka „konta zakłada zespół”.
2. **Zaproszenie do zalogowania** — w kontekście: po raporcie („Zapisz jako pole i śledź zmiany”), na pustym pulpicie, przy zadaniu. Zawsze z opcją „Kontynuuj bez konta”. Gość może zapisać pole **w przeglądarce** (IndexedDB); po zalogowaniu pojawia się propozycja „Przenieś pola na konto”.
3. **Pulpit** — pasek KPI (liczba pól, wymagają uwagi, zadania do zrobienia), karty pól z kolorem i tekstem ryzyka (kolor + ikona + tekst), mapa wszystkich pól (druga zakładka na telefonie, obok listy na desktopie), filtry i sortowanie, „Odśwież analizy”.
4. **Kreator pola** — nazwa, kolor, uprawa; trzy sposoby dodawania części, łączone:
   - **numery działek**: wklejana lista (po jednym w wierszu lub po przecinku) → natychmiastowy `resolve` z zielonym/czerwonym stanem każdego numeru i wyborem przy niejednoznacznych,
   - **klik na mapie**: tryb „dodawaj działki” (kolejne kliknięcia dopisują/odejmują),
   - **rysowanie / GeoJSON**: Terra Draw i import pliku.
   Podgląd sumy i powierzchnia na żywo, zapis po zatwierdzeniu.
5. **Szczegóły pola** — status i „Analizuj”; Przegląd (ostatni raport), Mapa (części i strefy), Dane (deklaracje, zapisywane przy polu), Strefy i notatki (oś czasu), **Zadania** (termin, ukończenie, tworzenie z zaleceń raportu), Analizy (historia), Paszport.
6. **Powiadomienia** — dzwonek z listą (nieprzeczytane, powód, link do pola i zadania), ustawienia: kategorie zdarzeń; kanały e-mail/push, podsumowania i godziny ciszy dochodzą w etapie 7.
7. **Użytkownicy (admin)** — lista kont, dodanie konta, reset hasła, wyłączenie.

### 4.4 Telefon i desktop
Telefon: karty jedna pod drugą, „Dodaj pole” przyklejone nad dolną nawigacją, kreator jako pełnoekranowe kroki. Desktop: lista i mapa obok siebie, kreator jako panel boczny nad mapą.

### 4.5 Testy frontendu
Vitest: `auth.store` (gość/zalogowany/401), `fields.store`, parser listy numerów, mapowanie ryzyka na status, `returnUrl`. Playwright: analiza bez logowania nadal działa, logowanie linkiem (z podglądem linku w trybie dev), dodanie pola z numerów, odświeżenie strony (pole zostaje), zadanie z terminem, usunięcie konta.

## 5. Etapy

| Etap | Zakres | Wynik do pokazania |
|---|---|---|
| 0. Uzgodnienia | Decyzje z §7, aktualizacja `AGENTS.md` o nowe pakiety | Zatwierdzony zakres |
| 1. Konta | Backend: `auth` (login/hasło, sesje, `me`, zmiana hasła, role, `admin/users`, skrypt zakładania kont startowych), migracje, limity prób. Front: `auth.store`, logowanie, menu konta, zaproszenia, ekran użytkowników | Logowanie jest opcjonalne, rdzeń działa bez niego |
| 2. Pola | `fields`, `parts`, `resolve`, SQLite, kreator z numerami działek, zapis i odczyt po odświeżeniu | Zapis pola z numerów |
| 3. Pulpit | `summary`, karty, mapa pól, statusy | Ekran „Moje pola” |
| 4. Dane pola | Atrybuty, strefy, notatki; zakładki szczegółów; kreator: klik i rysowanie | Pole z własnymi danymi |
| 5. Analiza i paszport | Analiza z pola + migawki, paszport z danych pola, usunięcie osobnej listy paszportów | Paszport jako widok pola |
| 6. Zadania i powiadomienia w aplikacji | `field_task`, silnik reguł na istniejących sygnałach (§3.4), zadanie nocne, dzwonek, ustawienia kategorii | „Na polu X trzeba coś zrobić” widoczne po wejściu |
| 7. E-mail i push | Opcjonalny adres e-mail, SMTP, podsumowania, PWA i Web Push (zakres w `TODO/powiadomienia.md`) | Powiadomienie poza aplikacją |
| 8. Utrwalenie | Eksport/import (w tym przeniesienie pól gościa z przeglądarki), retencja, kasowanie, **usunięcie haseł domyślnych**, przegląd bezpieczeństwa | Gotowe do pokazu i wdrożenia |

Etapy 1–3 dają użyteczny produkt; 6 jest minimum dla obietnicy powiadomień; 7–8 można przestawiać zależnie od terminu.

## 6. Ryzyka

- **Rdzeń nie może zależeć od konta** — testy kontraktowe publicznych endpointów bez sesji, strażnik tras tylko dla `/pola*` i `/konto`.
- **Hasła domyślne `user/user` i `admin/admin`** są znane każdemu, kto czyta repozytorium. Dopuszczalne wyłącznie na lokalnym starcie i w demo bez prawdziwych danych; wymuszona zmiana hasła admina, odmowa startu produkcyjnego z hasłem domyślnym, punkt kontrolny w etapie 8.
- **Brak odzyskiwania hasła** — reset wykonuje admin; do czasu e-maila trzeba to opisać w UI.
- **Obciążenie źródeł danych** przy nocnym odświeżaniu — limity pól, kolejka, cache, rozłożenie w czasie.
- **Fałszywe alarmy** (zmęczenie powiadomieniami) — progi z modelu, deduplikacja, domyślnie tylko w aplikacji, jasne „dlaczego” przy każdym.
- **Kolizja z równoległymi pracami** nad `backend/wodo/analysis.py`, `passport.py` i `core/api/*` — nowe moduły w osobnych plikach, zmiany w `ApiService` w małych, osobnych commitach.
- **Duże pola z wielu działek** przekraczają limit analizy — ostrzeżenie w UI, analiza części jako obejście.
- **Dane osobowe i lokalizacyjne** — zgody, kasowanie konta, minimalizacja, retencja.

## 7. Decyzje

Ustalone:
- Konta zakładamy my; na start `user/user` i `admin/admin`, bez rejestracji i bez e-maili (§3.2).
- Gość może trzymać pola w przeglądarce, z przeniesieniem na konto po zalogowaniu.
- Powiadomienia rozwijamy na sygnałach, które aplikacja już liczy; braki i pomysły zbieramy w `TODO/`.

Do podjęcia przed startem:
1. Czy `user/user` też wymusza zmianę hasła (wygodniejsze demo kontra bezpieczeństwo)?
2. Czy pole może łączyć działki rozłączne, czy tylko sąsiadujące?
3. Czy zdjęcia i załączniki wchodzą w zakres (wymaga magazynu plików)?
4. Czy w pierwszej wersji pole ma ograniczenie liczby na użytkownika (np. 20) ze względu na nocne odświeżanie?
