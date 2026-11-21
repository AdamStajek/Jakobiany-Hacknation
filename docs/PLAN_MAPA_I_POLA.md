# Plan: mapa, „Moje pola” i formularz informacji o polu

Stan: propozycja do akceptacji (nic jeszcze nie zmieniono w kodzie).
Zasięg: `frontend/` (żadnych zmian w backendzie). Zasady kodu: [FRONTEND_GUIDE_LLM.md](FRONTEND_GUIDE_LLM.md).

## 1. Co jest dziś (diagnoza)

| # | Obserwacja | Gdzie w kodzie |
|---|-----------|----------------|
| P1 | Mapa w „Moich polach” to ten sam `WodoMap` co w Analizie, tylko z granicami pól. Nie da się wybrać pola **granicą** (tylko małą pinezką przy oddaleniu, `PIN_MAX_ZOOM = 14.5`). Po przybliżeniu pinezki znikają, a kliknięcie w mapę nic nie robi (`pointClicked` nie jest podpięte w `fields-page.ts`). | `shared/map/wodo-map.ts`, `features/fields/fields-page.ts` |
| P2 | Wszystkie pola rysują się jako **jeden** MultiPolygon w jednym kolorze (`#EE8106`). Kolor pola nadany w formularzu widać tylko na pinezce. Nie ma wypełnienia per pole, nazwy na polu ani zaznaczenia aktywnego pola. | `fieldsGeometry()`, warstwy `parcel-fill/line` |
| P3 | Mapa w Analizie nie zna „Moich pól”. Użytkownik nie widzi swoich działek, gdy wybiera nową. | `analysis-page.ts` |
| P4 | „Modal po kliknięciu w pole” = `p-dialog` „Dodaj informacje o polu” w `analysis-form.html`. Otwiera się **sam** po wybraniu działki (`detailsOpen.set(!!parcel && !report)`) i zawiera ~10 pól plus pytania rolnika (`field-declarations`). Przycisk „Gotowe” **waliduje** i potrafi nie zamknąć okna (`closeDetails()`). Przycisk „Analizuj” jest też w modalu. | `analysis-form.ts`, `analysis-form.html`, `field-declarations.html` |
| P5 | Zaznaczanie kilku stref: ukryte za przyciskiem „Zaznacz strefy na mapie” **wewnątrz** modalu, w mapie 256 px. Każda strefa wymusza typ i datę, inaczej `collect()` zwraca błąd i okno się nie zamyka. | `field-declarations.html/ts` |
| P6 | Przyciski po prawej stronie mapy to same ikony 44×44 (`pi-images`, `pi-table`, `pi-pencil`, `pi-compass`), z podpowiedzią tylko po najechaniu (`title`). Na telefonie `title` nie działa. Stan włączenia to tylko cienka ramka. | `wodo-map.ts` (szablon) |
| P7 | Rysowanie granicy: instrukcja pojawia się dopiero po kliknięciu ołówka, jest na górze i znika razem z rysowaniem. Brak „Cofnij punkt”, „Zakończ”, licznika punktów. | `wodo-map.ts` |
| P8 | Zalogowany i niezalogowany: ten sam widok, różni się tylko jednym zdaniem o miejscu zapisu. To dobrze, ale zdanie jest małe (`text-xs`), a dwa banery (zgoda i propozycja dodania pola) potrafią zasłonić mapę. | `fields-page.ts`, `consent-banner.ts`, `report-prompt.ts` |

## 2. Cel i zasady

1. **Jedna mapa, jeden język.** Mapa w Analizie i w Moich polach wygląda i zachowuje się tak samo, ale ma jasno widoczny tryb: „Wybierz działkę” albo „Moje pola”.
2. **Wszystko przez nazwane przyciski.** Żadnych samych ikon. Każda akcja ma tekst.
3. **Formularz nie blokuje.** Wynik analizy można dostać bez wypełniania czegokolwiek ponad uprawę i datę. Resztę dodaje się opcjonalnie, po fakcie.
4. **Bez konta = pełnoprawnie.** Konto tylko dodaje: synchronizację między urządzeniami. Żadna funkcja mapy nie wymaga logowania.

## 3. Podział na etapy

### Etap A. Czytelne przyciski i podpowiedzi na mapie (mały, od razu widoczny efekt)
Dotyczy P6, P7.

- Zamienić kolumnę ikon na **przyciski z podpisem** (ikona + krótki tekst, min. 48 px wysokości): „Zdjęcie z satelity / Mapa”, „Granice działek”, „Gdzie jestem”, „Narysuj działkę”.
  - Przełącznik podkładu pokazuje, **co się włączy po kliknięciu** („Pokaż satelitę”), a nie ikonę.
  - Stan włączenia: wypełnione tło + `aria-pressed` + słowo „Włączone”, nie sama ramka.
