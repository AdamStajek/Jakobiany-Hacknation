# Plan: ścieżka demo (wymagania Marleny)

Stan: **szkic do akceptacji, nic nie zaimplementowano.** Lista Marleny może się jeszcze zmienić, więc plan jest podzielony na niezależne kroki, a kolejność można przestawić bez przeróbek.
Powiązane: [PLAN_MAPA_I_POLA.md](PLAN_MAPA_I_POLA.md), [PLAN_SENIOR_MARIAN.md](PLAN_SENIOR_MARIAN.md).

## 1. Co jest, a czego brakuje

| # | Wymaganie Marleny | Stan w kodzie | Brakuje |
|---|-------------------|---------------|---------|
| 1 | Strona główna | Jest tylko ekran Analizy (mapa + panel „Dane”). | Prosta strona startowa z jednym przyciskiem „Dodaj pole”. |
| 2 | Wybór działki, fokus mapy, granice, uprawa i data. **Uwaga Marleny: „dodaj pole” następuje dopiero po analizie.** | Jest: wybór działki, `fitBounds` z granicami, uprawa i data w `analysis-form`; po raporcie baner „Dodaj do pól” (`report-prompt`). | Ciąg kroków (patrz etap 3 w [PLAN_SENIOR_MARIAN.md](PLAN_SENIOR_MARIAN.md)) bez auto-modalu. „Dodaj pole” zostaje po raporcie, bez zmian w zasadzie. |
| 3 | Tekst na uporządkowane informacje (gleba, teren, problem, ograniczenie, potwierdzenie) | **Brak.** Są tylko selecty z katalogu (`field-declarations`). | Pole tekstowe, wyciąg 4 atrybutów, ekran potwierdzenia z możliwością poprawki. |
| 4 | „Co możesz zrobić?”: karty, uzasadnienie, plan działań | Jest: `report-recommendations` z panelem „Dlaczego na tej działce?” (dowody, punkty na mapie). | Przemianowanie sekcji, 1–2 karty na górze, krótki „plan działań” (kroki), powiązanie z danymi z pkt 3. |
| 5 | „Zaproponuj eksperyment”: test, grafika test/kontrola, instrukcje, „Zapisz eksperyment” | Są: `report-experiments`, instrukcje w `experiment-guides`, grafiki, zapis wyniku (`saveExperiment`). | Przycisk „Zaproponuj eksperyment”, grafika dwóch fragmentów pola (test/kontrola), osobny „Zapisz eksperyment” (zapis zamiaru, nie wyniku). |
| 6 | Powiadomienia: ustawienia, mail, mail dopasowany | Jest backend `wodo/notify` (reguły, mailer, szablon „Pole wymaga uwagi”, `GET/PATCH /api/me/notifications`) i ustawienia na stronie konta (tylko po zalogowaniu). | Ustawienia także w ścieżce demo (bez przechodzenia do konta), podgląd/wysyłka **dwóch maili demo** z treścią od Marleny (opady, resztki kukurydzy), wymuszone wyzwolenie. |
| 7 | Mapa gospodarstwa z **podsumowaniem tego, co użytkownik ma w swoich polach** i przyciskiem „Pobierz raport” (raport o wszystkich jego polach) | Jest PDF pojedynczego raportu, `FieldsStore`, mapa pól (po [PLAN_MAPA_I_POLA.md](PLAN_MAPA_I_POLA.md) etap B będzie kolorowa z wyborem). | Podsumowanie: liczba pól i działek, łączna powierzchnia, uprawy, statusy i powody uwagi. Raport zbiorczy do pobrania (PDF/druk). |

## 2. Założenia

- Zgodnie z [AGENTS.md](../AGENTS.md): wyłącznie darmowe/otwarte narzędzia, bez kluczy API, logika biznesowa w backendzie, UI po polsku.
- **Demo musi działać bez konta i bez zewnętrznego serwera pocztowego.** Maile pokazujemy jako podgląd w aplikacji (opcjonalnie wysyłka, gdy skonfigurowany SMTP).
- Dane „na pokaz” (nachylone pole, piasek, kukurydza) oznaczamy jawnie jako scenariusz demonstracyjny, żeby nie udawać prawdziwych pomiarów.

## 3. Kroki i kolejność

Kolejność wynika z zależności i ryzyka. Kroki oznaczone ◇ można przesunąć bez konsekwencji.

### Krok 0. Uzgodnienia (przed kodem)
1. Pytania do Marleny: czy lista jest zamknięta, który scenariusz jest głównym (pole piaszczyste, nachylone, kukurydza), jakie dokładnie teksty wejściowe pokazuje na demo.
2. Decyzja, gdzie mieszka „ścieżka demo”: nowa trasa `/demo` (rekomendacja, nie rusza głównej aplikacji) czy zmiana istniejących ekranów.
3. Czy mail ma być wysyłany naprawdę, czy wystarczy podgląd (rekomendacja: podgląd + wysyłka, jeśli jest SMTP).

