# Plan: aplikacja „jak dla Mariana” (senior, 70+)

Stan: propozycja do akceptacji (nic jeszcze nie zmieniono w kodzie).
Powiązane: [PLAN_MAPA_I_POLA.md](PLAN_MAPA_I_POLA.md), [FRONTEND_GUIDE_LLM.md](FRONTEND_GUIDE_LLM.md).

## 0. Persona

**Marian, 71 lat, gospodarstwo 18 ha.** Telefon z Androidem, ekran popękany, okulary do czytania w kieszeni. Używa SMS-ów, telefonu i Facebooka. Nie zna słów „raport”, „ET”, „bilans wodny”, „ortofoto”, „segment”, „paszport”. Boi się, że „coś zepsuje” albo „nie wie, co kliknąć”. Wychodzi z aplikacji, gdy coś wyskoczy bez uprzedzenia. Chce wiedzieć jedno: **„Czy mam podlewać? Czy będzie susza na moim polu?”**

Test akceptacji dla całego planu: Marian z telefonu, bez instrukcji, w mniej niż 2 minuty dochodzi od otwarcia aplikacji do odpowiedzi „wody jest dość / za mało” dla swojej działki.

## 1. Wyniki przeglądu aplikacji

Przeanalizowano: powłokę, Analizę (mapa, wybór działki, formularz, raport), Moje pola, Paszport, Eksperymenty, Metody, logowanie, banery. Ocena: 🔴 przeszkadza, 🟠 utrudnia, 🟢 dobrze.

### 1.1 Pierwszy kontakt i nawigacja
- 🔴 Strona startowa to od razu mapa Polski i panel „Dane” z polem na „Numer działki, np. 301103_2.0001.121”. Marian **nie zna numeru ewidencyjnego**. Nie ma czytelnej ścieżki „szukaj po adresie/miejscowości” ani „pokaż, gdzie jestem i wskaż pole”. Jest tylko mała ikona kompasu.
- 🔴 Brak jednego zdania „Do czego służy ta aplikacja i co teraz zrobić”. Nie ma kroków 1-2-3.
- 🟠 Nawigacja: „Analiza / Pola / Eksperymenty / Metody”. Słowa nieczytelne. „Metody” i „Eksperymenty” brzmią naukowo. Cztery równorzędne pozycje, choć 90% ludzi potrzebuje dwóch.
- 🟠 Dolne menu: ikony 20 px, podpis `text-xs` (12 px).
- 🟢 Dolna nawigacja ma 64 px wysokości; link „Przejdź do treści”; focus widoczny.

### 1.2 Tekst i czytelność
- 🔴 36 miejsc z `text-xs` (12 px) i jedno `text-[11px]` w treści pomocniczej (np. „Pola są zapisane na Twoim koncie”, daty raportów, opisy działek). Bazowy rozmiar to 16 px, ale informacje kluczowe są małe i jasnoszare (`text-muted-color`).
- 🔴 Brak ustawienia „większy tekst” w aplikacji. Zależy od ustawień telefonu.
- 🟠 Kontrast szarego tekstu pomocniczego na kremowym tle to granica AA. Dla starszych oczu za mało.
- 🟠 Długie akapity (zgoda na zapis ma 4 zdania w jednym bloku; opisy eksperymentów to ściany tekstu).

### 1.3 Język
- 🔴 Żargon: „Ryzyko niedoboru wody”, „Sygnał niedoboru”, „Niskie w modelu”, „Brak sygnału z opadu i ET”, „ortofotomapa”, „Granice działek (od zbliżenia)”, „Faza uprawy: Początek wzrostu / Pełnia wzrostu”, „Potwierdzam uprawę, jeśli mapa wskazuje inne użytkowanie”, „Co jeśli zatrzymam dodatkowy opad? [mm]”, „Woda z nawadniania w dniu analizy [mm]”, „localStorage”, „Paszport”, „Piksel”, „confidence”.
- 🟠 Skróty i jednostki bez objaśnienia (mm, ha, ET, dz.).
- 🟠 Przyciski niejasne: „Dalej” (dokąd?), „Gotowe” (co zapisze?), „Analizuj gospodarowanie wodą”.

