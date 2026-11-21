# Pocket Soil Lab — kompletna specyfikacja pięciu eksperymentów terenowych

**Projekt:** „Zatrzymaj wodę, chroń plony” — HackNation 2026 / zadanie KOWR  
**Wersja:** 1.0 (21 listopada 2026 r.)  
**Zakres:** eksperymenty nr **1, 2, 3, 4 i 8**: infiltracja, wilgotność profilu, VESS, slake test i deszczomierz.  
**Dane wejściowe:** `KOWR_zadanie_konkursowe.md`, `KOWR - Podstawy naukowe.md`, `paszport_pola_katalog_danych.csv`, `paszport_pola_15_danych_od_rolnika.csv`, `paszport_pola_eksperymenty.csv`.  
**Przeznaczenie:** instrukcje dla rolnika, reguły wyboru testu, specyfikacja formularzy i walidacji, wytyczne dla silnika rekomendacji oraz dokumentacja MVP.

> **Co jest źródłem, a co propozycją projektu?** Wymagania KOWR opisano w §1–2. Procedury pomiarowe oparto na materiałach USDA-NRCS, AHDB/SRUC, SARE oraz wytycznych obserwacji opadów [S1–S7]. **Nazwy pól, enumy, priorytety P0/P1/P2 i niektóre klasy obserwacji są projektem aplikacji** zapisanym w CSV, a nie oficjalnymi skalami naukowymi. Proponowane reguły wyboru testu i oceny jakości są **regułami MVP**, wymagającymi dalszej walidacji terenowej.

---

## 1. Rola eksperymentów w zadaniu KOWR

1. Użytkownik wybiera działkę ewidencyjną, datę analizy i uprawę. System najpierw analizuje dane publiczne: meteorologiczne, satelitarne, glebowe, hydrologiczne i przestrzenne (w tym kontekst wieloletni, zgodnie z zakresem zadania).
2. System przedstawia **bazową ocenę sytuacji wodnej, przyczyny oraz rekomendacje retencyjne/agrotechniczne**, a dopiero ewentualnie nawadnianie. To jest ścieżka obowiązkowa — **żaden eksperyment nie może być wymagany** do otrzymania raportu.
3. Jeśli ważna hipoteza pozostaje niepewna, aplikacja może zaproponować **jeden optymalny test** na daną chwilę. Użytkownik może go pominąć.
4. Wynik terenowy jest dopinany do **konkretnej działki, miejsca, czasu, uprawy i procedury**, a następnie porównywany z właściwymi danymi modelowymi. System pokazuje, czy obserwacja wspiera hipotezę, jest z nią sprzeczna, czy pozostaje nierozstrzygająca.
5. Aplikacja zachowuje zarówno **raport sprzed testu**, jak i **zaktualizowany raport** z informacją, co się zmieniło i dlaczego.

**Ważne dla testów jury:** jeśli jury wybierze datę historyczną, nie wolno udawać, że współczesny pomiar terenowy opisuje stan gleby lub opad z tamtego dnia. Pomiar z listopada 2026 r. nie stanowi obserwacji wilgotności z czerwca 2019 r. Również zmienne względnie trwałe (np. budowa profilu) należy przenosić w czasie z ostrożnością, z uwzględnieniem zmian uprawy i agrotechniki.

### 1.1. Szybkie zestawienie

| ID w koncepcji | `experiment_type` | Pytanie diagnostyczne | Orientacyjny koszt dodatkowy* | Czas pracy / oczekiwania | Główna korzyść |
|---|---|---|---|---|---|
| 1 | `INFILTRATION` | Jak szybko woda wnika w tę glebę? | 20–80 zł | 20–60+ min (zależnie od gleby) | Rozpoznanie problemów z wnikaniem wody i spływem |
| 2 | `SOIL_MOISTURE` | Czy przesuszona jest także obserwowana strefa korzeniowa? | 0–80 zł | 10–25 min | Weryfikacja podejrzenia deficytu wody |
| 3 | `VESS` | Czy struktura gleby lub zagęszczenie ograniczają korzenie i wodę? | 0–100 zł | 15–30 min | Wykrywanie warstw ograniczających |
| 4 | `SLAKE` | Czy agregaty gleby rozpadają się po gwałtownym zwilżeniu? | 0–40 zł | 15–30 min pracy + 24–72 h suszenia (opcjonalne obserwacje do 24 h) | Ocena podatności struktury na rozpad |
| 8 | `RAINFALL` | Czy lokalny opad odpowiada danym przypisanym do działki? | 20–60 zł | 2–3 min na odczyt dzienny, przez wiele dni | Kontrola lokalnych danych opadowych |

\* **Budżety szacunkowe, nie oferty sklepowe:** koszt dodatkowych prostych przedmiotów w Polsce; zakładają możliwość użycia posiadanego szpadla, zegarka, wody i pojemników. Nie obejmują robocizny, dojazdu, laboratorium, droższego sprzętu ani ceny aplikacji. Nie są progiem dopuszczalności eksperymentu.

### 1.2. Reguły wspólne

- **Jedno miejsce ≠ całe pole.** Preferuj co najmniej trzy lokalizacje/powtórzenia w porównywalnych warunkach, gdy chcesz formułować wniosek o większej części pola; oznacz wyniki z pojedynczego punktu jako lokalne.
- **Miejsca charakterystyczne:** typowy fragment pola oraz — jeśli jest hipoteza o problemie — osobno koleina, uwrocie, zagłębienie lub wzniesienie. Nie uśredniaj różnych klas miejsc bez oznaczenia ich położenia.
- **Stan gleby ma znaczenie:** zapisz okrywę powierzchni, wcześniejszy deszcz i aktualne uwilgotnienie; testy terenowe porównuj przy możliwie podobnych warunkach.
- **Bezpieczna praca:** nie kop w pobliżu nieoznaczonego uzbrojenia, instalacji, głębokich rowów ani niebezpiecznych skarp; korzystaj z narzędzi zgodnie z ich przeznaczeniem. Nie niszcz rosnącej uprawy bez potrzeby. Nie pobieraj próbek z miejsc podejrzanych o skażenie bez odpowiedniego postępowania.
- **Brak wyniku to też informacja:** zamarznięta gleba, zalanie, kamień blokujący pierścień, brak możliwości poboru próbki albo niesprawny deszczomierz powinny dawać status „odroczony / nieważny”, a nie wymyśloną liczbę.
- **Rozdziel surowe dane i interpretację:** rolnik wpisuje obserwacje, aplikacja wylicza wskaźniki i ocenia jakość; nigdy nie podmieniaj wartości źródłowych.

---

## 2. Jak aplikacja wybiera eksperyment

### 2.1. Reguły sugerowania (MVP)

| Hipoteza (`hypothesis_code`) | Przesłanki z danych i zachowania pola | Sugerowany test | Kiedy **nie** sugerować od razu | Alternatywa lub następny krok |
|---|---|---|---|---|
| `LOW_INFILTRATION` | Spływ, okresowe zastoiska, zaskorupienie, nachylony teren; zgłoszenie rolnika o odpływie po deszczu | **1. Infiltracja** | Zamarznięta/przesycona gleba, silna susza bez możliwości prawidłowego wstępnego zwilżenia, brak reprezentatywnego miejsca | VESS lub odroczenie |
| `DRY_ROOT_ZONE` | Wskaźniki roślinności i bilans wodny sugerują stres; modelowe wilgotności są niepewne | **2. Wilgotność profilu** | Brak dostępu do gleby, brak informacji o uprawie/głębokości korzeni, zamarznięty profil | Obserwacje uprawy i powtórzenie po opadzie |
| `SOIL_COMPACTION` | Podejrzenie ograniczenia rozwoju korzeni, koleiny, nawracające zastoiska, rozbieżna infiltracja między miejscami | **3. VESS** | Gleba skrajnie sucha/twarda lub mokra/plastyczna; brak bezpiecznego poboru bloku | Powtórka przy odpowiedniej wilgotności |
| `AGGREGATE_INSTABILITY` | Zaskorupienie, erozja, słaba okrywa, rozmywanie powierzchni | **4. Slake test** | Nie można przygotować porównywalnych agregatów; próbka rozkruszona przed testem | Pobrać nową próbkę i osuszyć |
| `LOCAL_RAINFALL_BIAS` | Lokalne burze, duża niepewność sum opadów, rozbieżność między sąsiednimi źródłami | **8. Deszczomierz** | Nie ma bezpiecznej i niezacienionej lokalizacji; deszczomierz jest uszkodzony | Oznacz dane pogodowe jako niepewne |

**Uwaga:** powyższe przesłanki nie oznaczają, że sama mapa satelitarna „wykrywa zagęszczenie” albo „mierzy infiltrację”. To *hipotezy*, które test ma pomóc sprawdzić. Sygnały satelitarne mogą mieć wiele przyczyn (stres cieplny, składniki pokarmowe, choroby, fenologia, błędy danych).