- Na telefonie: podpisy skrócone, ale zawsze widoczne (bez `title`). Panel można zwinąć przyciskiem „Narzędzia mapy”.
- Przy pierwszej wizycie na mapie krótka, zamykalna wskazówka: „Dotknij działki na mapie, żeby ją wybrać. Przybliż mapę, jeśli nic się nie dzieje.” (zapamiętana w localStorage tylko za zgodą, jak reszta).
- Rysowanie jako **tryb z paskiem na dole**: instrukcja zawsze widoczna („Dotykaj kolejnych rogów działki”), licznik punktów, przyciski **Cofnij punkt**, **Zakończ**, **Anuluj**. Terra Draw już to wspiera (`undo` w trybie polygon, do zweryfikowania w `node_modules/terra-draw`).
- Test: spec dla funkcji pomocniczych (jeśli powstaną), E2E: tryb rysowania pokazuje pasek.

### Etap B. Mapa „Moje pola” z wyborem pola
Dotyczy P1, P2, P8.

- Backend nie jest potrzebny: dane pól są w `FieldsStore`.
- W `shared/map/` dodać wejście `fields: FieldShape[]` (id, nazwa, kolor, geometria) i wyjście `fieldClicked`. Zastąpić jedną sumaryczną geometrię osobnymi obiektami GeoJSON z `properties.color/name/id`.
- Warstwy: wypełnienie w kolorze pola (półprzezroczyste), obrys, **etykieta z nazwą pola** od zbliżenia ok. 12; pinezki zostają dla dużego oddalenia.
- Kliknięcie w granicę pola (nie tylko pinezkę) wybiera pole: pole zaznaczone ma grubszy obrys, pozostałe są przygaszone.
- Po wybraniu pola na dole mapy karta (już jest: `Na mapie: …`) z przyciskami **Analizuj**, **Paszport**, **Pokaż wszystkie pola**. Dziś jest tylko „Wszystkie pola”.
- Lista po lewej i mapa są zsynchronizowane: kliknięcie karty podświetla pole na mapie i odwrotnie (już częściowo: `locate()`).
- „Wybranie kilku pól”: wystarczy lista z checkboxami + akcja „Pokaż zaznaczone na mapie”. Na teraz nie robimy zbiorczej analizy (poza zakresem).
- Banery (zgoda, „Dodaj do pól”) nie mogą zakrywać mapy ani przycisków narzędzi. Jeden baner naraz, kolejka w `Shell`.

Kryteria przyjęcia: z mapy da się kliknąć dowolne z min. 3 pól i zobaczyć jego nazwę oraz przyciski akcji, w jasnym i ciemnym motywie, na 390 px i na desktopie.

### Etap C. Moje pola na mapie Analizy (zalogowany i nie)
Dotyczy P3, P8.

- `WodoMap` w Analizie dostaje tę samą warstwę `fields`, ale **wyciszoną** (cienki obrys + nazwa), żeby nie mylić jej z działką wybraną do analizy.
- Przełącznik „Pokaż moje pola” (domyślnie włączony, gdy użytkownik ma ≥ 1 pole). Zapis wyboru tylko za zgodą na localStorage.
- Kliknięcie w moje pole na mapie Analizy = wybór jego działki (jedno kliknięcie, bez wyszukiwania).
- Nie zalogowany: widzi pola z `localFields` (zgoda na zapis) albo z pamięci karty. Gdy pól brak, przełącznik jest ukryty, nie pokazuje pustych komunikatów.
- Zalogowany: pola z serwera, bez dodatkowych kroków. Po zalogowaniu nadal działa propozycja przeniesienia (`offerMigration`).
- Kolejność zależności: `features/analysis` bierze pola przez `FieldsStore` z `core/` (dozwolone), mapa dostaje tylko dane przez `input()`.

### Etap D. Formularz „Informacje o polu” bez wymuszania
Dotyczy P4, P5. To największa poprawka w odbiorze.

1. **Przestać otwierać modal automatycznie.** Usunąć `detailsOpen.set(!!parcel && …)` z konstruktora i efektu. Po wyborze działki użytkownik widzi tylko: nazwa działki, uprawa, data, duży przycisk **„Sprawdź wodę na polu”**.
2. **Domyślne wartości.** Uprawa (ostatnio użyta lub „pszenica” jak dziś), data = dziś. Jeśli uprawa nieznana, „Nie wiem”: analiza i tak działa (jest już ostrzeżenie `cropUnknown`).
3. **Dodatkowe informacje jako opcjonalna sekcja pod raportem lub w panelu bocznym**, nie w oknie modalnym:
   - Zamiast jednego długiego okna: 3 krótkie, zwijane sekcje „Gleba i woda”, „Nawadnianie”, „Miejsca problemowe”. Każda ma w nagłówku „Opcjonalne”.
   - Wpisane odpowiedzi zapisują się od razu (szkic), bez „Gotowe”.
   - Na telefonie sekcje otwierają się jako pełny ekran z przyciskiem „Wstecz”, nie jako okno nad oknem.