### 1.4 Formularze i błędy
- 🔴 Okno „Dodaj informacje o polu” otwiera się samo i jest długie (patrz [PLAN_MAPA_I_POLA.md](PLAN_MAPA_I_POLA.md), etap D).
- 🔴 Pola `<input type="date">` bez podpowiedzi, na telefonie z małym kalendarzem; „data analizy” wymusza wybór, choć 99% użytkowników chce „dziś”.
- 🟠 Liczby wpisywane w „mm” (nie zna skali: ile to jest 10 mm?). Brak obrazowego odniesienia („tyle, co mocny deszcz”).
- 🟠 Komunikaty błędów techniczne, np. wynik `errorMessage()` z API przekazywany dosłownie.
- 🟠 Brak potwierdzenia przy usuwaniu pola: kosz w karcie usuwa **od razu** (`removed.emit`) bez „Na pewno?” i bez „Cofnij”.

### 1.5 Raport (wynik)
- 🔴 Raport to „dashboard”: karty KPI, wykresy ECharts, tabele, przełącznik prosty/zaawansowany, wiele przycisków (PDF, Paszport, Kopiuj link, Drukuj, JSON). Marian potrzebuje jednego zdania i jednego koloru.
- 🟠 Przycisk „JSON” i „Kopiuj link” są bez podpisu (tylko ikona + `ariaLabel`).
- 🟠 Wykresy bez słownego wniosku nad nimi (są tabele pod wykresem, ale nie zdanie „W tym miesiącu było za sucho”).
- 🟢 Kolor + ikona + tekst dla poziomu ryzyka, skala ryzyka, chip pewności. Tryb „prosty” już istnieje (`ReportMode`).

### 1.6 Zaufanie, wsparcie, błędy
- 🔴 Brak „Pomocy”, numeru kontaktowego, przycisku „Jak to zrobić?” przy trudnych krokach.
- 🟠 Baner zgody używa terminu „localStorage”. Dwa wyskakujące banery (zgoda, „Dodaj do pól”) wchodzą na dół ekranu **nad** dolną nawigację i mapę.
- 🟠 Długa analiza: pasek postępu jest (🟢), ale brak zdania „To potrwa około minuty, nie zamykaj strony”.
- 🟠 Brak stanu „brak internetu”.

### 1.7 Logowanie
- 🟠 Rejestracja i reset hasła wymagają e-maila i maila weryfikacyjnego. Dla Mariana to bariera, ale aplikacja słusznie działa bez konta. Trzeba tylko **nie sugerować, że konto jest potrzebne** i uprościć ścieżkę.
- 🟢 „Bez konta wszystko działa tak samo” jest już w treści propozycji.

### 1.8 Dotyk i ruch
- 🟠 Segmenty u góry (`min-h-9` = 36 px) i przyciski `size="small"` (ok. 32 px) są poniżej zalecanych 48 px dla seniorów.
- 🟠 Zbliżanie mapy na telefonie tylko szczypaniem (bez przycisków +/−, `pointer: fine` ukrywa kontrolki). Senior często nie umie pinch-zoom.
- 🟠 Mapa przechwytuje przewijanie strony.

## 2. Zasady projektowe dla „Mariana”

1. **Jedno główne zadanie na ekran, jeden duży przycisk.**
2. **Słowa ze wsi, nie z laboratorium.** Test: czy sąsiad by tak powiedział?
3. **Najpierw odpowiedź, potem szczegóły** (na żądanie).
4. **Nic nie wyskakuje samo. Nic nie ginie bez „Cofnij”.**
5. **Tekst min. 16 px (informacje ważne 18 px), cele dotykowe min. 48 px, kontrast ≥ 7:1 dla tekstu głównego.**
6. **Każdy krok ma wyjście** („Wstecz”, „Anuluj”, „Zacznij od nowa”).
7. **Zero żargonu bez objaśnienia; liczby z obrazowym odniesieniem.**
8. Zgodnie z AGENTS.md: UI po polsku, dostępność obowiązkowa, logika w backendzie, bez nowych zależności bez uzgodnienia.