### 2.2. Minimalna logika rankingu testów

1. Najpierw upewnij się, że raport bazowy i przyczyny są wyliczone z publicznych danych.
2. Zbuduj listę **hipotez o znaczeniu decyzyjnym** (co mogłoby zmienić rekomendację retencyjną, agrotechniczną lub ostrożność przy nawadnianiu).
3. Dla każdej hipotezy sprawdź dostępność testu: pora roku, stan gleby, koszt, czas, preferencja rolnika, bezpieczeństwo.
4. Wybierz test, który przy najmniejszym wysiłku może najbardziej zmienić **konkretną decyzję**. Nie bazuj wyłącznie na atrakcyjności demonstracji.
5. Pokaż: „**Dlaczego ten test?**”, „**Co będziesz wiedzieć po nim?**”, „**Ile kosztuje?**”, „**Czy mogę pominąć?**”.
6. Jeśli żaden test nie ma sensu — nie proponuj testu; uzasadnij brak możliwości i pozostaw raport bazowy.

W MVP nie trzeba tworzyć pozornie dokładnego „information gain = 83%”. Lepiej stosować objaśnialne reguły i trzy stany hipotezy: `supports`, `contradicts`, `inconclusive` (lub `not_assessed`).

---

## 3. Eksperyment 1 — infiltracja wody w glebie

**Identyfikator:** `INFILTRATION`  
**Protokół CSV:** `NRCS_SINGLE_RING` — inspirowany instrukcją *USDA-NRCS Soil Health – Infiltration* [S1].  
**Cel:** określić orientacyjnie, jak szybko zdefiniowana porcja wody wsiąka przez odsłoniętą powierzchnię w obrębie jednopierścieniowego testu.

### 3.1. Po co i kiedy

- **Zaproponuj**, gdy woda po opadzie spływa po powierzchni, tworzy zastoiska, gleba się zaskorupia lub model sugeruje ryzyko odpływu, którego skali nie znamy.
- **Przykładowa hipoteza:** „W tym miejscu woda wnika zbyt wolno, aby efektywnie wykorzystać krótkie opady”.
- **Nie utożsamiaj** powolnego wsiąkania z zagęszczeniem: przyczyną może być także stan uwilgotnienia, gleba ilasta, skorupa, słaba struktura lub płytka warstwa ograniczająca. W razie wątpliwości zaproponuj VESS.
- **Najlepsza pora:** przy glebie niezamarzniętej, bez wyjątkowego wysuszenia wierzchniej warstwy; po opadach lub po zgodnym z procedurą wstępnym zwilżeniu. Nie wykonuj w stojącej wodzie czy przy przecieku bokiem.

### 3.2. Co przygotować

Metalowy pierścień o znanej **wewnętrznej** średnicy (wariant referencyjny ok. 15 cm / 6 cali), drewniany klocek i gumowy młotek, folię, miarkę / naczynie z podziałką, wodę, stoper. **Budżet:** 20–80 zł, przy posiadaniu narzędzi mniej. **Czas:** 20–60 minut lub dłużej na glebie wolno przepuszczalnej.

### 3.3. Instrukcja dla rolnika

1. Wybierz co najmniej **3 reprezentatywne punkty** jednej porównywanej strefy; jeśli problemem jest koleina, porównaj ją z punktem poza koleiną i **oznacz te typy miejsc oddzielnie**. Nie wybieraj nor, szczelin ani świeżych śladów kopania.
2. Zapisz datę, stan powierzchni, wcześniejszą pogodę i początkowe uwilgotnienie (`measurement_position`, `surface_condition`, `weather_notes`, `initial_soil_moisture_class`).
3. Zmierz **wewnętrzną** średnicę pierścienia (`ring_diameter_cm`). Wbij go pionowo na około **7,5 cm**; użyj klocka, aby nie zdeformować krawędzi. Delikatnie uszczelnij kontakt gleby z wewnętrzną ścianą bez mocnego ubijania powierzchni (`ring_insertion_depth_cm`).
4. Wyłóż wnętrze folią. Do pierścienia o wymiarach użytych w przewodniku NRCS przygotowano **444 ml** wody jako umowną porcję ~1 cala opadu. **Nie stosuj 444 ml automatycznie do każdej średnicy**: dla własnej średnicy licz objętość z powierzchni koła i przyjętej głębokości wody (wzór poniżej).
5. Wlej odmierzoną wodę **na folię**, nie bezpośrednio na glebę. Szybko, ostrożnie wysuń folię i uruchom stoper. Zatrzymaj go, gdy stojąca woda zniknie, a powierzchnia pozostaje błyszcząca / zwilżona. Zapisz czas (`infiltration_time_s`) i `infiltration_cycle_status=fully_absorbed`.
6. Powtórz wlanie takiej samej porcji w tym samym pierścieniu: `infiltration_cycle_no=2` (ewentualnie 3). Zapisz każdy cykl osobno, z czasem i informacją o wstępnym zwilżeniu. Dalsze cykle pomagają zaobserwować, czy szybkość zbliża się do warunków ustalonych.
7. Jeśli po ustalonym **operacyjnie** limicie (np. 60 minut) woda nadal stoi, wybierz `not_absorbed_within_limit` i podaj `observation_limit_s`; **nie wpisuj tego czasu jako czasu pełnej infiltracji**. Przeciek → `leakage`; przerwanie → `aborted`.
8. Zapisz zdjęcie (opcjonalnie), miejsce, wszystkie cykle oraz powtórz w pozostałych lokalizacjach.

**Podstawa:** USDA-NRCS zaleca warunkowe zwilżenie, powtarzanie kolejnych porcji i wielokrotne pomiary w porównywanych lokalizacjach [S1].

### 3.4. Obliczenie

Dla **jednego poprawnego i zakończonego pełnym wsiąknięciem cyklu**:

```text
A_cm2 = π × (ring_diameter_cm / 2)^2
water_depth_mm = 10 × water_volume_ml / A_cm2
infiltration_rate_mm_h = water_depth_mm × 3600 / infiltration_time_s
                       = 144000 × water_volume_ml
                         / (π × ring_diameter_cm^2 × infiltration_time_s)
```

Przykład **wyłącznie rachunkowy**: średnica 15 cm, woda 444 ml, czas 1200 s → około **75,4 mm/h dla tego cyklu**. To **nie** oznacza „pole przyjmie zawsze 75,4 mm deszczu w godzinę”. Wynik dotyczy konkretnej porcji, czasu, lokalizacji, stanu gleby i metody; jest różny od nasyconej przewodności hydraulicznej `saturated_hydraulic_conductivity`.

W celu uzyskania porcji odpowiadającej 25,4 mm dla innej średnicy:

```text
water_volume_ml = 0.1 × A_cm2 × target_depth_mm
```

### 3.5. Pola danych

**Surowe:** `ring_diameter_cm`, `ring_insertion_depth_cm`, `infiltration_cycle_no`, `water_volume_ml`, `infiltration_time_s`, `infiltration_cycle_status`, `observation_limit_s`, `prewetting_done`, `initial_soil_moisture_class`.  
**Wynik wyliczony:** `infiltration_rate_mm_h`.  
**Metadane wspólne:** `experiment_id`, `measurement_id`, `replicate_no`, `measured_at`, `measurement_position`, `surface_condition`, `method_id`, `method_version`, `quality_status`, `quality_flags` itd. (pełna tabela w aneksie).

### 3.6. Interpretacja → wnioski → rekomendacje

| Obserwacja | Co **może** oznaczać | Co powinna zrobić aplikacja |
|---|---|---|
| Woda szybko wnika, ale gleba szybko wysycha | Infiltracja nie musi być głównym problemem; lekka gleba może mało magazynować | Skieruj uwagę na zdolność zatrzymywania wody, teksturę, okrywę i bilans wodny |
| Woda wnika dużo wolniej w koleinie niż poza nią | Lokalny wpływ przejazdów i zagęszczenia jest prawdopodobny | Zaproponuj VESS w koleinie i poza nią; ogranicz przejazdy w mokrych warunkach |
| Woda wnika wolno w kilku typowych punktach | Ryzyko spływu/zastojów w danych warunkach testu | Rozważ okrywę roślinną, ochronę struktury, działania spowalniające odpływ, diagnostykę zagęszczenia |
| Pierwszy cykl znacznie różni się od kolejnych | Silny wpływ początkowej wilgotności i procesu zwilżania | Nie porównuj pojedynczego pierwszego cyklu z ustalonym zachowaniem gleby |
| Przeciek, brak wsiąknięcia do limitu, pojedynczy punkt | Wynik niepełny lub nieważny | Oznacz `needs_review`/`rejected`, nie podstawiaj fałszywej liczby |

**Zakazane uproszczenia:** „taki wynik dowodzi podeszwy płużnej”, „zmierzono retencję pola”, „to jest Ks z SoilGrids”, „nawadniaj X mm bez pozostałych danych”. Nie wprowadzaj uniwersalnej klasy „dobry/zły” bez lokalnego punktu odniesienia i tekstury.