### Krok 1. Strona główna i analiza (wymagania 1 i 2)
- Strona startowa: nazwa, jedno zdanie o celu, duży przycisk **„Sprawdź pole”**, drugi „Moje pola”.
- Kroki: (1) wybór działki na mapie lub po numerze, (2) mapa przybliża i rysuje granice (istnieje), (3) uprawa (kafelki z ikonami) i data (domyślnie dziś), (4) analiza i raport.
- **Dodanie do „Moich pól” jest po analizie** (istniejący baner `report-prompt` i przycisk w raporcie), nie przed nią.
- Bez auto-otwierania okien (zgodnie z etapem D w [PLAN_MAPA_I_POLA.md](PLAN_MAPA_I_POLA.md)).
- Zależności: brak. Zrobić pierwszy, bo reszta na tym stoi.

### Krok 2. Tekst na uporządkowane informacje (wymaganie 3)
To jedyna część, która wymaga nowej funkcji.
- Pole tekstowe „Opisz swoje pole własnymi słowami” (np. „Pole jest na skarpie, ziemia lekka, po ulewach woda spływa, nie mam pieniędzy na drenaż”).
- **Backend** (logika po stronie serwera): nowy endpoint, który z tekstu wyciąga cztery atrybuty: gleba, teren, problem, ograniczenie. Wersja bez zewnętrznych usług: słownik słów kluczowych i odmian polskich (np. „piask”, „lekka” → piaszczysta; „skarp”, „spadek”, „stok” → nachylony; „spływ”, „sucho”, „zastój” → problem; „nie mam pieniędzy”, „tanio” → niski budżet). Każdy atrybut ma wartość z zamkniętej listy lub „nie rozpoznano”, plus fragment tekstu, z którego go wzięto.
- Ewentualne wzmocnienie lokalnym modelem językowym tylko po osobnej zgodzie (zasada „darmowe, bez kluczy, nowe zależności po uzgodnieniu”).
- **Frontend**: ekran potwierdzenia z czterema wierszami „Gleba: piaszczysta”, „Teren: nachylony”, „Problem: spływ powierzchniowy”, „Ograniczenie: niski budżet”. Każdy wiersz można poprawić z listy (kafelki), brak rozpoznania jest widoczny jawnie (zgodnie z regułą „niepewność pokazuj jawnie”). Przycisk **„Potwierdzam”**.
- Powiązanie z istniejącym mechanizmem: potwierdzone atrybuty trafiają do `farmer_answers` / obserwacji rekomendacji (`recommendation_observations`), więc silnik rekomendacji z `wodo/recommendations.py` je wykorzysta bez zmian formatu raportu. Sprawdzić, które klucze katalogu `recommendation_catalog` odpowiadają czterem atrybutom.
- Testy: backend (tabela przykładów zdanie → atrybuty, w tym negatywne), frontend (ekran potwierdzenia).

### Krok 3. „Co możesz zrobić?” (wymaganie 4)
- Nowy układ sekcji raportu: nagłówek „Co możesz zrobić?”, 1–2 duże karty rekomendacji na górze (np. „Ogranicz straty wilgoci w glebie”), reszta pod „Pokaż więcej”.
- Kliknięcie karty: rozwija **uzasadnienie** („Dlaczego to pasuje do Twojego pola”, oparte o potwierdzone atrybuty z kroku 2 i dane działki) i **krótki plan działań** (3–4 kroki). Użyć istniejącego panelu „Dlaczego na tej działce?”; plan działań wymaga pola w odpowiedzi backendu (sprawdzić, czy `Recommendation` ma już kroki, jeśli nie, dodać).
- Zależność: po kroku 2 (inaczej uzasadnienie jest ogólne).

### Krok 4. „Zaproponuj eksperyment” (wymaganie 5)
- Przycisk „Zaproponuj eksperyment” pod rekomendacją pokazuje jeden test dobrany do problemu (istnieje logika w `wodo/experiments.py` i `report.experiments`).
- Nowa grafika (SVG, własna, bez zewnętrznych zasobów): pole podzielone na dwa fragmenty podpisane **Test** i **Kontrola**, z legendą co zmieniamy.
- Trzy bloki instrukcji: **Co zmienić**, **Co obserwować**, **Jak porównać**. Treść z istniejących `experiment-guides`.
- Przycisk **„Zapisz eksperyment”**: zapisuje zamiar (nazwa, pole, data startu, fragmenty). Rozróżnić od istniejącego „Zapisz wynik”. Wymaga małego rozszerzenia modelu (kto zapisuje: konto lub przeglądarka, tak jak pola; do ustalenia z backendem).
- Zależność: po kroku 3 (eksperyment wynika z rekomendacji).