## 3. Podział na etapy

### Etap 1. „Szybkie wygrane” (1–2 dni, bez zmian architektury)
- **Rozmiar i kontrast**: podnieść `text-xs` → `text-sm` (14) dla informacji pomocniczych i `text-base` (16) dla treści. Ciemniejszy kolor tekstu pomocniczego (token, nie hex). Usunąć `text-[11px]`.
- **Cele dotykowe**: min. 48 px dla przycisków głównych, segmentów i pozycji dolnej nawigacji; usunąć `size="small"` z głównych akcji.
- **Podpisy**: dolne menu: „Sprawdź pole”, „Moje pola”, „Pomoc” (patrz Etap 3), „Jak to działa”. Podpisy 14 px.
- **Usuwanie pola**: okno potwierdzenia „Usunąć pole „Łąka za stodołą”? [Usuń] [Zostaw]” oraz toast „Usunięto. [Cofnij]” przez 8 s.
- **Banery**: tylko jeden naraz, bez zasłaniania przycisków; zgoda bez słowa „localStorage” („Zapamiętać Twoje pola na tym telefonie? Nikomu ich nie wysyłamy.” + dwa duże przyciski „Tak, zapamiętaj” / „Nie”).
- **Przyciski mapy z podpisami** (Etap A z planu mapy).
- **Przyciski +/− na mapie** zawsze widoczne (także na telefonie).

### Etap 2. Język i teksty (słownik ludzki)
Wprowadzić **jeden słownik tekstów** (`core/` lub `shared/`: plik ze stałymi), żeby zmiany były w jednym miejscu. Propozycje:

| Dziś | Dla Mariana |
|------|-------------|
| Analiza działki | Sprawdź pole |
| Moje pola | Moje pola (bez zmian) |
| Jak to działa / Metody | Jak to działa |
| Eksperymenty | Eksperymenty (nazwa zostaje, decyzja właściciela) |
| Paszport | Karta pola |
| Ryzyko niedoboru wody | Czy polu grozi susza? |
| Niskie w modelu | Woda jest w porządku |
| Podwyższone / Sygnał niedoboru | Może zabraknąć wody |
| Niepewne | Za mało danych, sprawdź w polu |
| Ortofoto | Zdjęcie z satelity |
| Granice działek | Pokaż granice działek |
| Faza uprawy | Etap upraw (np. „po wschodach”) |
| Co jeśli zatrzymam dodatkowy opad [mm] | (usunąć z głównego ekranu; opcja zaawansowana) |
| Woda z nawadniania [mm] | Ile wody dałem z nawadniania (litrów na m²) |
| Analizuj gospodarowanie wodą | Sprawdź wodę na polu |
| Dalej | Dalej: wybierz uprawę |
| Gotowe | Zapisz i wróć |

- Jednostki: „mm” zastąpić „litry na metr kwadratowy (mm)” z odniesieniem „10 mm to mocny letni deszcz”. Wartość przeliczana tylko w opisie, a wysyłana bez zmian (logika w backendzie).
- Każde zdanie ≤ 20 słów; strona bierna do lamusa.
- Do recenzji ze strony KOWR, czy terminologia nie koliduje z oficjalną.

### Etap 3. Ścieżka „Sprawdź pole” w 3 krokach
Przebudowa ekranu startowego (`analysis-page`) pod prowadzenie za rękę, bez usuwania obecnych funkcji dla zaawansowanych.