**Tekst w aplikacji:** „W tym punkcie druga porcja wsiąkała wolniej niż pierwsza. Wynik sugeruje ograniczoną szybkość wnikania wody w warunkach testu. Aby sprawdzić, czy przyczyną jest zagęszczenie, proponujemy ocenę struktury gleby VESS”.

---

## 4. Eksperyment 2 — wilgotność profilu metodą dotykową

**Identyfikator:** `SOIL_MOISTURE`  
**Protokół CSV:** `NRCS_FEEL` — ocena *feel and appearance*, interpretowana zależnie od tekstury [S2].  
**Cel:** sprawdzić, czy obserwowane przesuszenie obejmuje także głębsze warstwy gleby, a nie tylko powierzchnię.

### 4.1. Po co i kiedy

- **Zaproponuj**, gdy dane pogodowe, satelitarne i modelowana wilgotność sugerują stres roślin, lecz nie wiadomo, w jakim stopniu wyschła gleba w strefie ukorzenienia.
- Wykonuj w sezonie wegetacyjnym przy dostępnej glebie; po deszczu test może pokazać różnicę pomiędzy warstwą wierzchnią a głębszą.
- Unikaj oceny przy zamarzniętej glebie i wyciągania wniosków o całej strefie korzeniowej, jeśli pobrano tylko próbkę 0–10 cm.

### 4.2. Materiały, koszt i lokalizacja

Szpadel/świder ręczny, linijka, szczelne pojemniki lub woreczki (gdy pomiar poza wykopem), karta zdjęć porównawczych właściwych dla tekstury. **Budżet:** 0–80 zł. **Czas:** 10–25 minut. Preferowane 2–3 punkty z osobnymi zapisami; unikaj próbek z jednej wybranej skrajnej koleiny jako reprezentacji całego pola.

### 4.3. Instrukcja dla rolnika

1. Wybierz miejsce i zanotuj aktualną uprawę oraz fazę wzrostu, jeśli jest znana. Ustal **praktycznie dostępne głębokości** — np. 0–10, 10–20, 20–40 cm. **Nie są to obowiązkowe warstwy modelu** i nie zawsze obejmują rzeczywistą strefę korzeniową.
2. Wykop niewielki profil lub pobierz próbki świdrem, bez niepotrzebnego mieszania warstw. Każda głębokość to **osobny rekord pomiarowy** z `sample_depth_top_cm` i `sample_depth_bottom_cm`.
3. Zidentyfikuj orientacyjnie teksturę warstwy (`soil_texture_at_depth`), ponieważ gleba piaszczysta i ilasta inaczej zachowują się w dłoni przy podobnym uwilgotnieniu.
4. Weź garść świeżej gleby, delikatnie ściśnij; sprawdź, czy formuje się kulka, jak mocno się lepi i jak łatwo się kruszy. Porównaj z ilustracjami USDA-NRCS dla **odpowiedniej tekstury**.
5. Wybierz w aplikacji klasę `moisture_feel_class`: `bardzo_sucha`, `sucha`, `umiarkowanie_wilgotna`, `mokra`, `bardzo_mokra` albo `nie_wiem`. Doprecyzuj `soil_ball_formation`, ewentualnie `soil_consistency_notes` i `root_presence_class`.
6. Powtórz dla kolejnych głębokości i miejsc. Zapisz zdjęcie i czas; pobranych próbek nie oceniaj dopiero wiele godzin po otwarciu, gdy zdążyły wyschnąć.

### 4.4. Interpretacja

| Układ obserwacji | Co można ostrożnie powiedzieć | Czego nie wolno wnioskować |
|---|---|---|
| Warstwa górna sucha, niższa wyraźnie wilgotniejsza | Wilgoć w badanym profilu jest zróżnicowana z głębokością | Że wszystkie korzenie mają do niej dostęp |
| Wszystkie badane warstwy suche | Deficyt wilgoci w **przebadanym** profilu jest prawdopodobny | Dokładna liczba mm brakującej wody bez kalibracji |
| Wierzch mokry, niżej sucho | Ostatni opad mógł zwilżyć tylko powierzchnię | Pewna przyczyna słabego wschodu / stresu |
| Oceny sprzeczne między miejscami | Wysoka przestrzenna zmienność pola lub różnice tekstury | Jedna „średnia wilgotność całej działki” |

**Ważne:** `moisture_feel_class` jest **klasą jakościową projektu**, nie bezpośrednim wynikiem w % objętości, m³/m³ ani w mm wody dostępnej. Nie przeliczaj jej mechanicznie na `soil_moisture_0_7_cm`, `soil_moisture_7_28_cm`, `soil_moisture_28_100_cm` — te wartości mają inne jednostki, rozdzielczość i warstwy. Podejście referencyjne opiera się na kombinacji wyglądu, dotyku **i tekstury** [S2].

### 4.5. Pola i rekomendacje

**Pola:** `sample_depth_top_cm`, `sample_depth_bottom_cm`, `soil_texture_at_depth`, `moisture_feel_class`, `soil_ball_formation`, `soil_consistency_notes`, `root_presence_class`.

- Jeśli cały badany profil jest suchy, a bilans wodny również pokazuje deficyt: zwiększ pewność ostrzeżenia o niedoborze wody; rozważ retencję i działania ograniczające straty, a nawadnianie tylko w zgodzie z analizą zapotrzebowania uprawy i pozostałymi ograniczeniami.
- Jeśli w profilach pozostaje wilgoć mimo sygnału stresu satelitarnego: zmniejsz pewność **hipotezy czysto wodnej** i zasugeruj sprawdzenie innych przyczyn (fenologia, choroby, składniki pokarmowe, zagęszczenie).
- Jeśli wyniki zależą mocno od miejsca lub tekstura jest nieznana: rezultat `inconclusive`, rekomendacja dodatkowych punktów.

**Tekst w aplikacji:** „Powierzchnia gleby jest sucha, ale na głębokości 20–40 cm próbka pozostaje wilgotniejsza. Nie oznacza to jeszcze, że roślina ma dostęp do tej wody. Weryfikujemy wnioski z danych satelitarnych, uwzględniając uprawę i rozwój korzeni”.

---

## 5. Eksperyment 3 — struktura gleby VESS

**Identyfikator:** `VESS`  
**Protokół CSV:** `SRUC_VESS` — metoda Visual Evaluation of Soil Structure, z kartą ocen 1–5 [S3].  
**Cel:** jakościowa ocena struktury uprawnej warstwy gleby, rozkładu korzeni, porowatości i podejrzenia zagęszczenia.

### 5.1. Po co i kiedy

- **Zaproponuj**, gdy występują koleiny, nierówny wzrost uprawy, słabe korzenienie, zastoiska albo infiltracja w niektórych punktach jest wolna.
- **Wykonuj na glebie umiarkowanie wilgotnej**, gdy bryły dają się rozdzielać ręcznie. Skrajnie sucha gleba może wyglądać na bardziej zwartą; mokra może się rozmazywać [S3].
- Nie stosuj ogólnego VESS dla głębokiego podglebia bez osobnej metody SubVESS. Test szpadlowy zwykle skupia się na warstwie około 30 cm.

### 5.2. Materiały, koszt i czas

Szpadel, linijka/taśma, folia lub tacka, karta VESS ze zdjęciami, aparat w telefonie (opcjonalny). **Koszt:** 0–100 zł. **Czas:** 15–30 minut na miejsce.

### 5.3. Instrukcja dla rolnika

1. Zaznacz 2–3 miejsca: typowe dla pola, podejrzane o zagęszczenie i — jeśli możliwe — strefę odniesienia o zbliżonej teksturze.
2. Obejrzyj powierzchnię: koleiny, skorupę, zastoiska, stan roślin. Zanotuj `surface_condition` i `measurement_position`.
3. Wykop szpadlem blok ziemi o głębokości około **30 cm**, przecinając trzy strony i pozostawiając jedną mniej naruszoną. Wyjmij i połóż na folii/tacce; zapisz `vess_block_depth_cm`.
4. Otwórz blok delikatnie rękami i poszukaj odmiennych warstw. Dla każdej można zanotować granice `vess_layer_top_cm`, `vess_layer_bottom_cm`.
5. Rozdzielaj bryły ręcznie. Oceniaj wielkość i kształt agregatów, łatwość kruszenia, widoczne pory i przebieg korzeni. Użyj **tej samej karty obrazkowej VESS** w każdej lokalizacji [S3].
6. Nadaj wynik `vess_layer_score` od 1 do 5 (w MVP **liczby całkowite**, bez autorskich połówek). Podaj `vess_overall_score` zgodnie z wybraną kartą i oceną wykonującego; jednocześnie pokaż **najgorszą warstwę** jako potencjalne ograniczenie.
7. Jeśli stwierdzisz wyraźną warstwę zwartą, zapisz `compacted_layer_top_cm`, `compacted_layer_bottom_cm`, a jeśli obserwujesz skręcanie/ograniczanie korzeni — `root_restriction_observed`.
8. Zapisz zdjęcie bloku i notatkę o miejscach szczególnych. Powtórz w kolejnych punktach.