4. **Walidacja bez pułapek.** `closeDetails()` nie może blokować zamknięcia. Błędne strefy zostają zaznaczone na czerwono w liście, a nie zatrzymują użytkownika. Strefa bez typu dostaje typ „Inne”, a data domyślnie = dzień analizy (dziś brak daty wymusza błąd).
5. **Strefy problemowe jako osobny, prosty krok** (P5, patrz Etap E).
6. Po raporcie: baner „Chcesz dokładniejszy wynik? Dodaj informacje o polu” i ponowna analiza jednym kliknięciem. Użytkownik dostaje wartość najpierw, wysiłek potem.

Zakres plików: `analysis-form.ts/.html`, `shared/ui/field-declarations.*`, nowy `shared/ui/` dla zwijanej sekcji (jeśli PrimeNG `Accordion` nie wystarczy, najpierw użyć go).

### Etap E. Zaznaczanie kilku stref na działce
Dotyczy P5, P7.

- Wyjść z ukrytej mapki 256 px w modalu. Strefy zaznacza się na **głównej, dużej mapie** w trybie „Zaznacz miejsca problemowe” (osobny tryb mapy, jak rysowanie).
- Pasek trybu (na dole, zawsze widoczny): „Dotknij miejsca na działce, które sprawia kłopot. Możesz dodać wiele miejsc.” + licznik „Zaznaczono: 3” + **Cofnij ostatnie**, **Usuń wszystkie**, **Gotowe**.
- Każdy zaznaczony punkt to numerowany znacznik na mapie. Dotknięcie znacznika otwiera mały panel: typ (duże kafelki: Przesuszenie, Zastój wody, Erozja, Słaby plon, Inne), opcjonalny opis. Data domyślnie dziś.
- Punkt poza granicą działki: komunikat przy znaczniku, bez blokowania („To miejsce jest poza działką. Dotknij wewnątrz zaznaczonego obszaru.”) i delikatne podświetlenie obrysu.
- Limit 30 stref zostaje, z komunikatem „Masz już 30 miejsc” zamiast ciszy.
- Pole/stan strefy po stronie danych niezmieniony: nadal `problem_zones` w `FarmerAnswers`.

### Etap F. Testy i weryfikacja
- Spec: nowe funkcje czyste (budowa GeoJSON z pól, domyślne wartości formularza, reguły walidacji stref).
- E2E (Playwright): (1) gość: dodaj działkę → Moje pola → kliknij pole na mapie; (2) wejście na Analizę bez modala; (3) zaznaczenie 3 stref i analiza; (4) ten sam przepływ po zalogowaniu.
- Ręcznie: 390 px, 1024 px, ciemny motyw, `prefers-reduced-motion`, nawigacja klawiaturą po paskach trybów.
- Na końcu: `cd frontend && npm run lint && npm test && npm run build`.

## 4. Kolejność i szacunek

| Kolejność | Etap | Wielkość | Zależności |
|-----------|------|----------|-----------|
| 1 | D (koniec wymuszania modalu) | S–M | brak. Największa ulga dla użytkownika |
| 2 | A (przyciski i rysowanie) | S | brak |
| 3 | B (mapa Moich pól) | M | brak |
| 4 | E (strefy na głównej mapie) | M | po A i D |
| 5 | C (pola na mapie Analizy) | S | po B (wspólna warstwa) |
| 6 | F (testy) | w każdym etapie | |

## 5. Decyzje do podjęcia (rekomendacje w nawiasach)

1. Czy modal całkowicie znika (**tak**), czy zostaje jako przycisk „Dodaj informacje” dla chętnych (zostaje, ale bez auto-otwierania i bez blokad).
2. Czy w Analizie domyślnie pokazywać moje pola na mapie (**tak, wyciszone**).
3. Czy zbiorcza analiza kilku pól wchodzi do zakresu (**nie, osobny temat**).

## 6. Ryzyka

- `WodoMap` ma już ~275 linii, a guide mówi „> 250 → rozbij”. Przy dodawaniu warstw pól wydzielić warstwy i tryby (rysowanie, strefy) do plików w `shared/map/`.
- Terra Draw: potwierdzić API cofania punktu w zainstalowanej wersji, nie zgadywać.
- Zmiana domyślnego zachowania formularza dotyka testów i raportu: sprawdzić, że raport bez `farmer_answers` jest nadal pełny (backend już to dopuszcza, bo `collect()` zwraca `{}`).