1. **Krok 1: „Gdzie jest Twoje pole?”** Trzy duże przyciski:
   - **„Jestem na polu”** (używa lokalizacji, centruje mapę, prosi: „Dotknij swojego pola”),
   - **„Wpiszę miejscowość”** (wyszukiwanie po miejscowości/gminie, geokodowanie wymaga uzgodnienia darmowego źródła, patrz „Ryzyka”),
   - **„Mam numer działki”** (dzisiejsze pole).
   - Nad mapą jedno zdanie instrukcji „Dotknij swojego pola na mapie”. Po wyborze: „To jest Twoje pole? [Tak] [Wybierz inne]”.
2. **Krok 2: „Co tam rośnie?”** Duże kafelki z uprawami (kilka najczęstszych, obrazek + nazwa), „Nie wiem / inna”. Data domyślnie „Dziś”. Bez żadnych innych pól.
3. **Krok 3: wynik** (patrz Etap 4).

- Pasek postępu „Krok 2 z 3” na górze, przycisk **Wstecz** zawsze widoczny.
- Zaawansowane (faza uprawy, scenariusz opadu, nawadnianie, strefy) pod przyciskiem „Więcej ustawień”, zwinięte.
- Stan w URL zostaje (obecny mechanizm `/dzialka/:id/analiza/:id`).

### Etap 4. Wynik w jednym zdaniu
- Na górze raportu **wielka karta wniosku**: kolor + ikona + jedno zdanie, np. „Może zabraknąć wody. Przez ostatnie 10 dni nie padało.” oraz „Co zrobić: sprawdź wilgotność gleby w kilku miejscach.” Treść pochodzi z backendu (UI nie przelicza), w UI tylko mapowanie na słownik.
- Domyślnie tryb **prosty**; „Pokaż szczegóły i wykresy” rozwija resztę (jest `ReportMode`).
- Akcje główne: **„Wyślij sobie wynik”** (link + SMS/WhatsApp share przez Web Share API, jeśli dostępne) i **„Pobierz PDF”**. Drukuj, JSON, kopiowanie linku: do menu „Więcej”.
- Wykresy: nad każdym zdanie wniosku („Opady były poniżej normy”).
- Rozmowa o pewności: „Jak bardzo możemy być pewni? Średnio” zamiast samego chipa.

### Etap 5. Pomoc i wsparcie
- Stały przycisk **„Pomoc”** (dolne menu i pasek boczny): krótkie instrukcje „Jak sprawdzić pole” z 3–4 obrazkami/zrzutami, FAQ w 8–10 pytaniach, kontakt (telefon/e-mail do uzgodnienia z KOWR).
- **Podpowiedzi kontekstowe** „?” przy trudnych polach (otwierane dotknięciem, nie najechaniem; 1–2 zdania).
- **Pierwsze uruchomienie**: 3-ekranowe wprowadzenie z przyciskiem „Pomiń” i możliwością powrotu z Pomocy.
- Czytnik ekranu: zachować istniejące `aria-*`; dodać `aria-live` dla zmian kroków.

### Etap 6. Dostępność „na życzenie”
- Przełącznik **„Większy tekst”** (3 stopnie: normalny / duży 125% / bardzo duży 150%) w menu konta i w stopce, zapisywany za zgodą; realizacja przez `font-size` na `html` (rem) i sprawdzenie układów przy 150%.
- Tryb **wysokiego kontrastu** (rozszerzenie `core/theme/`; zasada: tylko `theme.ts` i `AppPreset`, nie zmieniamy `--pw-*`, więc wymaga uzgodnienia).
- Obsługa `prefers-contrast` i `prefers-reduced-motion` (to drugie już jest).
- Opcjonalnie: czytanie na głos wyniku (Web Speech API `speechSynthesis`, darmowe, bez kluczy) przyciskiem „Przeczytaj mi wynik”. Do sprawdzenia jakości głosu PL na Androidzie.