### 5.4. Jak rozumieć skalę VESS

| `vess_overall_score` | Odczyt praktyczny | Sugerowany kierunek decyzji |
|---|---|---|
| **1** | Struktura bardzo dobra, krucha, dobrze porowata | Zwykle utrzymanie sposobu gospodarowania i monitoring |
| **2** | Struktura dobra | Utrzymanie praktyk, obserwacja przy zmianach agrotechniki |
| **3** | Struktura umiarkowana; możliwe ograniczenia | Ograniczyć ugniatanie na mokro; sprawdzić warstwę ograniczającą |
| **4** | Struktura słaba, zwięzła, mało porów | Wysoki priorytet diagnostyki warstwy i ochrony struktury gleby |
| **5** | Struktura bardzo słaba, mocno zbita/płytowa | Potwierdzić stan i dobrać celowane działania ze specjalistą/agronomem |

Klasy **1–2 dobra, 3 umiarkowana, 4–5 słaba** pochodzą z interpretacji AHDB/SRUC [S3]. To ocena wizualna, a nie bezpośredni pomiar oporu penetrometrem czy gęstości objętościowej. Występowanie warstwy zwięzłej nie oznacza automatycznie, że zabieg mechaniczny zawsze będzie najlepszym wyborem.

### 5.5. Pola i rekomendacje

**Pola:** `vess_block_depth_cm`, `vess_overall_score`, `vess_layer_top_cm`, `vess_layer_bottom_cm`, `vess_layer_score`, `compacted_layer_top_cm`, `compacted_layer_bottom_cm`, `root_restriction_observed`, `vess_structure_notes`.

- **Dobry VESS, wolna infiltracja:** zagęszczenie warstwy badanej metodą VESS staje się mniej oczywistym wyjaśnieniem; przeanalizuj zaskorupienie i warunki pomiaru.
- **Słaby VESS w koleinie, lepszy poza koleiną:** lokalnie mocniejsza przesłanka za ograniczeniem ugniatania i przejazdów po mokrej glebie.
- **Słaby VESS w wielu miejscach, korzenie ograniczone:** rozważ poprawę okrywy, strukturę płodozmianu i celowane działania — bez automatycznego zalecania głęboszowania.

**Tekst w aplikacji:** „W warstwie 12–23 cm oceniono strukturę na VESS 4/5: widoczne duże zbite bryły i ograniczenie korzeni. Wynik wspiera hipotezę o lokalnej warstwie ograniczającej. Zalecamy sprawdzenie rozległości problemu przed decyzją o zabiegu mechanicznym”.

---

## 6. Eksperyment 4 — stabilność agregatów (slake test)

**Identyfikator:** `SLAKE`  
**Protokół CSV:** `SARE_SLAKE` — wizualna metoda porównawcza oparta na opisie SARE [S4]; odmienne metody AHDB istnieją i **nie należy łączyć ich skali bez zgodności procedur** [S5].  
**Cel:** sprawdzić, czy wysuszone agregaty gleby zachowują spójność podczas gwałtownego zwilżenia, co daje przesłankę o zachowaniu struktury przy opadach.

### 6.1. Po co i kiedy

- **Zaproponuj** przy zaskorupieniu, śladach erozji, spływie mętnej wody, braku okrywy lub pytaniu o wpływ praktyk na strukturę.
- Metoda jest szczególnie dobra jako **porównanie dwóch podobnych gleb** pod różnym użytkowaniem lub pomiar tej samej strefy w kolejnych sezonach.
- Nie stosuj pojedynczej rozpadniętej bryłki jako dowodu na „brak próchnicy”. Stabilność zależy również od uziarnienia, minerałów ilastych, chemizmu, żelaza, biologii i przygotowania próbki [S4–S5].

### 6.2. Materiały, koszt i czas

Dwa przezroczyste słoiki/naczynia o objętości około 1 l, dwie siatki/koszyki utrzymujące bryły nad dnem, woda, stoper, szpadel. **Koszt:** 0–40 zł. **Czas pracy:** 15–30 minut, plus wysuszenie próbek **24–72 h** w temperaturze otoczenia, z obserwacją np. po 5 i 10 minutach oraz ewentualnie po 60 minutach i 24 godzinach [S4].

### 6.3. Instrukcja dla rolnika

1. Pobierz ostrożnie po jednej lub kilku reprezentatywnych bryłkach **z wierzchnich około 10 cm** gleby z dwóch porównywanych miejsc o możliwie podobnej teksturze. Protokół porównawczy SARE opisuje bryły w przybliżeniu **5–8 cm**; nie krusz ich celowo przed testem.
2. Oznacz pochodzenie próbek; pozostaw je do **suszenia na powietrzu przez 24–72 godziny** aż będą wyraźnie suche w dotyku. Zapisz `initial_aggregate_condition=air_dried`, `aggregate_air_dry_hours` i przybliżoną `aggregate_diameter_mm`.
3. Przygotuj jednakowe naczynia i tę samą wodę (`slake_water_type`). Umieść siatki w wodzie, by bryły były pod powierzchnią, a nie leżały bezpośrednio na dnie.
4. Włóż bryły na siatki, uruchom timer; **nie mieszaj, nie potrząsaj i nie dociskaj** próbek.
5. Oceniaj po **300 s (5 min)** i **600 s (10 min)**; opcjonalnie po **3600 s i 86400 s**. Każda obserwacja to osobny rekord (`reading_at`, `slake_observation_time_s`).
6. Zapisz `slake_result_class` i opcjonalnie `slake_turbidity_class`. Zrób zdjęcia na początku i w tych samych punktach czasowych.
7. Porównuj wyniki tylko w tych samych chwilach, przy zbliżonej wielkości, teksturze, stanie wysuszenia i rodzaju wody. Jeśli rozpad zaczyna się jeszcze przed stabilnym zanurzeniem, zanotuj to w komentarzu.

### 6.4. Skala obserwacyjna w MVP (własna, nie punktacja SARE)

| `slake_result_class` | Opis w formularzu | Interpretacja pomocnicza |
|---|---|---|
| `intact` | Bryłka zachowała kształt | Wysoka obserwowana odporność na rozpad w tej próbie |
| `surface_cracks` | Powierzchniowe pęknięcia, rdzeń pozostaje | Niewielkie uszkodzenie |
| `partial_disintegration` | Część bryłki rozpada się | Umiarkowany rozpad |
| `major_disintegration` | Rozpadła się większość bryłki | Duża podatność na rozpad w warunkach testu |
| `fully_disintegrated` | Bryłka praktycznie całkiem się rozpadła | Bardzo duża podatność na rozpad w warunkach testu |
| `unclear` | Obserwacja niemożliwa | Wynik nierozstrzygający |

Wyróżniaj **stan agregatu** od **zmętnienia wody** (to osobne pola). Nie uzupełniaj `slake_score` w MVP: bez jawnego, zwalidowanego systemu punktacji pozostaw `NULL`. Kategoriom z tabeli **nie należy** nadawać arbitralnie wartości 1–5 i nazywać ich oficjalną oceną USDA/SARE.

### 6.5. Pola i rekomendacje

**Pola:** `initial_aggregate_condition`, `aggregate_diameter_mm`, `aggregate_air_dry_hours`, `slake_water_type`, `slake_observation_time_s`, `slake_result_class`, `slake_turbidity_class`, `slake_score` (na razie puste).

- Jeśli bryły z pola rozpadają się szybciej niż z odpowiednio dobranej strefy odniesienia, jest to **przesłanka** do sprawdzenia wpływu okrywy, resztek i sposobu uprawy na strukturę.
- Jeśli bryły z pola pozostają stabilne, nie oznacza to automatycznie braku erozji ani wystarczającej retencji: wynik dotyczy jednego mechanizmu.
- Jeśli tekstura, wilgotność początkowa, wielkość brył lub czas obserwacji są różne, oznacz porównanie jako `needs_review` lub `inconclusive`.

**Tekst w aplikacji:** „Po 5 minutach agregat z pola częściowo się rozpadł, a próbka porównawcza pozostała spójna. Może to wskazywać na różnice w odporności struktury na gwałtowne zwilżenie. Nie jest to bezpośredni pomiar próchnicy ani szybkości infiltracji”.

---

## 7. Eksperyment 8 — lokalny deszczomierz

**Identyfikator:** `RAINFALL`  
**Protokół CSV:** `MANUAL_RAIN_GAUGE` — regularne odczyty manualnego przyrządu według zasad obserwacji opadów [S6–S7].  
**Cel:** zebrać lokalną sumę opadu z **jawnego przedziału czasowego** i zestawić ją z modelową sumą dla tego samego okresu.