### Krok 5. Powiadomienia i maile demo (wymaganie 6)
- Ustawienia w ścieżce demo: przełącznik „Powiadamiaj mnie o istotnych zmianach”, wybór „E-mail / powiadomienia w aplikacji”, pole e-mail, przycisk „Zapisz”. Dla gościa zapis lokalny (za zgodą) lub tymczasowy; dla zalogowanego istniejące `PATCH /api/me/notifications`.
- **Dwa maile demo** z treścią od Marleny, jako szablony w `wodo/notify/templates.py` w układzie: „Co się dzieje?” / „Co warto zrobić?” / „Dlaczego?”:
  1. „Nadchodzą intensywne opady — zadbaj o zatrzymanie wody na swoim polu”,
  2. „Zbiory kukurydzy za tydzień — pozostaw resztki pożniwne na wskazanej części pola”.
- Treść ma się **dopasowywać do pola** z kroku 2 (nachylone, piaszczyste) i do wyniku eksperymentu z kroku 4 (mail 2 powołuje się na „wcześniejszy eksperyment”). Zmienne w szablonie, nie sztywny tekst.
- Przycisk „Pokaż przykładowe powiadomienie” (wymuszone wyzwolenie, zgodnie z uwagą „może być wymuszone”): podgląd obu maili w aplikacji; wysyłka realna tylko przy skonfigurowanym SMTP.
- Zmiana prognozy intensywnych opadów i zbiorów to dla demo **scenariusz wyzwalany ręcznie**, bez integracji z prognozą.
- Testy: szablony (zmienne podstawione, brak pustych pól), reguła wyzwolenia.

### Krok 6. Mapa gospodarstwa i „Pobierz raport” (wymaganie 7)
- Widok „Moje gospodarstwo” (w Moich polach): mapa wszystkich pól w kolorach (etap B z [PLAN_MAPA_I_POLA.md](PLAN_MAPA_I_POLA.md)) i **podsumowanie tego, co użytkownik ma w polach**: liczba pól i działek, łączna powierzchnia, uprawy (ile ha czego), ile pól wymaga uwagi i dlaczego, data ostatniego raportu każdego pola. Liczone z danych `FieldsStore` (suma i grupowanie to prezentacja; ryzyko i status pochodzą z backendu).
- **„Pobierz raport”**: jeden raport o wszystkich polach użytkownika (tabela pól + podsumowanie + status każdego). Wersja podstawowa: widok do druku/zapisu do PDF z przeglądarki (klasy `print:`); jeśli czas pozwoli, PDF z backendu przez rozszerzenie `wodo/report.py`.
- Zależność: po etapie B planu map; najlepiej na końcu, bo korzysta ze wszystkiego powyżej.

### Krok 7. Przejście i próba generalna
- Jedna ścieżka klikalna od strony głównej do raportu, bez martwych końców, na telefonie (390 px) i na projektorze (desktop).
- Skrypt demo w `docs/` (krok po kroku, jaki tekst wpisać, co zobaczymy) i dane przykładowe do szybkiego startu (jedna działka, jedno pole).
- Playwright E2E całej ścieżki; `cd frontend && npm run lint && npm test && npm run build` oraz testy backendu.

## 4. Kolejność skrótowo

| Kolejność | Krok | Wielkość | Uwagi |
|-----------|------|----------|-------|
| 0 | Uzgodnienia z Marleną | S | Bez tego ryzyko przeróbek |
| 1 | Strona główna + dodaj pole | S–M | Niezależny |
| 2 | Tekst → informacje | M–L | Jedyna nowa funkcja backendowa |
| 3 | Co możesz zrobić? | M | Po 2 |
| 4 | Zaproponuj eksperyment | M | Po 3 |
| 5 | Powiadomienia i maile | M | Po 2 i 4 (treść dopasowana) |
| 6 | Mapa gospodarstwa + raport | M | Po etapie B planu map |
| 7 | Próba generalna | S | Na końcu |

Gdyby czasu było mało, minimalna wersja demo to kroki **1, 2, 3, 5**, a 4 i 6 w wersji uproszczonej.

## 5. Jak plan współgra z pozostałymi

- Etap D i A z [PLAN_MAPA_I_POLA.md](PLAN_MAPA_I_POLA.md) (koniec wymuszania modalu, podpisane przyciski) warto zrobić **przed** krokiem 1, bo demo od nich zależy.
- Słownik ludzkich nazw z [PLAN_SENIOR_MARIAN.md](PLAN_SENIOR_MARIAN.md) (etap 2) stosujemy od razu w nowych ekranach demo, żeby nie robić ich dwa razy.
- Teksty maili i etykiety trzymamy w jednym miejscu, by zmiana listy Marleny dotykała jednego pliku.

## 6. Ryzyka

- **Rozpoznawanie tekstu** słownikiem będzie kruche dla niestandardowych zdań. Mitigacja: zawsze ekran potwierdzenia z poprawką, jawne „nie rozpoznano”, przygotowanie zdań demo i testów dla nich.
- **Mail na żywo** zależy od SMTP. Mitigacja: podgląd w aplikacji jako domyślny sposób pokazania.
- **Zmiany listy Marleny**: kroki są niezależne, a treści w szablonach i słowniku, więc zmiana to edycja danych, nie architektury.
- **Demo na danych „na pokaz”**: jawnie oznaczyć scenariusz, żeby nie wprowadzać w błąd co do pomiarów.