### Etap 7. Odporność
- **Brak internetu**: baner „Brak połączenia. Spróbuj, gdy będziesz w zasięgu.” + zapamiętany ostatni wynik dla zapisanych pól (offline-read; osobna decyzja).
- **Błędy**: ludzkie komunikaty z jedną akcją („Spróbuj ponownie”, „Zadzwoń do nas”). Mapowanie kodów API na zdania w `core/api/errors.ts`.
- **Długie analizy**: „To potrwa około minuty. Nie zamykaj tej strony.” oraz możliwość wyjścia z powiadomieniem na e-mail (jeśli konto; osobny temat).
- **Auto-zapis** w formularzach, brak utraty danych przy odświeżeniu.

### Etap 8. Test z ludźmi
- 5 osób 65+ (w tym 2 z rolnictwa) i 3 osoby 20–30 lat; scenariusze: (1) „Sprawdź, czy twoje pole ma dość wody”, (2) „Dodaj pole i wróć do niego jutro”, (3) „Zaznacz dwa mokre miejsca”.
- Mierzyć: czas, liczba pomyłek, miejsca zawahania. Nagrywać (za zgodą).
- Kryterium: ≥ 4/5 seniorów kończy scenariusz 1 bez pomocy w < 2 min.
- Automatyczne: Playwright + axe (kontrast, etykiety), ręczny test na Androidzie z powiększonym fontem 150%.

## 4. Kolejność wdrożenia

| Kolejność | Etap | Efekt dla Mariana | Wielkość |
|-----------|------|--------------------|----------|
| 1 | 1 Szybkie wygrane | Czytelniej, większe przyciski, nic nie ginie | S |
| 2 | 2 Język | Rozumie, co widzi | S–M |
| 3 | 3 Ścieżka 3 kroków | Sam dochodzi do wyniku | M–L |
| 4 | 4 Wynik w jednym zdaniu | Rozumie wynik | M |
| 5 | 5 Pomoc | Wie, gdzie szukać pomocy | M |
| 6 | 6 Większy tekst / kontrast | Dopasowanie do wzroku | S–M |
| 7 | 7 Odporność | Mniej frustracji | M |
| 8 | 8 Test z ludźmi | Weryfikacja, korekty | ciągły |

Etapy 1–2 można zrobić **równolegle z** [PLAN_MAPA_I_POLA.md](PLAN_MAPA_I_POLA.md) (etapy A i D), bo dotyczą tych samych plików (`wodo-map`, `analysis-form`). Wspólne PR-y są sensowne.

## 5. Decyzje do podjęcia

1. **Wyszukiwanie po miejscowości**: skąd darmowe geokodowanie bez klucza (np. Nominatim ma limity użycia; ewentualnie usługa wyszukiwania adresów GUGiK)? Wymaga uzgodnienia (zasada „darmowe, bez kluczy”). Do sprawdzenia, czy backend już coś takiego udostępnia.
2. **Treści wniosku** (zdanie + „co zrobić”): generuje backend czy tłumaczy słownik w UI? Zgodnie z AGENTS.md to **backend**; potrzebne ustalenie z osobą od API.
3. **Kontakt/pomoc**: numer telefonu lub e-mail, który możemy opublikować.
4. **Czy ścieżka 3-krokowa zastępuje obecny ekran** (rekomendacja: dla pierwszej wizyty tak, a użytkownik zaawansowany ma przełącznik „Widok dla zaawansowanych”).
5. **Głos („Przeczytaj mi wynik”)**: czy warto w tej edycji.

## 6. Ryzyka

- Zmiana nazw w menu i słownika: zaktualizować testy E2E, tytuły tras (`title` w `app.routes.ts`), `docs/` i prezentację.
- Większy tekst na małym ekranie 390 px może psuć układ kart: sprawdzić przy 150%.
- Zbyt „uproszczony” interfejs może irytować 20-latka: stąd zwijane „Więcej ustawień” i tryb zaawansowany, a nie usuwanie funkcji.
- Terminologia agronomiczna musi pozostać poprawna (konsultacja KOWR) przy każdej zmianie słownika.