### 7.1. Po co i kiedy

- **Zaproponuj**, kiedy obszar doświadcza lokalnych opadów konwekcyjnych, modelowe sumy opadów wydają się sprzeczne z obserwacjami rolnika, lub ważne są dokładniejsze lokalne dane do przyszłych analiz.
- To **monitoring**, a nie krótkotrwały eksperyment przyczynowo-skutkowy. Wartość rośnie wraz z długością i regularnością serii.
- Nie porównuj pomiaru z godz. 08:00–08:00 z sumą modelu z północy do północy bez poprawnego przeliczenia interwałów.

### 7.2. Materiały, koszt, stanowisko

Prosty deszczomierz manualny ze skalą w mm, pionowy stabilny uchwyt, dostęp do stałej pory odczytu. **Budżet:** 20–60 zł. **Czas:** kilka minut dziennie, przez wiele dni/tygodni.

**Ustawienie:** otwarta, bezpieczna, możliwie pozioma przestrzeń; z dala od drzew, budynków, płotów i zraszaczy. Jako zasada jakościowa, **preferuj odległość od przeszkody rzędu co najmniej dwukrotności wysokości przeszkody ponad wlot przyrządu**, kiedy warunki lokalne pozwalają [S7]. Przyrząd powinien stać pionowo i mieć niezakryty wlot. Brak idealnego miejsca oznacz jako ograniczenie, nie ukrywaj go.

### 7.3. Instrukcja dla rolnika

1. Zamontuj przyrząd i nadaj mu `rain_gauge_id`. Wybierz stałą porę odczytu (np. codziennie około 08:00 **czasu lokalnego**). Zapisuj rzeczywiste czasy, z uwzględnieniem zmiany czasu letniego/zimowego.
2. Na początku pomiarów opróżnij przyrząd, zanotuj `rainfall_period_start` (od tego momentu zbiera wodę).
3. Przy następnym odczycie odczytaj sumę bez rozlewania i zapisz `rain_gauge_precip_mm` oraz `rainfall_period_end`. **0 mm jest poprawnym wynikiem, gdy rzeczywiście nie padało.**
4. Oceń, czy doszło do przepełnienia (`rain_gauge_overflow`), przechylenia, rozlania, zacienienia, parowania, śniegu lub lodu (`rain_gauge_interference`).
5. Po odczycie opróżnij przyrząd i ustaw `gauge_emptied_after_reading=true`; nowy przedział zaczyna się wtedy, nie automatycznie o północy.
6. Jeśli pominiesz jeden dzień, zapisz **sumę z całego dłuższego okresu**, nie rozdzielaj jej arbitralnie na dni. Jeżeli część wody wylano lub się przelała, wynik jest niepełny.
7. Zapisz lokalizację deszczomierza; może znajdować się **poza badaną działką** — wtedy potrzebna jest informacja o odległości i otoczeniu, aby nie przypisywać bezrefleksyjnie pomiaru każdej działce.

### 7.4. Obliczenia i porównanie z modelem

```text
P_local_mm = rain_gauge_precip_mm
P_model_mm = model_precip_same_period_mm
DeltaP_mm = P_local_mm - P_model_mm
```

`P_model_mm` obliczaj dla **dokładnie** tego samego okresu `[rainfall_period_start, rainfall_period_end)` i możliwie tej samej lokalizacji. Jeśli używane serie mają jedynie rozdzielczość dobową, a pora odczytu nie pokrywa granic doby źródła, pokaż ostrzeżenie o niedopasowaniu zamiast tworzyć fałszywą dokładność. Godziny i strefa czasowa mają znaczenie. Nie porównuj `precip_sum_7d_mm` bez upewnienia się, że to to samo okno.

**Przykład:** 14,0 mm z przyrządu i 9,0 mm z modelu w tym samym przedziale daje `rainfall_model_difference_mm=+5,0 mm`. To jest **różnica pojedynczej obserwacji**, a nie stała poprawka +5 mm do przyszłych opadów.

### 7.5. Pola i rekomendacje

**Pola:** `rain_gauge_id`, `rainfall_period_start`, `rainfall_period_end`, `rain_gauge_precip_mm`, `rain_gauge_overflow`, `rain_gauge_interference`, `gauge_emptied_after_reading`, `model_precip_same_period_mm`, `rainfall_model_difference_mm`.

- **Seria pomiarów potwierdza model:** rośnie zaufanie do lokalnych danych opadowych **w ocenianym zakresie**, nie do wszystkich parametrów modelu.
- **Duże rozbieżności w kilku poprawnych pomiarach:** wskaż możliwy lokalny błąd opadów; rozważ kilka źródeł meteorologicznych i ostrożniejszą diagnozę bilansu wodnego.
- **Przelew, zasłonięty wlot, wielodniowa przerwa, śnieg bez procedury pomiaru:** oznacz wątpliwą jakość; brak automatycznej korekty w mm.

**Tekst w aplikacji:** „Twój deszczomierz zarejestrował 14 mm, a dane pogodowe dla tego samego okresu — 9 mm. Różnica wynosi +5 mm. Sprawdzimy kolejne poprawne odczyty, zanim zmienimy sposób oceny opadów dla tej działki”.

---

## 8. Zapis w bazie: jak korzystać z CSV

### 8.1. Relacje

```text
parcels (istniejąca tabela)
  └── field_experiments                       1 eksperyment = zdarzenie terenowe
        experiment_id UUID (PK)
        parcel_id (FK -> parcels)
        experiment_type
        method_id, method_version
        measured_at, measurement_location
        experiment_status, quality_status
        model_assessment_id, hypothesis_code, hypothesis_assessment
        ...
        └── experiment_measurements            1..N odczytów, cykli, warstw lub punktów
              measurement_id UUID (PK)
              parent_experiment_id UUID (FK -> field_experiments.experiment_id)
              replicate_no, reading_at
              [pola danego testu zgodnie z CSV]
```

**Istotne implementacyjnie:** w CSV nazwa klucza obcego to **`parent_experiment_id`**, a nie powtórzony `experiment_id`. `replicate_no` oznacza powtórzenie pomiarowe, a `infiltration_cycle_no` — kolejną porcję wody **w obrębie danego punktu**. Dla VESS osobny rekord może opisywać warstwę. Dla wilgotności — przedział głębokości. Dla slake — ustalony moment obserwacji. Dla deszczomierza — odrębny okres opadu.

Jeżeli w MVP używasz `jsonb` dla pól specyficznych, zachowaj **te same nazwy kluczy i walidacje** co w CSV; nie zamieniaj wszystkich wartości na tekst bez typów. `experiment_measurements` może mieć kolumny wspólne oraz kolumnę `payload jsonb`, ale dojrzała baza szeregów opadowych skorzysta z dedykowanej tabeli.

### 8.2. Jak rozumieć priorytety i pola wyliczane

- `P0` w katalogu oznacza krytyczność dla danego etapu/odczytu, **nie** że rolnik wpisuje wszystkie pola P0 ręcznie. `experiment_id`, `method_id`, `measured_at`, `created_at` generuje aplikacja.
- `infiltration_rate_mm_h` jest P0, ale wynik jest **wyliczany** tylko dla poprawnego cyklu `fully_absorbed`. W przeciwnym przypadku `NULL`.
- `slake_score` pozostaje `NULL`, dopóki nie zaimplementowano formalnej punktacji zgodnej z metodą i jej wersją.
- `model_precip_same_period_mm` i `rainfall_model_difference_mm` są wyliczeniami, a nie wpisami rolnika.
- Wszystkie pola w tabelach docelowych powinny być rozróżnione od istniejących zmiennych publicznych (np. `soil_moisture_*`, `precipitation_mm`, `saturated_hydraulic_conductivity`).

### 8.3. Typy zdarzeń i wartości słownikowe

- `experiment_type`: `INFILTRATION`, `SOIL_MOISTURE`, `VESS`, `SLAKE`, `RAINFALL`.
- `experiment_status`: `draft`, `in_progress`, `completed`, `invalidated`.
- `quality_status`: `unverified`, `accepted`, `needs_review`, `rejected`.
- `hypothesis_code`: `LOW_INFILTRATION`, `DRY_ROOT_ZONE`, `SOIL_COMPACTION`, `AGGREGATE_INSTABILITY`, `LOCAL_RAINFALL_BIAS`, `OTHER`.
- `hypothesis_assessment`: `supports`, `contradicts`, `inconclusive`, `not_assessed`.
- `method_id` w pierwszej wersji: `NRCS_SINGLE_RING`, `NRCS_FEEL`, `SRUC_VESS`, `SARE_SLAKE`, `MANUAL_RAIN_GAUGE`.
- `method_version`: przypinana na stałe przy rozpoczęciu testu, np. `1.0.0`. Zmiana procedury wymaga nowej wersji i opisania migracji porównywalności.

**Stan kontra jakość:** `completed` oznacza zakończenie przez rolnika, lecz nie automatycznie `accepted`. Możliwy jest `completed` + `needs_review` lub `rejected`.

---

## 9. Walidacja i niepewność — reguły MVP

### 9.1. Reguły twarde (blokują automatyczne wyliczenie wyniku)

| Test | Warunek | Działanie |
|---|---|---|
| Infiltracja | `ring_diameter_cm<=0`, `water_volume_ml<=0` albo `infiltration_time_s<=0` przy pełnym wsiąknięciu | Nie licz `infiltration_rate_mm_h` |
| Infiltracja | `infiltration_cycle_status` inny niż `fully_absorbed` | Nie licz dokładnej szybkości; zachowaj status i limit czasu |
| Wilgotność | `sample_depth_top_cm >= sample_depth_bottom_cm` | Błąd formularza |
| VESS | Ocena nie jest liczbą 1–5 zgodną z wersją metody albo głębokość warstwy niepoprawna | Błąd lub odrzucenie oceny |
| Slake | Brak kategorii/ czasu obserwacji; uszkodzona próbka przed zanurzeniem | Brak wiarygodnej klasy; `needs_review` |
| Opady | `rainfall_period_end <= rainfall_period_start` albo `rain_gauge_precip_mm<0` | Błąd formularza |
| Opady | Przelew lub istotne zakłócenie | Nie wykorzystuj do kalibracji; zachowaj jako niepełną obserwację |
| Wszystkie | Brak `parcel_id` lub niepoprawna metoda | Nie przypisuj wyników do diagnozy działki |

### 9.2. Reguły miękkie (ostrzeżenia, nie „magiczne” obniżanie liczby)

| Flaga w `quality_flags` | Znaczenie | Zalecane zachowanie |
|---|---|---|
| `single_replicate` | Jedyny punkt/powtórzenie | Interpretuj jako lokalne |
| `unknown_soil_texture` | Brak tekstury dla metody dotykowej | Wynik mniej wiarygodny, często `inconclusive` |
| `missing_pre_wet` | Brak opisu wstępnego zwilżenia przy infiltracji | Nie porównuj bezrefleksyjnie z innymi próbami |
| `leakage` | Przeciek przy pierścieniu | Odrzuć obliczoną szybkość |
| `unmatched_conditions` | Różne warunki porównywania | Nie uśredniaj / nie wyciągaj wniosku A/B |
| `sample_preparation_unknown` | Niezgodne próbki slake | `needs_review` |
| `overflow` | Deszczomierz przelany | Zaniżona / niekompletna suma |
| `long_interval` | Długi interwał pomiaru opadu | Nie przypisuj sumy do jednej doby |
| `model_time_mismatch` | Okna czasowe obserwacji i modelu niezgodne | Bez `rainfall_model_difference_mm` |
| `historical_time_mismatch` | Pomiar wykonano po analizowanym dniu historycznym | Nie używaj do rekonstrukcji stanu tego dnia |

Te flagi są **propozycją standardu aplikacji**, a nie formalnym zestawem KOWR. Warto je dokumentować jako część `method_version`.

### 9.3. Trzy poziomy twierdzeń w raporcie

1. **Obserwacja (surowy fakt):** „W 20 minut wsiąkło 444 ml w pierścieniu o średnicy 15 cm”.
2. **Ostrożny wniosek:** „Szybkość w tym cyklu wynosiła około 75 mm/h; nie znamy zachowania całej działki”.
3. **Rekomendacja do rozważenia:** „Porównaj wyniki poza koleiną i w koleinie; przy utrzymującym się problemie oceń strukturę VESS i ogranicz ugniatanie”.

Nie przechodź bezpośrednio od jednego pomiaru do kategorycznego „przyczyna na całym polu” lub do przeliczenia wzrostu plonu.

---

## 10. Wpływ testu na rekomendację (przed / po)

| Test | Co można aktualizować | Czego nie należy automatycznie zmieniać |
|---|---|---|
| `INFILTRATION` | Ocena miejscowego problemu infiltracji, potrzeba testu VESS, ostrożność przy ocenie spływu | `saturated_hydraulic_conductivity` w źródłowej bazie; cała retencja działki |
| `SOIL_MOISTURE` | Wiarygodność rozpoznania wilgotności w **zbadanych warstwach** | Modelowe wartości m³/m³, potrzeba nawadniania w mm bez kalibracji |
| `VESS` | Lokalna ocena warstw ograniczających, priorytet ochrony struktury | Gęstość objętościowa `bulk_density_g_cm3` jako „zmierzona” |
| `SLAKE` | Ocena rozpadu agregatów przy zwilżeniu, rekomendacje okrywy gleby | Dokładna zawartość próchnicy / stałe współczynniki erozji |
| `RAINFALL` | Zaufanie do lokalnej serii opadowej, rozbieżności z modelem w odpowiednim okresie | Trwały bias modelu na podstawie 1 odczytu, historyczne opady z innych dni |

**Reguła aktualizacji:**

```text
1. calculate_base_assessment(parcel, analysis_date, crop, public_data)
2. derive_hypotheses(assessment, limitations)
3. offer_optional_experiment(one_hypothesis, feasibility)
4. collect_raw_measurements(method_version)
5. validate_measurements() -> quality_status + quality_flags
6. interpret(observations, texture, weather, season, place, data_quality)
7. if reliable AND temporally relevant:
       update_diagnostic_confidence_and_recommendations()
   else:
       attach_evidence_with_limitations_without_overriding_base_report()
8. save_before_after + explanation + sources
```

Nie zakładaj z góry zysków z retencji w m³/ha ani wzrostu plonu w procentach: do tego potrzeba innych danych i modelu zweryfikowanego empirycznie.

---

## 11. Propozycja interfejsu użytkownika

**Karta propozycji:** „Z danych wynika X, ale nie wiemy Y. Zrób test Z. Materiały: …; koszt: …; czas: …; opcja «Pomiń»”.

**Kreator testu (5 ekranów):**

1. **Dlaczego?** Problem na wybranej działce, hipoteza, czego test *nie* wykaże.
2. **Przygotowanie:** sprzęt, koszt, bezpieczeństwo, odpowiednia pora, plan punktów.
3. **Wykonaj:** ilustrowana instrukcja krok po kroku dla `method_id`/`method_version`.
4. **Wpisz wyniki:** tylko pola P0 i wybrane P1 właściwe dla testu; walidacja jednostek i opcje typu „nie wsiąkło”, „nie wiem”, „przyrząd przelany”.
5. **Interpretacja:** surowy wynik + jakość + ograniczenia + co zmieniło się w rekomendacji; opcja zapisu, eksportu i poprawki obserwacji bez usuwania historii.

**Przydatne praktyki UI:** wymiary wyraźnie w cm/mm, nie ukrywaj warunków mierzenia, opcjonalne zdjęcia, możliwość odroczenia, brak wymuszania GPS i zgody na publikację. Jeśli wynik jest niepewny, pokaż „nie da się rozstrzygnąć na podstawie tego testu”, nie czerwoną ocenę gleby.

---

## 12. Plan wdrożenia na hackathon i kryteria akceptacji

### 12.1. Minimum gotowe do demonstracji

- [ ] Bazowy raport KOWR działa bez testu dla dowolnej działki i dozwolonej daty.
- [ ] Działa rekomendacja **jednego** uzasadnionego testu; użytkownik może go pominąć.
- [ ] Formularze obsługują **wszystkie pięć kodów** i walidują pola P0.
- [ ] Infiltracja obsługuje 2+ cykle, różne średnice, brak pełnego wsiąknięcia, przeciek i obliczenie mm/h tylko dla poprawnego cyklu.
- [ ] Wilgotność przyjmuje kilka głębokości i nie zamienia klas dotykowych w fałszywe procenty.
- [ ] VESS obsługuje wynik 1–5, warstwy i oznaczenie warstwy ograniczającej.
- [ ] Slake przechowuje czas obserwacji i klasy rozpadu; nie wymyśla `slake_score`.
- [ ] Deszczomierz obsługuje zero opadu, rzeczywisty przedział pomiarowy, zakłócenia i porównanie do tego samego okna modelowego.
- [ ] Wyniki mają `method_version`, status jakości i powiązanie z działką; możliwy ponowny odczyt w czasie.
- [ ] Raport pokazuje stan „przed/po”, informację o niepewności i aktualne źródła danych.

### 12.2. Przykładowe przypadki testowe automatyczne

| Scenariusz | Oczekiwane zachowanie |
|---|---|
| Infiltracja: d=15 cm, V=444 ml, t=1200 s, `fully_absorbed` | `infiltration_rate_mm_h≈75,4` dla tego cyklu |
| Infiltracja: `not_absorbed_within_limit`, 3600 s limit | `infiltration_rate_mm_h=NULL` |
| Infiltracja: t=0 lub d=0 | Błąd walidacji |
| Wilgotność: top=20, bottom=10 | Błąd walidacji głębokości |
| Wilgotność: nieznana tekstura i `sucha` | Zapis obserwacji z ostrzeżeniem; bez przeliczenia na m³/m³ |
| VESS: ocena 6 | Odrzuć wynik poza skalą |
| VESS: warstwa 10–20 cm VESS 4, reszta VESS 2 | Zapisz ograniczającą warstwę; nie ukrywaj jej średnią |
| Slake: `field_moist` vs `air_dried` | Nie porównuj bez uwagi o niezgodności przygotowania |
| Slake: brak oficjalnej skali punktowej | `slake_score=NULL` |
| Deszczomierz: 0,0 mm przy prawidłowym odczycie | Poprawny zerowy opad, nie NULL |
| Deszczomierz: start >= end | Błąd walidacji |
| Deszczomierz: przepełniony | Odrzuć z automatycznej kalibracji |
| Deszczomierz: 14 mm, model 9 mm, to samo okno | `rainfall_model_difference_mm=5` |
| Deszczomierz: model tylko dobowy 00:00–00:00, odczyt 08:00–08:00 | Flaga `model_time_mismatch`; bez fałszywej dokładności |
| Analiza historyczna: pomiar terenowy wykonany po dacie analizy | Pomiar nie jest dowodem stanu w przeszłości |

### 12.3. Co ewentualnie dodać po MVP

Nie jest niezbędne do startu; sugerowane, jeśli zbierane będą dane w skali kraju:

- Oddzielna tabela `rain_gauges` z lokalizacją przyrządu, typem, datą montażu i informacjami o osłonięciu; w CSV istnieje jedynie `rain_gauge_id`.
- Indywidualne `reading_quality_flags` dla **pojedynczego** odczytu, gdy różne powtórzenia tego samego eksperymentu mają odmienną jakość (obecne `quality_flags` dotyczą eksperymentu).
- Jawna informacja o **zastosowanym okresie suszenia próbek slake** oraz teksturze próbki w punktach porównywanych; część zapisana już w CSV, część można dziedziczyć z paszportu i uzupełniać na miejscu.
- Rozdzielenie lokalizacji deszczomierza od punktu działki oraz praw dostępu do danych lokalizacyjnych; nie publikuj precyzyjnych współrzędnych na podstawie samej zgody na analizy zbiorcze.
- Pełne wersjonowanie raportów, źródeł danych i procedur; mechanizmy audytu zmian i wycofania zgody.

---

## 13. Zgodność z wymaganiami KOWR — lista kontrolna

| Wymóg zadania | Jak realizuje go Pocket Soil Lab |
|---|---|
| Analiza bieżąca i historyczna na podstawie 10 lat danych | Pozostaje w **bazowym silniku analizy**; test nie zastępuje szeregu historycznego |
| Dane satelitarne + pogoda + gleby + hydrologia + teren | Dane kontekstowe do postawienia hipotezy; pomiar jest dodatkowy |
| Analiza przyczyn przed rekomendacją | Test weryfikuje wskazaną niepewną przyczynę, a nie generuje działania bez diagnozy |
| Retencja i agrotechnika przed ewentualnym nawadnianiem | Aktualizacja rekomendacji zachowuje tę kolejność |
| Wynik wraz z datą, źródłami i niepewnością | `measured_at`, `method_id`, `method_version`, `quality_flags`, wersja raportu |
| Łatwość obsługi, brak specjalistycznego sprzętu | Testy opcjonalne, materiały tanie, instrukcje prowadzone krok po kroku |
| Możliwość raportu / eksportu | Eksport pomiarów i zaktualizowanego raportu z ograniczeniami |
| Walidacja dla wskazanych przez jury działek i dat historycznych | Brak zależności od aktywności rolnika; bez przecieku wiedzy z przyszłych pomiarów |

---

## 14. Źródła i status metodyczny

Materiały źródłowe należy wymienić w README wraz z datą weryfikacji i warunkami wykorzystania; **link do procedury nie oznacza automatycznie prawa do kopiowania zdjęć lub pełnych kart źródłowych do aplikacji**. W MVP najlepiej przygotować własne schematy i opisy kroków z podaniem autorów metody, bez kopiowania cudzych ilustracji.

- **[K1]** KOWR / HackNation 2026, `KOWR_zadanie_konkursowe.md`, zwłaszcza rozdziały 3, 5, 6 i 7 (dostarczony plik projektu).
- **[K2]** KOWR, `KOWR - Podstawy naukowe.md`, sekwencja diagnoza → przyczyny → retencja → agrotechnika → ewentualnie nawadnianie (dostarczony plik projektu).
- **[D1]** `paszport_pola_eksperymenty.csv` — katalog **68 pól / 29 kolumn opisowych**, definicje typów, enumów i metadanych (dostarczony plik projektu).
- **[D2]** `paszport_pola_katalog_danych.csv` oraz `paszport_pola_15_danych_od_rolnika.csv` — publiczne i deklarowane zmienne porównawcze (dostarczone pliki projektu).
- **[S1]** USDA-NRCS, *Soil Health – Infiltration* (2014), procedura jednopierścieniowa, 444 ml dla wzorcowego pierścienia, cykle i powtórzenia: https://www.nrcs.usda.gov/sites/default/files/2022-10/Soil%20Infiltration.pdf
- **[S2]** USDA-NRCS, *Guide for Estimating Soil Moisture Conditions / Feel and Appearance*: https://www.nrcs.usda.gov/sites/default/files/2023-01/Estimating-Soil-Moinsture-By-Feel-And-Appearance.pdf oraz opis metody w Virginia Tech Extension: https://www.pubs.ext.vt.edu/content/pubs_ext_vt_edu/en/BSE/BSE-338/BSE-338.html
- **[S3]** AHDB / SRUC, *How to assess soil structure* — procedura VESS i klasy 1–5: https://ahdb.org.uk/knowledge-library/how-to-assess-soil-structure
- **[S4]** SARE, *Farming with Soil Life — Observing Soil Life*, sekcja Slake Test (agregaty ok. 5–8 cm, suszenie 24–72 h, odczyty 5 min, 10 min, 1 h i 24 h): https://www.sare.org/publications/farming-with-soil-life/observing-soil-life/
- **[S5]** AHDB, *Measure aggregate stability to detect changes in soil health early*, różnice protokołów slake i zalecenie konsekwencji metody: https://ahdb.org.uk/knowledge-library/measure-aggregate-stability-to-detect-changes-in-soil-health-early
- **[S6]** Community Collaborative Rain, Hail & Snow Network (CoCoRaHS), zasady regularnego mierzenia i opróżniania deszczomierza: https://www.cocorahs.org/Content.aspx?page=mod_measurements
- **[S7]** USGS, *Siting of Precipitation Gages*, zasady odległości od przeszkód: https://water.usgs.gov/water-resources/memos/memo.php?id=654

**Stan sprawdzenia źródeł internetowych:** 21 listopada 2026 r. Ceny, czas pracy, system flag, formularze i reguły priorytetyzacji są **orientacyjnymi założeniami projektowymi**, a nie bezpośrednim cytatem z publikacji.

---

## Aneks A. Komplet pól z `paszport_pola_eksperymenty.csv`

Poniższa tabela jest generowana **bezpośrednio** z CSV. Jest to mapa kodowa do backendu i formularzy; obowiązujące szczegóły walidacji, pytania dla rolnika i uwagi pozostają w CSV, które jest źródłem prawdy dla schematu.

### Pola wspólne (25 pól)

| `pole_db` | Znaczenie | Typ | Jednostka | Prio | Etap |
|---|---|---|---|---|---|
| `experiment_id` | Identyfikator eksperymentu | `uuid` | — | P0 | ID |
| `parcel_id` | Pełny identyfikator działki EGiB | `text` | — | P0 | ID |
| `experiment_type` | Kod wykonanego testu | `text` | — | P0 | ID |
| `experiment_status` | Status realizacji eksperymentu | `text` | — | P0 | KONTROLA |
| `method_id` | Identyfikator metody / protokołu | `text` | — | P0 | METODA |
| `method_version` | Wersja procedury pomiarowej | `text` | — | P0 | METODA |
| `measured_at` | Data i czas pomiaru / rozpoczęcia testu | `timestamptz` | — | P0 | METODA |
| `measurement_location` | Punkt pomiarowy w układzie PL-1992 | `geometry(Point,2180)` | — | P1 | METODA |
| `location_accuracy_m` | Dokładność lokalizacji pomiaru | `numeric(8,2)` | m | P2 | METODA |
| `measurement_position` | Typ miejsca na polu | `text` | — | P1 | METODA |
| `surface_condition` | Stan powierzchni w miejscu testu | `text` | — | P1 | METODA |
| `weather_notes` | Pogoda i wilgotność bezpośrednio przed testem | `text` | — | P2 | METODA |
| `experiment_notes` | Notatka terenowa | `text` | — | P2 | METODA |
| `photo_uris` | Odnośniki do zdjęć pomiaru | `jsonb` | — | P2 | METODA |
| `quality_status` | Status jakości i walidacji wyniku | `text` | — | P0 | KONTROLA |
| `quality_flags` | Lista ostrzeżeń dotyczących jakości | `jsonb` | — | P1 | KONTROLA |
| `model_assessment_id` | Identyfikator analizy danych publicznych przed testem | `uuid` | — | P1 | POWIAZANIE_Z_ANALIZA |
| `hypothesis_code` | Hipoteza weryfikowana przez eksperyment | `text` | — | P1 | POWIAZANIE_Z_ANALIZA |
| `hypothesis_assessment` | Wynik testu względem hipotezy | `text` | — | P2 | INTERPRETACJA |
| `created_at` | Czas utworzenia rekordu | `timestamptz` | — | P0 | ID |
| `consent_aggregated_use` | Zgoda na wtórne wykorzystanie zanonimizowanych / zagregowanych wyników | `boolean` | — | P1 | PRYWATNOSC |
| `measurement_id` | Identyfikator pojedynczego odczytu / warstwy | `uuid` | — | P0 | ID |
| `parent_experiment_id` | Powiązanie odczytu z eksperymentem | `uuid` | — | P0 | ID |
| `replicate_no` | Numer powtórzenia w miejscu/teście | `integer` | — | P0 | METODA |
| `reading_at` | Data i czas odczytu/wprowadzenia | `timestamptz` | — | P1 | METODA |

### 1. Infiltracja (10 pól)

| `pole_db` | Znaczenie | Typ | Jednostka | Prio | Etap |
|---|---|---|---|---|---|
| `ring_diameter_cm` | Średnica WEWNĘTRZNA pierścienia | `numeric(6,2)` | cm | P0 | DANE_SUROWE |
| `ring_insertion_depth_cm` | Głębokość wbicia pierścienia | `numeric(6,2)` | cm | P1 | DANE_SUROWE |
| `infiltration_cycle_no` | Numer cyklu wlania porcji wody | `smallint` | — | P0 | DANE_SUROWE |
| `water_volume_ml` | Objętość wlanej wody w cyklu | `numeric(8,2)` | ml | P0 | DANE_SUROWE |
| `infiltration_time_s` | Czas pełnego wsiąkania porcji | `numeric(10,2)` | s | P0 | DANE_SUROWE |
| `infiltration_cycle_status` | Czy woda wsiąkła do końca w danym cyklu? | `text` | — | P0 | DANE_SUROWE |
| `observation_limit_s` | Czas obserwacji niedokończonego wsiąkania | `numeric(10,2)` | s | P1 | DANE_SUROWE |
| `prewetting_done` | Wykonano wstępne zwilżenie gleby | `boolean` | — | P0 | DANE_SUROWE |
| `initial_soil_moisture_class` | Wilgotność gleby przed testem (orientacyjna) | `text` | — | P1 | DANE_SUROWE |
| `infiltration_rate_mm_h` | Przeliczona średnia szybkość wsiąkania w cyklu | `numeric(12,3)` | mm/h | P0 | WYNIK_OBLICZONY |

### 2. Wilgotność profilu (7 pól)

| `pole_db` | Znaczenie | Typ | Jednostka | Prio | Etap |
|---|---|---|---|---|---|
| `sample_depth_top_cm` | Górna granica głębokości próbki | `numeric(6,1)` | cm | P0 | DANE_SUROWE |
| `sample_depth_bottom_cm` | Dolna granica głębokości próbki | `numeric(6,1)` | cm | P0 | DANE_SUROWE |
| `soil_texture_at_depth` | Orientacyjna tekstura próbki na danej głębokości | `text` | — | P1 | DANE_SUROWE |
| `moisture_feel_class` | Klasa wilgotności oceniona dłonią | `text` | — | P0 | DANE_SUROWE |
| `soil_ball_formation` | Czy próbka tworzy kulkę po ściśnięciu? | `text` | — | P1 | DANE_SUROWE |
| `soil_consistency_notes` | Opis wyglądu i konsystencji gleby | `text` | — | P2 | DANE_SUROWE |
| `root_presence_class` | Obserwowana liczebność korzeni w próbce | `text` | — | P2 | DANE_SUROWE |

### 3. VESS (9 pól)

| `pole_db` | Znaczenie | Typ | Jednostka | Prio | Etap |
|---|---|---|---|---|---|
| `vess_block_depth_cm` | Głębokość ocenianego bloku gleby | `numeric(6,1)` | cm | P1 | DANE_SUROWE |
| `vess_overall_score` | Ogólna ocena VESS dla bloku | `numeric(3,1)` | skala 1–5 | P0 | DANE_SUROWE |
| `vess_layer_top_cm` | Górna granica ocenianej warstwy VESS | `numeric(6,1)` | cm | P1 | DANE_SUROWE |
| `vess_layer_bottom_cm` | Dolna granica ocenianej warstwy VESS | `numeric(6,1)` | cm | P1 | DANE_SUROWE |
| `vess_layer_score` | Ocena VESS dla wydzielonej warstwy | `numeric(3,1)` | skala 1–5 | P1 | DANE_SUROWE |
| `compacted_layer_top_cm` | Górna granica zauważonej warstwy zagęszczonej | `numeric(6,1)` | cm | P1 | DANE_SUROWE |
| `compacted_layer_bottom_cm` | Dolna granica zauważonej warstwy zagęszczonej | `numeric(6,1)` | cm | P1 | DANE_SUROWE |
| `root_restriction_observed` | Zaobserwowano ograniczenie penetracji korzeni | `boolean` | — | P1 | DANE_SUROWE |
| `vess_structure_notes` | Opis brył, porów i ułożenia korzeni | `text` | — | P2 | DANE_SUROWE |

### 4. Slake test (8 pól)

| `pole_db` | Znaczenie | Typ | Jednostka | Prio | Etap |
|---|---|---|---|---|---|
| `initial_aggregate_condition` | Stan bryłki przed zanurzeniem | `text` | — | P0 | DANE_SUROWE |
| `aggregate_diameter_mm` | Przybliżona średnica badanej bryłki | `numeric(6,1)` | mm | P1 | DANE_SUROWE |
| `aggregate_air_dry_hours` | Czas suszenia próbki w powietrzu | `numeric(6,1)` | h | P1 | DANE_SUROWE |
| `slake_water_type` | Rodzaj wody wykorzystanej w teście | `text` | — | P2 | DANE_SUROWE |
| `slake_observation_time_s` | Czas od zanurzenia do oceny | `integer` | s | P0 | DANE_SUROWE |
| `slake_result_class` | Stan bryłki po zanurzeniu | `text` | — | P0 | DANE_SUROWE |
| `slake_turbidity_class` | Zmętnienie wody w pojemniku | `text` | — | P2 | DANE_SUROWE |
| `slake_score` | Punktowy wynik testu stabilności | `numeric(4,1)` | skala protokołu | P2 | WYNIK_OBLICZONY |

### 8. Deszczomierz (9 pól)

| `pole_db` | Znaczenie | Typ | Jednostka | Prio | Etap |
|---|---|---|---|---|---|
| `rain_gauge_id` | Identyfikator manualnego deszczomierza | `text` | — | P1 | DANE_SUROWE |
| `rainfall_period_start` | Początek okresu zbierania opadu | `timestamptz` | — | P0 | DANE_SUROWE |
| `rainfall_period_end` | Koniec okresu zbierania opadu | `timestamptz` | — | P0 | DANE_SUROWE |
| `rain_gauge_precip_mm` | Zarejestrowany lokalny opad | `numeric(8,2)` | mm | P0 | DANE_SUROWE |
| `rain_gauge_overflow` | Podejrzenie przepełnienia deszczomierza | `boolean` | — | P1 | DANE_SUROWE |
| `rain_gauge_interference` | Zakłócenia pomiaru deszczomierza | `text` | — | P1 | DANE_SUROWE |
| `gauge_emptied_after_reading` | Pojemnik opróżniony po pomiarze | `boolean` | — | P1 | DANE_SUROWE |
| `model_precip_same_period_mm` | Modelowany opad w tym samym okresie | `numeric(9,2)` | mm | P1 | WYNIK_OBLICZONY |
| `rainfall_model_difference_mm` | Różnica opad lokalny minus modelowany | `numeric(10,2)` | mm | P1 | WYNIK_OBLICZONY |

**Podsumowanie:** 68 pól: 25 wspólnych, 10 dla infiltracji, 7 dla wilgotności profilu, 9 dla VESS, 8 dla slake test i 9 dla deszczomierza. Każde pole ma szczegółowe definicje w CSV, łącznie z `regula_walidacji`, `format_lub_opcje_odpowiedzi`, `pytanie_do_rolnika`, `powiazane_pola_db` i `uwagi_implementacyjne`.
