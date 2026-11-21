# Risk Miner 2.0 — Institutional Immunity Engine

> **Od cyfrowej pamięci inwestycji publicznych do aktywnego zapobiegania powtarzaniu błędów.**  
> **Plan projektu na 24-godzinny hackathon HackNation**  
> Status: plan wykonawczy / MVP + rozszerzenia  
> Data opracowania: 21 listopada 2026 r.

---

## 0. Streszczenie dla zespołu

Budujemy funkcjonalny prototyp **Risk Miner 2.0** dla inwestycji publicznych w sektorze wodociągowo-kanalizacyjnym. Wymagany przez MFiPR rdzeń systemu automatycznie pobiera i łączy dane z różnych źródeł, rekonstruuje historię projektów i umów, identyfikuje zdarzenia ryzyka, udostępnia je do weryfikacji ekspertowi oraz wykorzystuje zatwierdzoną wiedzę do analizy planowanych inwestycji.

Naszym wyróżnikiem jest **Institutional Immunity Engine**: każdy historyczny problem poparty dowodem i zatwierdzony przez eksperta może zostać zamieniony w **Risk DNA** — wzorzec wiedzy i powtarzalny test odporności. Takie testy są uruchamiane w module **Chaos Lab** dla nowych projektów. Moduł **Epidemic Radar** wskazuje kandydatów na powtarzające się wzorce błędów, a **Project Twin** odnajduje historyczne inwestycje o podobnych cechach.

Wszystkie wyniki opierają się na tym samym modelu danych, grafie zależności i źródłach. Interfejs przedstawia ryzyko, kompletność materiałów i pewność wniosków jako **trzy różne rzeczy**, nie myli brakującego dokumentu z nieistniejącym dokumentem i pozwala przejść od twierdzenia do jego źródła.

**Najważniejszy przepływ demonstracyjny:**

```text
Dane inwestycji historycznej
  → automatyczne pobranie ogłoszenia / dokumentu
  → połączenie rekordów i ekstrakcja faktów
  → wykrycie zdarzenia oraz dowodu źródłowego
  → weryfikacja przez eksperta
  → zatwierdzone Risk DNA
  → znalezienie bliźniaka nowej inwestycji
  → uruchomienie Chaos Lab
  → identyfikacja luki + rekomendacja + źródło
  → uzupełnienie dokumentu i aktualizacja analizy
```

**Zasada strategiczna:** wykonanie wymagań konkursowych ma pierwszeństwo przed efektem wizualnym. Funkcje WOW mają wzmacniać podstawowy produkt, a nie go zastępować.

---

## 1. Kontekst, cel i kryteria sukcesu

### 1.1. Problem

Informacje o zamówieniach, kontraktach, zmianach i skutkach realizacji inwestycji publicznych są rozproszone między e-Zamówieniami/BZP, TED, bazami projektów, BIP, dokumentami postępowań i raportami kontrolnymi. Ta sama inwestycja może obejmować wiele postępowań, ogłoszeń, części zamówienia, umów i zmian. Przy przygotowaniu kolejnych przedsięwzięć doświadczenia są trudne do odnalezienia i porównania.

### 1.2. Cel produktu

Umożliwić osobie przygotowującej inwestycję publiczną uzyskanie **sprawdzalnej analizy gotowości i ryzyka** na podstawie dokumentów projektu, danych geograficznych oraz historycznych doświadczeń z podobnych inwestycji.

System odpowiada na pytania:

1. Co faktycznie wydarzyło się w podobnych inwestycjach i z jakich dokumentów to wynika?
2. Co może wydarzyć się w nowym projekcie i jak mocno uzasadniają to dane?
3. Jakich informacji i dokumentów brakuje do solidniejszej oceny?
4. Jakie ryzyka wzajemnie się wzmacniają?
5. Czy dokumentacja nowego projektu jest odporna na scenariusze znane z przeszłości?
6. Co należy sprawdzić lub poprawić **przed** rozpoczęciem inwestycji?

### 1.3. Kryteria konkursowe MFiPR

| Obszar oceny | Waga | Odpowiedź produktu |
|---|---:|---|
| Automatyczne pozyskiwanie, łączenie i organizacja danych | 20% | Import wsadu, API BZP, dodatkowe źródło, normalizacja, model powiązań, ponowne uruchomienie |
| Analiza dokumentów, identyfikacja zdarzeń i wiarygodność | 20% | Ekstrakcja R01–R15, dowody, rozróżnienie faktów i hipotez, ocena niepewności |
| Analiza nowej inwestycji i rekomendacje | 25% | Project Twin, porównania, Document Gap Detector, lista ryzyk, działania zaradcze, Chaos Lab |
| Kontrola ekspercka, edytowalność, modułowość | 20% | Panel akceptacji/edycji/odrzucania, historia decyzji, konfigurowalne reguły i modele |
| UX/UI, technologia i dalszy rozwój | 15% | Czytelny kokpit, Risk Graph, Evidence Lens, eksport i architektura modułowa |

### 1.4. Warunek sukcesu hackathonowego

**P0 / obligatoryjne:** działające end-to-end **dwie ścieżki wymagane przez organizatora**:

- **Ścieżka 1 — historia:** import przynajmniej jednego rekordu z danych konkursowych → automatyczne pobranie i powiązanie danych z publicznego źródła → ekstrakcja zdarzenia → weryfikacja eksperta → eksport.
- **Ścieżka 2 — przyszłość:** opis lub dokumentacja nowej inwestycji → bliźniaki i wyjaśnienie dopasowania → ryzyka i brakujące informacje → dowody → rekomendacje i przedziały odchyleń *tylko jeśli dane wystarczają* → eksport.

**WOW / aspiracyjne, ale realne:** co najmniej jeden rzeczywiście działający cykl **zatwierdzone Risk DNA → automatycznie utworzony test Chaos Lab → ocena nowej inwestycji**.

---

## 2. Materiały wejściowe i realne ograniczenia danych

### 2.1. Pliki dostarczone przez organizatora

| Plik | Zastosowanie |
|---|---|
| `MFiPR - Pełna treść zadania konkursowego.pdf` | Wymagania, kryteria oceny, testy jurorskie, zasady dostarczenia rozwiązania |
| `Risk_Miner_dane_projekty.xlsx` | Historyczne rekordy do importu, identyfikacji i wzbogacania |
| `Risk_Miner_material_ekspercki_przygotowanie_inw_wodociagowej.docx` | Dziewięciopunktowa checklista przygotowania inwestycji wodociągowej, definicje i wymagania zależne od etapu |
| `Risk_Miner_material_porady_fazy_dokumenty_ryzyka_ciekawostki.docx` | Fazy inwestycji, rodzaje dokumentów, mapowanie źródeł, katalog R01–R15, reguły interpretacyjne |

### 2.2. Rozpoznanie arkusza konkursowego

Arkusz `Projekty` zawiera **22 wiersze danych i 23 kolumny**; oddzielny arkusz `Opis kolumn` podaje objaśnienia pól.

- **15 rekordów** ma publiczny identyfikator typu **Ogłoszenie BZP**.
- **7 rekordów** ma identyfikator typu **Projekt KPO**, który nie jest numerem ogłoszenia BZP; należy dopiero wyszukać odpowiednie zamówienia.
- Wszystkie **22 rekordy** są oznaczone statusem **„Zakończone”**.
- **20 rekordów** ma zakres „całe postępowanie”, a **2** oznaczono jako odpowiednio „część 1” lub „część 2”. Nie należy zakładać, że część zamówienia i cała inwestycja to ten sam poziom obiektu.
- Rekordy zawierają m.in. identyfikator `RM-2026-...`, dane odbiorcy i NIP, województwo, nazwę przedsięwzięcia, identyfikator publiczny, status i niekiedy adnotacje instytucji.
- Arkusz **nie stanowi sam w sobie zweryfikowanej bazy kosztów końcowych, przyczyn opóźnień czy zdarzeń ryzyka**. Dane te należy wydobyć z ogłoszeń i dokumentów uzupełniających.

**Uwaga geograficzna:** siedziba odbiorcy/zamawiającego nie musi wskazywać faktycznej lokalizacji robót. Bez odpowiedniego potwierdzenia nie przypisujemy do niej ryzyk przestrzennych.

### 2.3. Źródła publiczne

**P0:**

- BZP/e-Zamówienia — pobieranie ogłoszeń i powiązanych metadanych.
- Kopia API przygotowana na hackathon: `https://bzp.cytr.us` — materiał ekspercki wskazuje ten adres jako zamiennik API e-Zamówienia bez standardowego limitu zapytań. Kod powinien umożliwiać przełączenie adresu w konfiguracji.
- Pliki użytkownika: XLSX/CSV, PDF z warstwą tekstową, DOCX.

**P0/P1 — drugi typ publicznego źródła:** TED, BK2021 lub konkretne BIP; wybrać integrację wykonalną na podstawie rzeczywistych identyfikatorów i dostępnych dokumentów. Dodatkowy adapter musi zostać pokazany na prawdziwym wyniku, nie tylko zadeklarowany.

**P2:** NIK, KIO, KPOŚK/AKPOŚK i dane geograficzne (GUS/BDL, Geoportal, Hydroportal), jeśli wystarczy czasu na solidne powiązanie.

---

## 3. Użytkownicy i podstawowe ścieżki pracy

### 3.1. Główne role

1. **Analityk/inwestor publiczny:** dodaje nową inwestycję, analizuje ryzyka, uzupełnia dokumentację, pobiera raport.
2. **Ekspert sektorowy:** weryfikuje połączenia, fakty, zdarzenia, przyczyny, działania zaradcze i Risk DNA; zarządza regułami.
3. **Administrator/operacje:** uruchamia synchronizację źródeł, sprawdza błędy, wersje i rejestr operacji.

### 3.2. Ścieżki użytkownika

**A. Analiza historii** — import → wzbogacanie → karta projektu → chronologia → wykryte ryzyka → panel eksperta → zapis zatwierdzonego przypadku.

**B. Analiza nowej inwestycji** — opis/PDF/DOCX → ekstrakcja cech → checklista informacji → bliźniaki → Risk Graph → testy Chaos Lab → rekomendacje i źródła → eksport.

**C. Uczenie się z przeszłości** — historyczny przypadek → propozycja Risk DNA → ekspert zatwierdza → scenariusz testowy powstaje z wzorca → nowa inwestycja jest poddawana testowi.

**D. Aktualizacja po dodaniu dokumentu** — nowy plik → rozpoznanie wersji i źródła → ponowna ekstrakcja zależnych faktów → aktualizacja ryzyk i poziomu pewności → pokazanie różnicy „przed/po”.

---

## 4. Funkcje i moduły systemu

### 4.1. Data Intake & Enrichment — automatyczny import i wzbogacanie [P0]

**Wejście:** rekordy XLSX, CSV, PDF, DOCX, identyfikatory BZP/KPO i linki.

**Działanie:**

1. Import wierszy i walidacja wymaganych kolumn.
2. Normalizacja NIP, REGON, identyfikatorów BZP/TED/OCID, dat, walut i nazw podmiotów.
3. Zbudowanie kolejki pobierania powiązanych ogłoszeń i dokumentów.
4. Deduplikacja i idempotentny zapis wyników: ponowny import nie może mnożyć obiektów.
5. Rejestr źródeł: adres, identyfikator, moment pobrania, typ dokumentu, wersja, hash.
6. Raport importu: `znaleziono / dopasowano / wymaga sprawdzenia / nie znaleziono / błąd`.

**Rezultat:** baza dokumentów i częściowo zrekonstruowanych historii inwestycji.

### 4.2. Record Linker — łączenie rekordów i kontraktów [P0]

**Priorytet dopasowania:**

1. Wspólny zweryfikowany identyfikator: BZP/TED, OCID, projekt CST/KPO, NIP/REGON **w odpowiedniej relacji biznesowej**.
2. Połączenie wskazane bezpośrednio w dokumentach źródłowych.
3. Gdy brak identyfikatora: kombinacja nazwy, zamawiającego, miejsca robót, CPV, zakresu, wartości i dat.
4. Niejednoznaczne dopasowanie jest **propozycją do zatwierdzenia**, nie faktem.

**Wynik połączenia:** typ relacji, dowody, metoda dopasowania, status decyzji, uzasadnienie, historia zmian.

**Zakaz:** nie scalać w jeden rekord projektu, postępowania, części i umowy; kwota projektu nie jest automatycznie kwotą kontraktu.

### 4.3. Evidence Extraction — ekstrakcja i analiza ryzyk [P0]

Przetwarzanie dokumentów i ogłoszeń według pipeline'u:

```text
Dokument → identyfikacja typu i wersji → fragmentacja z lokalizacją
         → ekstrakcja faktów → walidacja pól → kandydaci zdarzeń R01–R15
         → powiązanie z dowodami → ekspert → zapis
```

Każde twierdzenie oznaczamy jako:

- `SOURCE_FACT` — fakt bezpośrednio wynikający z dokumentu;
- `CALCULATED` — wynik deterministycznego obliczenia z podanymi przesłankami;
- `MODEL_INFERENCE` — wniosek/hipoteza wymagająca ostrożności i ewentualnego zatwierdzenia.

Dodatkowo rozróżniamy `OBSERVED_EVENT` (udokumentowane zdarzenie przeszłe) od `POTENTIAL_RISK` (zagrożenie przyszłe). To odrębne typy, których interfejs nie może mieszać.

**Ekstrakcja zdarzenia:** sygnał/warunek → potencjalna przyczyna → zdarzenie → skutek → zastosowane lub sugerowane środki zaradcze. Jeśli przyczyna nie została udokumentowana, pokazujemy „możliwa przyczyna”, a nie „przyczyna potwierdzona”.

**Katalog ekspertów MFiPR (R01–R15):**

| Kod | Ryzyko |
|---|---|
| R01 | Niepełny lub niespójny zakres |
| R02 | Niedostateczne rozpoznanie stanu istniejącego |
| R03 | Kolizje, dostęp do terenu i prawa do nieruchomości |
| R04 | Decyzje, pozwolenia i uzgodnienia zależne od podmiotów trzecich |
| R05 | Niejasny lub nieadekwatny podział odpowiedzialności |
| R06 | Nierealistyczny harmonogram i nieuwzględnione zależności |
| R07 | Nieprzewidziane zmiany i roboty dodatkowe |
| R08 | Model wynagrodzenia niedopasowany do niepewności zakresu |
| R09 | Niejednoznaczne lub niemierzalne wymagania techniczne |
| R10 | Niedookreślone próby, rozruch i odbiór |
| R11 | Postępowanie podatne na odwołanie lub ograniczenie konkurencji |
| R12 | Niewystarczająca zdolność wykonawcy lub łańcucha dostaw |
| R13 | Ryzyko finansowania, budżetu i płatności |
| R14 | Nadmierne koszty eksploatacji i utrzymania |
| R15 | Nieosiągnięcie efektu technologicznego, użytkowego lub środowiskowego |

Katalog jest rozszerzalny; nowe kategorie są propozycjami oczekującymi na eksperta.

### 4.4. Expert Studio — człowiek w procesie [P0]

Ekspert może:

- zaakceptować, edytować, odrzucić lub oznaczyć jako wymagające danych każde połączenie i wniosek;
- zobaczyć źródło, wersję, fragment i uzasadnienie dopasowania;
- zmienić kategorię zdarzenia, skutek, przyczynę i działanie zaradcze;
- oznaczyć przypadek jako wzorcowy i zatwierdzić Risk DNA;
- edytować listy kontrolne, reguły i wagi porównań bez zmian w kodzie;
- odczytać historię decyzji (`kto, co, kiedy, stara wartość, nowa wartość, powód`).

**Statusy:** `proposed → approved / corrected / rejected / needs_evidence`; późniejszy dokument może spowodować `superseded` lub ponowne otwarcie weryfikacji.

Dla MVP wystarczy prosty, przejrzysty panel z przyciskami i formularzem korekty, ale decyzje muszą rzeczywiście zmieniać dane wykorzystywane w analizie.

### 4.5. Document Gap Detector — kompletność informacji [P0]

System **nie sprawdza, czy istnieje „wymagany komplet wszystkich możliwych dokumentów”**. Tworzy checklistę adekwatną do fazy i typu inwestycji, następnie sprawdza, czy ważne pytania są wystarczająco udokumentowane.

W pilotażu sieci wodociągowej baza zawiera dziewięć grup informacji zaczerpniętych z poradnika eksperckiego:

1. Problem zaopatrzenia w wodę i oczekiwany efekt.
2. Obszar obsługi, liczba i rodzaj odbiorców.
3. Początkowi odbiorcy i przesłanki przyszłych przyłączeń.
4. Orientacyjny przebieg, długość sieci i przyłącza.
5. Miejsce zasilania i wstępne stanowisko operatora.
6. Trasa, własność gruntów i trudności z dostępem.
7. Przeszkody lokalizacyjne oraz zależności od innych inwestycji.
8. Rozpoznanie wymagań środowiskowych i ochrony przyrody.
9. Podział odpowiedzialności za przygotowanie, projekt, decyzje i eksploatację.

**Stany informacji:** `potwierdzona`, `częściowo potwierdzona`, `brak w udostępnionej paczce`, `dokument nie porusza tematu`, `sprzeczne źródła`, `nie dotyczy`, `potwierdzono niewykonanie czynności`.

Dla każdej luki system podaje: *czego brakuje*, *dlaczego to ma znaczenie*, *do której kategorii ryzyka się odnosi*, *co należy dosłać lub wyjaśnić* oraz *jak wzrośnie kompletność wiedzy po uzupełnieniu*.

### 4.6. Risk Assessment — poziom zagrożenia i pewność [P0]

Pokazujemy **trzy niezależne miary**:

1. **Poziom zagrożenia:** jak istotne są rozpoznane scenariusze, biorąc pod uwagę ich potencjalne konsekwencje i uzasadnioną ocenę prawdopodobieństwa.
2. **Kompletność informacji:** jaki odsetek *ważonych, adekwatnych* wymagań informacyjnych ma odpowiednie pokrycie.
3. **Pewność konkretnego wniosku:** na ile bezpośrednie, spójne, aktualne i niezależne są jego źródła; czy wniosek jest zatwierdzony.

Przykładowa transparentna definicja kompletności:

```text
completeness = Σ(weight_i × coverage_i) / Σ(weight_i)

gdzie:
  coverage_i = 1.0 dla informacji udokumentowanej,
               0.5 dla częściowo udokumentowanej,
               0.0 dla niepotwierdzonej;
  weight_i jest zależne od typu inwestycji, etapu i istotności ryzyka.

Pozycje „nie dotyczy” są wyłączane z mianownika.
Wagi i progi są przykładową metodą MVP, nie walidowaną statystycznie skalą.
```

**Nie używamy liczby dokumentów jako jedynej miary pewności.** Dziesięć mało istotnych pism nie zastąpi jednego kluczowego potwierdzenia zasilenia sieci.

Ocena pewności powinna być w MVP raczej kategoryczna (`niska / umiarkowana / wysoka`) z wyjaśnieniem niż arbitralnie wyświetlona jako „97,3%”. Numeryczną pewność należy później kalibrować na zbiorze referencyjnym.

### 4.7. Project Twin — historyczne bliźniaki [P0]

Silnik szuka **porównywalnych** inwestycji, a nie tylko podobnych tytułów. Uwzględnia:

- podsektor (np. sieć wodociągowa, kanalizacja sanitarna, oczyszczalnia, SUW);
- rodzaj prac (budowa/rozbudowa vs przebudowa/renowacja);
- funkcję i parametry techniczne (długość, wydajność, liczba odbiorców), jeśli znane;
- organizację (formuła wykonawstwa, liczba postępowań/umów);
- budżet, harmonogram i geografię — tylko gdy mają wiarygodne źródła;
- podobieństwo treści opisów/PFU/OPZ.

**Wynik:** lista podobnych projektów z krótkim uzasadnieniem („ta sama funkcja i podobny zakres”), cechami odróżniającymi, brakującymi polami i historycznymi zdarzeniami. Wagi wymiarów może zmienić ekspert.

Brak danych dla cechy **nie oznacza zerowego podobieństwa**: taki wymiar jest pomijany i sygnalizowany jako ograniczenie porównania. Wyniki różnej kompletności nie powinny sprawiać wrażenia identycznie wiarygodnych.

### 4.8. Risk Graph — graf zależności [P1]

Graf odzwierciedla relacje:

```text
fakt / luka dokumentacyjna
    → warunek ryzyka
    → potencjalne zdarzenie
    → skutek finansowy / czasowy / społeczny
    → środek zaradczy / test
```

Węzły mogą reprezentować ryzyko R01–R15, dokument, fragment dowodu, inwestycję, zdarzenie, możliwą przyczynę, skutek i działanie zaradcze. Typ krawędzi rozróżnia np. `EVIDENCED_BY`, `MAY_CAUSE`, `OBSERVED_IN`, `MITIGATED_BY`, `TESTED_BY`, `SIMILAR_TO`.

W MVP interaktywny graf pokazuje 5–10 najważniejszych węzłów dla analizowanego projektu. Kliknięcie w węzeł otwiera szczegóły i źródło. W Chaos Lab podświetlana jest ścieżka zagrożeń uruchamianych przez dany scenariusz.

**Uwaga:** krawędź „może powodować” nie oznacza udowodnionej relacji przyczynowej.

### 4.9. Risk DNA — zatwierdzony wzorzec doświadczenia [P1, wyróżnik]

To kluczowy obiekt łączący dane historyczne z testami nowych inwestycji.

**Pola:**

- `risk_dna_id`, kod R01–R15, nazwa wzorca;
- historyczny sygnał/warunek i zdarzenie;
- przyczyna (`confirmed` albo `hypothesized`);
- obserwowany lub możliwy skutek i jego jednostki;
- środki zaradcze i ewentualna udokumentowana skuteczność;
- warunki stosowalności do nowej inwestycji;
- pytanie kontrolne i lista oczekiwanych dowodów;
- identyfikatory źródeł i dowodów;
- decyzja eksperta, wersja i data zatwierdzenia.

**Reguła:** tylko **zatwierdzone** Risk DNA może być użyte jako autoryzowana wiedza ekspercka do tworzenia testów. Niezweryfikowany wzorzec można wyświetlić wyłącznie jako sugestię.

### 4.10. Epidemic Radar — powtarzalne wzorce błędów [P1]

System grupuje **porównywalne sekwencje sygnałów i skutków** między projektami. W MVP może wykorzystywać znormalizowane etykiety ryzyk i cechy kontekstu zamiast zaawansowanego modelu grafowego.

Przykład: `brak rozpoznania gruntu → roboty dodatkowe → przesunięcie terminu` zaobserwowany w kilku inwestycjach.

**Widok kandydata na wzorzec:** liczba przypadków, liczba projektów z dostępnymi dokumentami, wspólne cechy, różnice, źródła, hipoteza przyczyny, decyzja eksperta.

**Ważne ograniczenie:** 22 rekordy i niekompletne dokumenty **nie uzasadniają** wnioskowania o statystycznie potwierdzonej „epidemii” ani o związku przyczynowym. Nazywamy to *wykrywaniem kandydatów na powtarzalne wzorce*, z pełną informacją o małej próbie.

### 4.11. Chaos Lab — testy odporności [P1, główny WOW]

**Nie** jest to losowa symulacja obliczająca fikcyjne procenty strat. Jest to **generator kontrolowanych scenariuszy zakorzenionych w zatwierdzonych przypadkach historycznych**.

**Przebieg:**

1. System dobiera zatwierdzone Risk DNA istotne dla nowego projektu.
2. Tworzy scenariusz warunkowy (np. opóźnienie dostępu do nieruchomości).
3. Z dokumentacji próbuje wydobyć zabezpieczenia, zależności i założenia harmonogramu.
4. Użytkownik może jawnie zmodyfikować parametry scenariusza.
5. System zwraca: `odporne / częściowo zabezpieczone / nieudokumentowane zabezpieczenie / luka krytyczna`, wraz z wyjaśnieniem i źródłami.
6. Powstaje checklista działań zapobiegawczych i dowodów do pozyskania.

**Scenariusz MVP 1 — R03/R06:** „Co jeśli dostęp do wskazanej działki opóźni się o 90 dni?”

- Czy prawa do gruntów są potwierdzone?
- Czy istnieje alternatywny przebieg lub możliwość zmiany kolejności robót?
- Czy harmonogram identyfikuje zależne zadania?
- Czy umowa rozdziela obowiązki i skutki opóźnienia?

**Scenariusz MVP 2 — R02/R07 (opcjonalny):** „Co jeśli podczas robót zostaną odkryte kolizje z istniejącą infrastrukturą?”

Wyniki ilościowe, takie jak opóźnienie lub wzrost kosztu, pokazujemy **wyłącznie** jeśli wynikają z danych historycznych i zdefiniowanego modelu. W przeciwnym razie podajemy ocenę jakościową. Przykładowe „90 dni” to parametr testu użytkownika, nie prognoza systemu.

### 4.12. Geo Risk — kontekst przestrzenny [P2]

Analiza może dodawać sygnały z geograficznego kontekstu inwestycji:

- gęstość zaludnienia i liczba potencjalnych odbiorców na kilometr sieci;
- istniejące/podobne obiekty w pobliżu;
- zagrożenia powodziowe, cieki, przeszkody terenowe;
- rozproszona zabudowa, sezonowość użytkowania, potencjalne koszty eksploatacji.

**MVP minimum:** jedna realna miara, np. gęstość zaludnienia gminy z publicznego źródła, ze wskazaniem poziomu geograficznego, roku i źródła. Sygnał geograficzny jest **czynnikiem analizy**, a nie samodzielnym dowodem, że inwestycja jest nieuzasadniona.

### 4.13. Social Impact — kontekstowa dotkliwość skutków [P2]

Oceniamy co najmniej osobno:

| Wymiar | Przykładowa miara |
|---|---|
| Koszty finansowe | Dodatkowy koszt w PLN, o ile udokumentowany |
| Czas | Dni opóźnienia, o ile udokumentowane |
| Dostępność usługi | Liczba odbiorców objętych zakłóceniem |
| Sezonowość | Okres największego zapotrzebowania lub krytyczne warunki pogodowe |
| Skutek jakościowy/środowiskowy | Ryzyko jakości wody, brak osiągnięcia efektu, wpływ na środowisko |

Przykład: przerwa w dostawie wody w okresie zwiększonego zapotrzebowania może być bardziej dotkliwa niż takie samo opóźnienie w oddaniu odcinka bez przyłączonych odbiorców. Nie sprowadzamy każdej straty społecznej do arbitralnej kwoty PLN.

### 4.14. Evidence Lens — klikalne źródła [P0]

Każdy istotny fakt i wniosek na kokpicie ma link do:

- oryginalnego URL/identyfikatora ogłoszenia;
- lokalnej kopii dokumentu (jeśli uprawnienia na to pozwalają);
- strony i fragmentu PDF lub oznaczonego akapitu DOCX;
- informacji o wersji, dacie pozyskania i statusie eksperckim.

Dla PDF nawigacja może wykorzystywać numer strony i podświetlenie fragmentu. Dla DOCX przechowujemy identyfikator akapitu/sekcji i wyświetlamy fragment w podglądzie. Jeśli fragmentu nie da się wiarygodnie wskazać, oznaczamy informację jako wymagającą sprawdzenia.

**Nie generujemy cytatu ani położenia w dokumencie bez rzeczywistego odniesienia do ekstrakcji.**

---

## 5. Model danych i architektura

### 5.1. Encje minimalne

```text
Project (inwestycja)
 ├── ProcurementProcedure (postępowanie) [1:N]
 │    ├── ProcedurePart (część) [0:N]
 │    ├── Notice (ogłoszenie) [0:N]
 │    └── Contract (umowa) [0:N]
 │          └── ContractChange (zmiana/aneks) [0:N]
 ├── ProjectAttribute (cecha z dowodem) [0:N]
 ├── Document (dokument i jego wersje) [0:N]
 │    └── EvidenceSpan (cytat + lokalizacja) [0:N]
 ├── Event (udokumentowane zdarzenie) [0:N]
 ├── RiskFinding (wniosek o potencjalnym ryzyku) [0:N]
 └── ProjectAssessment (analiza nowej inwestycji) [0:N]
      ├── MissingInformation
      ├── ProjectSimilarity
      ├── ChaosTestRun
      └── Recommendation

RiskPattern / RiskDNA (zatwierdzony wzorzec)
ExpertDecision (decyzja i historia zmian)
SourceRecord / ImportRun / FetchLog / AuditLog
```

Wiele tabel jest połączonych relacjami N:M przez osobne tabele łącznikowe (np. zdarzenie–dowody, projekt–dokument, przypadek–wzorzec). Jedno zdarzenie może mieć kilka źródeł, a jeden dokument może potwierdzać wiele faktów.

### 5.2. Zasady przechowywania danych

- Każdy ważny fakt ma `source_id`, `document_version_id`, lokalizację (`page/paragraph/char_offsets`) i poziom wiarygodności.
- Jeden projekt może zawierać wiele postępowań; jedna część postępowania może mieć odrębne rozstrzygnięcie i umowę.
- Kwoty rozróżniają: wartość projektu, szacunkową wartość zamówienia, budżet zamawiającego, ofertę, kwotę umowy, finalną wypłatę. Wskazujemy **netto/brutto**, walutę i datę.
- Zachowujemy historię wersji dokumentów; nowsza modyfikacja SWZ nie może być traktowana automatycznie jako sprzeczność ze starą wersją.
- Aktualizacja dokumentu nie nadpisuje bez śladu poprzednich ustaleń.
- Wyniki są zapisywane jako **ustrukturyzowane rekordy**, dostępne do filtrowania i eksportu JSON/CSV — nie tylko w rozmowie z agentem.

### 5.3. Sugerowany stos (preferencja, nie wymóg)

| Warstwa | Wariant hackathonowy | Dlaczego |
|---|---|---|
| Frontend | React + Vite lub Next.js | Szybki kokpit i podgląd dokumentów |
| Graf | React Flow | Interaktywne węzły, krawędzie, klikane szczegóły |
| Dokumenty | PDF.js | Skok do stron PDF |
| Backend | Python + FastAPI | Integracje, parsery, API i logika AI |
| Relacyjna baza | SQLite na MVP / PostgreSQL, jeśli gotowy | Ustrukturyzowany model i śledzenie relacji |
| Import tabel | `openpyxl`, `pandas` | Obsługa XLSX/CSV |
| PDF i DOCX | PyMuPDF lub `pdfplumber`, `python-docx` | Tekst i położenia dowodów |
| AI/LLM | Adapter konfigurowalnego modelu | Ekstrakcja do JSON, klasyfikacja, porównania |
| Embeddingi | Opcjonalnie lokalne lub przez provider | Wyszukiwanie podobnych opisów |
| Procesy asynchroniczne | Kolejka zadań / prosty background worker | Nieblokujące pobieranie i przetwarzanie wsadów |

**Bezpieczeństwo i przenośność:** konfiguracja modelu i endpointu w pliku `.env.example` lub YAML; jawna informacja o regionie przetwarzania danych, modelu, providerze, licencjach oraz warunkach przechowywania. Sekrety poza repozytorium.

### 5.4. Schemat usług

```text
          ┌───────────────────────────────────┐
          │ React UI: kokpit, ekspert, graf   │
          └─────────────────┬─────────────────┘
                            │ REST API
          ┌─────────────────▼─────────────────┐
          │ Backend FastAPI                   │
          │  - Projects / Documents           │
          │  - Linking / Evidence / Risks     │
          │  - Twins / DNA / Chaos / Export   │
          └───────┬─────────────────┬─────────┘
                  │                 │
    ┌─────────────▼────────┐ ┌──────▼───────────┐
    │ PostgreSQL / SQLite   │ │ Parser + LLM     │
    │ relacje + provenance  │ │ reguły + JSON    │
    └──────────────────────┘ └──────┬───────────┘
                                   │
                         ┌─────────▼───────────┐
                         │ Connectors BZP,     │
                         │ drugie źródło, pliki│
                         └─────────────────────┘
```

### 5.5. Przykładowe endpointy

```text
POST /imports                      import XLSX/CSV
POST /projects/{id}/enrich         pobranie i odświeżenie źródeł
GET  /projects/{id}                karta inwestycji
GET  /projects/{id}/evidence       fakty i ich źródła
GET  /projects/{id}/risks          zdarzenia/ryzyka
POST /expert/decisions             akceptacja/korekta/odrzucenie
POST /assessments                  analiza nowej inwestycji
GET  /assessments/{id}/twins       projekty podobne
GET  /assessments/{id}/gaps        brakujące informacje
GET  /assessments/{id}/graph       graf ryzyk
POST /assessments/{id}/chaos       uruchomienie testu
GET  /assessments/{id}/export      JSON / CSV
```

Dla hackathonu można ograniczyć liczbę endpointów; ważne, by API zachowywało rozróżnienie typów danych i dało się je rozwijać.

---

## 6. Logika analityczna i gwarancje jakości

### 6.1. Reguły dopasowania

1. **Deterministyczne dopasowanie** po prawidłowo znormalizowanym identyfikatorze i zgodności otoczenia (np. zamawiający, daty, przedmiot).
2. **Dopasowanie probabilistyczne / rankingowe** gdy brak jednoznacznego klucza — jawna lista cech, które przemawiają za i przeciw połączeniu.
3. **Kontrola ekspercka** dopasowań niejednoznacznych.
4. **Raport testowy:** liczba poprawnych, niepewnych i błędnych połączeń (na zbiorze zweryfikowanym ręcznie).

### 6.2. Wnioskowanie o ryzyku

- Najpierw gromadzimy dowody, potem generujemy wnioski.
- Cytat źródłowy nie może być zastąpiony wygenerowanym streszczeniem.
- Nie wyciągamy automatycznie przyczyn z samej podstawy prawnej zmiany umowy.
- Oddzielamy **ryzyko wystąpienia** od **zdarzenia, które już wystąpiło**.
- Gdy nie ma odpowiednich danych, wynik jest `insufficient_evidence`.
- Nowy dokument powoduje przeliczenie zależnych wniosków i zapis zmiany.

### 6.3. Przedziały kosztów i opóźnień

MFiPR oczekuje porównań i — gdy możliwe — przedziałów odchyleń. W MVP:

- budujemy próbę porównawczą z faktycznie porównywalnych projektów;
- **pokazujemy liczebność próby i procent brakujących pól**;
- wyznaczamy odchylenie tylko z projektów posiadających wiarygodne wartości bazowe i końcowe;
- rozróżniamy wartości zamówienia i umowy, netto/brutto, nominalne kwoty z różnych lat;
- przy zbyt małej lub nieporównywalnej próbie wyświetlamy „brak podstaw do wiarygodnego przedziału” i ocenę jakościową;
- **nie generujemy fikcyjnej statystyki** na podstawie samego opisu projektu.

### 6.4. Przygotowanie złożonych dokumentów

- Wersjonowanie modyfikacji, aneksów i odpowiedzi na pytania.
- Preferowanie obowiązującej wersji dokumentacji po sprawdzeniu hierarchii.
- Rozróżnienie podpisanej umowy od odtworzonych warunków kontraktowych z PPU/SWU.
- Wpisanie niepełności źródeł wprost do wyniku.
- Porównywanie kwot o tym samym charakterze i tym samym statusie VAT.

---

## 7. Interfejs i nawigacja

### 7.1. Ekrany MVP

1. **Repozytorium projektów:** lista 22 rekordów, status wzbogacenia, źródło, liczba powiązań i ryzyk.
2. **Karta historycznej inwestycji:** postępowania, ogłoszenia, umowy, zmiany, oś czasu, tabela ryzyk, źródła.
3. **Expert Studio:** kolejka propozycji do weryfikacji, dowód źródłowy obok proponowanego wniosku, edycja i decyzja.
4. **Nowa inwestycja / kokpit:** opis, podgląd dokumentów, bliźniaki, lista braków, poziom zagrożenia, kompletność i pewność, rekomendacje, eksport.
5. **Evidence Lens:** kliknięcie pola/podsumowania przenosi do strony lub akapitu źródła.

### 7.2. Ekrany WOW

6. **Risk Graph:** graf zależności i szczegóły węzłów.
7. **Chaos Lab:** scenariusze historyczne, jawne parametry testu, warunki obrony, wynik i działania zaradcze.
8. **Epidemic Radar:** grupy powtarzających się wzorców, liczebność, dowody i informacja o ograniczeniach.
9. **Geo Risk:** mapa lub panel kontekstu przestrzennego (tylko jeśli mamy prawidłową lokalizację inwestycji i źródło danych).

### 7.3. Główne zasady UX

- Każda ważna informacja jest **klikalna i sprawdzalna**.
- Zawsze widoczne: „potwierdzone w źródle”, „obliczone”, „wniosek AI”.
- Nie ukrywamy brakujących danych, niepewności i statusu eksperta.
- Ekspert widzi obok siebie dowód i propozycję zmiany.
- Użytkownik nietechniczny nie musi znać RAG, embeddingów ani schematu JSON.
- Więcej istotności niż metryk: na pierwszym ekranie maksymalnie 3–5 najważniejszych działań.

---

## 8. Priorytety i zakres 24-godzinnego hackathonu

### 8.1. P0 — musi działać

- [ ] Import 22 rekordów arkusza konkursowego do bazy.
- [ ] Automatyczne pobranie rzeczywistego ogłoszenia BZP i możliwość ponowienia procesu.
- [ ] Co najmniej jeden dodatkowy publiczny typ źródła lub adapter z realnie pozyskanym materiałem.
- [ ] Model `projekt → postępowanie → ogłoszenie/część → umowa → zmiana → dokument → zdarzenie`.
- [ ] Normalizacja i łączenie na podstawie identyfikatorów, jawne dopasowania niepewne.
- [ ] Analiza PDF/DOCX i ustrukturyzowana ekstrakcja faktów/ryzyk R01–R15.
- [ ] Źródła i lokalizacja dokumentów dla istotnych wniosków.
- [ ] Panel eksperta z trwałą decyzją oraz edycją.
- [ ] Analiza nowej inwestycji z tekstu lub pliku.
- [ ] Bliźniaki inwestycji i uzasadnienie wyboru.
- [ ] Brakujące informacje i rekomendacje uzupełnienia.
- [ ] Jawne komunikowanie kompletności, pewności i ograniczeń.
- [ ] Eksport ustrukturyzowanych wyników JSON/CSV.
- [ ] Publicznie dostępne demo lub udokumentowane uruchomienie lokalne.

### 8.2. P1 — główny efekt WOW

- [ ] Risk DNA z ekspercką akceptacją.
- [ ] Generator przynajmniej jednego testu Chaos Lab z zatwierdzonego Risk DNA.
- [ ] Test nowego projektu z wynikiem i konkretnym działaniem zaradczym.
- [ ] Risk Graph z interakcją i dowodami.
- [ ] Epidemic Radar na prostym wzorcu opartym na faktycznie pozyskanych przypadkach (albo informacja o braku wystarczającej liczby przypadków).
- [ ] Aktualizacja wniosku po dosłaniu dokumentu.

### 8.3. P2 — jeśli zostanie czas

- [ ] Geo Risk oparty na rzeczywistych danych przestrzennych.
- [ ] Ocena kontekstowego wpływu społecznego i sezonowości.
- [ ] Drugi typ scenariusza Chaos Lab.
- [ ] Zaawansowane porównania kosztów i terminów, jeżeli mamy dostateczne dane.
- [ ] Monitoring nowych ogłoszeń dotyczących niezakończonych inwestycji.

**Reguła cięć:** w przypadku opóźnień usuwamy P2, potem rozbudowane wizualizacje P1, ale **nie** usuwamy weryfikacji źródeł, trwałego zapisu i ścieżek jurorskich P0.

---

## 9. Plan działań godzina po godzinie

| Czas od startu | Priorytet | Prace | Kamień milowy |
|---|---|---|---|
| **0–2 h** | P0 | Podział ról; repozytorium; kontrakt API; schemat tabel; test dostępu BZP/kopia | Wspólny start i działający skeleton |
| **2–4 h** | P0 | Parser XLSX; import 22 rekordów; normalizacja identyfikatorów; pierwszy pobrany rekord | Ingest i enrichment działają |
| **4–7 h** | P0 | Relacje projekt–postępowanie–umowa; pobranie dokumentów; parser PDF/DOCX; zapis dowodów | Karta historycznego projektu z źródłami |
| **7–10 h** | P0 | Ekstrakcja faktów i ryzyk; katalog R01–R15; rozróżnienie faktu od wniosku | Pierwsze wnioski z dowodami |
| **10–13 h** | P0 | Expert Studio; obsługa decyzji; nowa inwestycja; Document Gap Detector | Pełny przepływ podstawowy |
| **13–16 h** | P0/P1 | Project Twin; rekomendacje; eksport; Risk DNA z decyzji eksperta | Dwie ścieżki jurorskie + zalążek WOW |
| **16–19 h** | P1 | Chaos Lab; jeden historyczny scenariusz; graf ryzyk | Gotowy główny moment demo |
| **19–21 h** | P1/P2 | Epidemic Radar minimum; drugie źródło i brakujące testy; aktualizacja po pliku | Funkcje wyróżniające stabilne |
| **21–22,5 h** | P0 | Test „nieznanego wejścia”, test źródeł, poprawki wydajności i deploy | Działające publiczne demo |
| **22,5–24 h** | P0 | PDF ≤10 slajdów, film ≤3 min, repozytorium, README, konfiguracja, raport testów, próba prezentacji | Komplet materiałów konkursowych |

**Bufor:** plan jest orientacyjny; prace frontend/backend/AI/dokumentacja powinny iść równolegle. Nie odkładamy pierwszego deployu na ostatnią godzinę i nie zaczynamy P2 przed wykazaniem P0.

### 9.1. Sugerowany podział odpowiedzialności

| Rola / strumień | Główna odpowiedzialność | Interfejs z innymi |
|---|---|---|
| **Data/Backend** | import, API BZP, deduplikacja, encje, zapis | Kontrakt JSON i identyfikatory |
| **AI/Knowledge** | ekstrakcja faktów, R01–R15, podobieństwo, Risk DNA, testy | Kontrakt structured outputs |
| **Frontend/UX** | repozytorium, kokpit, źródła, panel eksperta, graf | API i reprezentacja statusów |
| **QA/Integracja/Prezentacja** | dane testowe, walidacja, demo, wdrożenie, dokumentacja | Testy end-to-end i kryteria oceny |

Przy mniejszym zespole łączymy role; najważniejsze jest wyznaczenie jednej osoby odpowiedzialnej za **działające demo end-to-end**.

### 9.2. Punkty kontrolne / decyzje Go–No-Go

- **H4:** czy rzeczywisty import i enrichment działają? Jeśli nie, naprawiamy dane/API zamiast dodawać AI.
- **H10:** czy jest co najmniej jedno ryzyko z dowodem i widoczny status jego weryfikacji?
- **H16:** czy użytkownik może ocenić nowy projekt, uzyskać bliźniaka, kliknąć źródło i pobrać eksport?
- **H20:** czy Chaos Lab działa na zatwierdzonym wzorcu? Jeśli nie, pokazujemy wyłącznie gotowe, rzeczywiście działające elementy i oznaczamy koncepcję jako planowaną.
- **H22:** zamrożenie nowych funkcji; tylko naprawy błędów i materiały prezentacyjne.

---

## 10. Backlog wykonawczy z kryteriami akceptacji

| ID | Zadanie | Priorytet | Kryterium „DONE” |
|---|---|---|---|
| RM-01 | Import XLSX | P0 | 22 rekordy odtworzone z unikalnymi identyfikatorami, poprawne typy danych |
| RM-02 | API BZP + log pobrań | P0 | Rzeczywiste ogłoszenie powiązane z rekordem, zapis URL/dat oraz ponowne uruchomienie bez duplikatów |
| RM-03 | Drugi adapter publiczny | P0 | W bazie jest przynajmniej jeden prawdziwy rekord/dokument z innej kategorii źródeł |
| RM-04 | Model relacji i wersji | P0 | Projekt może posiadać wiele postępowań, ogłoszeń, części, umów i dokumentów |
| RM-05 | Parser PDF/DOCX | P0 | Tekst i lokalizacje fragmentów zapisane przy dokumentach |
| RM-06 | Detekcja ryzyk | P0 | Co najmniej jeden udokumentowany przypadek R01–R15 z cytatem/fragmentem |
| RM-07 | Kontrola eksperta | P0 | Akceptacja, korekta, odrzucenie zapisywane i widoczne w późniejszych analizach |
| RM-08 | Analiza nowego projektu | P0 | Użytkownik wpisuje opis lub dodaje dokument i otrzymuje strukturalny wynik |
| RM-09 | Project Twin | P0 | Lista podobnych projektów z uzasadnieniem i ograniczeniami |
| RM-10 | Document Gap Detector | P0 | Lista braków zależna od typu/fazy i wskazanie dokumentów do uzupełnienia |
| RM-11 | Evidence Lens | P0 | Kliknięcie faktu przenosi do właściwego dokumentu i strony/fragmentu |
| RM-12 | Eksport | P0 | Wynik dostępny jako JSON/CSV po ponownym odczycie, bez utraty źródeł i statusów |
| RM-13 | Risk DNA | P1 | Ekspert zatwierdza wzorzec i powstaje jego zapisana wersja |
| RM-14 | Chaos Lab | P1 | Test nowej inwestycji na wzorcu historycznym, ze wskazaniem zabezpieczeń/braków |
| RM-15 | Graf ryzyk | P1 | Kliknięcie węzła otwiera odpowiednie szczegóły i źródła |
| RM-16 | Epidemic Radar | P1 | Wykryty kandydat na wzorzec albo uzasadniony komunikat „zbyt mała próba” |
| RM-17 | Geo Risk | P2 | Co najmniej jedna prawdziwa cecha z wiarygodnym źródłem, rokiem i jednostką geograficzną |
| RM-18 | Ocena skutków społecznych | P2 | Wynik uwzględnia odbiorców i sezonowość bez wymyślania danych |
| RM-19 | Testy jurorskie | P0 | Obie ścieżki pokazane od początku do eksportu; log błędów i pomiar poprawności połączeń |
| RM-20 | Materiały finałowe | P0 | Działający link, README, konfiguracja, PDF ≤10 slajdów, film ≤3 min, repozytorium |

---

## 11. Plan testów i walidacji

### 11.1. Testy wymagane przez organizatora

1. **Integracja:** ponawiamy pobranie danych BZP i pokazujemy autentyczne źródło oraz zapisany rezultat.
2. **Łączenie:** juror widzi metodę i dowody dopasowania; raport obejmuje poprawne, niepewne i błędne połączenia zweryfikowane ręcznie.
3. **Kompletność przypadku:** od projektu przechodzimy do postępowania, ogłoszenia, umowy, zmiany i zdarzenia (tylko tam, gdzie istnieją potwierdzone dane).
4. **Analiza nowej inwestycji:** na nieznanym opisie system wskazuje podobne przypadki, zagrożenia, braki, rekomendacje i ograniczenia prognoz.
5. **Źródłowość:** juror klika losowe twierdzenie i rzeczywiście trafia do odpowiedniego fragmentu.
6. **Ekspert:** akceptacja, poprawka i odrzucenie zmieniają trwały stan wiedzy.
7. **Uniwersalność:** zmiana dokumentów wejściowych lub identyfikatora powoduje ponowną automatyczną analizę, nie odwołanie do ręcznie przygotowanej odpowiedzi.

### 11.2. Testy negatywne i przypadki brzegowe

- [ ] Wgrano ten sam XLSX dwukrotnie → brak duplikacji.
- [ ] Błędny numer BZP → jawny błąd lub status `unmatched`, bez losowego podpięcia.
- [ ] Wiele ogłoszeń dla jednego postępowania → zachowane relacje.
- [ ] Brak podpisanej umowy, ale jest PPU/SWU → wynik oznaczony jako warunki odtworzone.
- [ ] Różne wersje SWZ → system rozpoznaje chronologię, nie przedstawia starej wersji jako aktualnej.
- [ ] Brak dokumentu geotechnicznego → `brak w paczce`, nie „nie wykonano badań”.
- [ ] Niespójne kwoty netto/brutto → brak niepoprawnego porównania.
- [ ] Pusty opis nowej inwestycji → użytkownik otrzymuje listę konkretnych informacji do podania.
- [ ] Nowy dokument potwierdza wcześniej nieznaną informację → aktualizacja kompletności i powiązanych wniosków.
- [ ] Nieznany projekt → brak hardkodowanych wyników.
- [ ] Zbyt mała próba historyczna → komunikat o braku wiarygodnych statystyk.
- [ ] Ryzyko bez źródła → brak statusu „potwierdzone”.

### 11.3. Mierniki jakości (raportować, nie deklarować z góry)

- liczba rekordów poprawnie zaimportowanych;
- liczba projektów rzeczywiście wzbogaconych;
- liczba poprawnych, niepewnych i błędnych powiązań w ręcznie sprawdzonej próbce;
- liczba udokumentowanych zdarzeń z klasyfikacją R01–R15;
- odsetek kluczowych twierdzeń z działającym odsyłaczem do źródła;
- liczba decyzji ekspertów zapisanych i ponownie wykorzystanych;
- liczba testów Chaos Lab pochodzących z zatwierdzonych Risk DNA;
- czas analizy nowego projektu i błędy krytyczne;
- w przypadku przedziałów koszt/czas: liczba obserwacji i odsetek braków.

Nie wpisujemy do prezentacji efektownych procentów „trafności AI” bez zdefiniowanej i przeprowadzonej walidacji.

---

## 12. Scenariusz 3-minutowej demonstracji dla jury

| Czas | Co pokazujemy | Jaką wartość demonstrujemy |
|---|---|---|
| **00:00–00:30** | Krótkie wprowadzenie i import rzeczywistego rekordu | Automatyzacja zamiast ręcznej bazy |
| **00:30–01:00** | Pobranie BZP, powiązanie, historyczne zdarzenie, kliknięcie źródła | Sprawdzalność i wiarygodność |
| **01:00–01:20** | Ekspert zatwierdza wniosek i powstaje Risk DNA | Uczenie z udziałem człowieka |
| **01:20–01:50** | Dodanie nowej inwestycji; bliźniak, brak dokumentu i graf | Użyteczna analiza nowego projektu |
| **01:50–02:30** | Chaos Lab uruchamia test na podstawie zatwierdzonego wzorca | Centralny WOW: historyczny błąd jako nowy test |
| **02:30–02:50** | Sugerowana poprawka/dokument, podgląd źródła, ewentualnie aktualizacja po dodaniu pliku | Konkretna decyzja i zapobieganie |
| **02:50–03:00** | Eksport i puenta | Gotowy produkt, nie tylko chatbot |

**Hasło końcowe:** „Każdy potwierdzony błąd z przeszłości staje się testem, który pomaga ochronić następną inwestycję”.

Dla bezpieczeństwa przygotowujemy: (1) żywy przebieg na realnych źródłach, (2) zapisane dane demonstracyjne pochodzące z tego samego pipeline’u, gdy API jest niedostępne, oraz (3) krótki film ekranowy potwierdzający działanie. Nie przedstawiamy sztucznego przykładu jako prawdziwego projektu.

---

## 13. Artefakty konkursowe i definicja ukończenia

### 13.1. Wymagane materiały

- [ ] Link do działającego prototypu umożliwiającego samodzielne testowanie przez jury (lub dopuszczona wersja lokalna).
- [ ] Tytuł i szczegółowy opis projektu.
- [ ] Prezentacja **PDF, maksymalnie 10 slajdów**.
- [ ] Repozytorium z kodem.
- [ ] Publicznie dostępny film prezentacyjny **maksymalnie 3 minuty**.

### 13.2. Zalecane dodatki

- [ ] `README.md`: cel, instalacja, uruchomienie, opis demonstracji.
- [ ] `.env.example`: wymagane zmienne i adaptery, bez sekretów.
- [ ] Architektura i schemat modelu danych.
- [ ] Informacja o modelu, regionie przetwarzania i licencjach.
- [ ] Raport z testów integracji i dopasowania.
- [ ] Przykładowy eksport `sample_assessment.json` oraz opcjonalnie CSV.
- [ ] Zrzuty ekranów dla scenariuszy trudnych do powtórzenia na żywo.
- [ ] Lista „działa teraz” versus „planowane po hackathonie”.

### 13.3. Sugerowana struktura repozytorium

```text
risk-miner/
├── backend/
│   ├── api/
│   ├── connectors/
│   ├── ingestion/
│   ├── extraction/
│   ├── linking/
│   ├── analysis/
│   ├── expert/
│   ├── models/
│   └── tests/
├── frontend/
│   ├── src/components/
│   ├── src/pages/
│   └── src/lib/
├── data/
│   ├── samples/
│   └── fixtures/
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── demo-script.md
│   └── test-report.md
├── .env.example
├── README.md
└── docker-compose.yml    # opcjonalnie
```

**Definition of Done (projekt):** juror może uruchomić aplikację, przejść obie ścieżki, sprawdzić kluczowy dowód, zatwierdzić lub poprawić wniosek, przeanalizować nową inwestycję i wyeksportować wynik. Jeśli funkcja Chaos Lab jest prezentowana jako działająca, test ma wynikać z zatwierdzonego wzorca, a jego wynik musi być odtwarzalny.

---

## 14. Ryzyka wykonawcze i plan awaryjny

| Ryzyko projektu hackathonowego | Wczesny sygnał | Ograniczenie / plan B |
|---|---|---|
| API BZP niedostępne lub wolne | HTTP 429, błędy sieci, brak wyników | Przełączalny endpoint, kopia wskazana przez organizatora, cache danych z rzeczywistym pochodzeniem |
| Brak ważnych dokumentów w projektach | Tylko metadane ogłoszeń | Pokazywać fakty możliwe do potwierdzenia, jawne braki i próby pobrania alternatywnych źródeł |
| Łączenie KPO z BZP niejednoznaczne | Wiele zbliżonych wyników | Kolejka do eksperta; bez automatycznego utrwalania niepewnego powiązania |
| Halucynacje modelu | Cytat niewystępujący w źródle | Walidacja fragmentu przed zapisem; brak potwierdzenia = wniosek niezatwierdzony |
| Przecenione prognozy | Mało wiarygodnych kwot i terminów | Bez przedziałów, gdy dane ich nie uzasadniają; pokazać liczebność i ograniczenia |
| Zbyt ambitny zakres | Brak end-to-end po H10/H16 | Zamrożenie P2; uproszczenie Epidemic Radar i grafu, zachowanie P0 |
| Problem z wdrożeniem | Aplikacja działa tylko u autora | Wczesny deploy, automatyczny start, README i test na czystym środowisku |
| Utrata historii ekspertów | Zmiany tylko w stanie UI | Trwały zapis decyzji oraz ponowny odczyt |
| Nieprawidłowa geolokalizacja | Lokalizacja pochodzi z adresu zamawiającego | Wstrzymać Geo Risk do potwierdzenia miejsca realizacji |

---

## 15. Rozwój po hackathonie

### Faza 1 — pilotaż i walidacja

- Większa próbka projektów wod-kan, referencyjna ocena ekspercka i pomiar jakości połączeń.
- Kalibracja pewności wniosków oraz jakości predykcji kosztów i terminów.
- Obsługa większej liczby dokumentów i wersji; monitoring niedokończonych projektów.
- Zaawansowane wyszukiwanie semantyczne i ocena stopnia podobieństwa.

### Faza 2 — głębsza inteligencja

- Statystyczna identyfikacja powtarzalnych wzorców z kontrolą wielkości próby i czynników zakłócających.
- Dalsza integracja przestrzenna, analiza oddziaływań społecznych i kosztów cyklu życia.
- Więcej scenariuszy Chaos Lab, połączenie z harmonogramem i kosztorysem.
- Benchmarki skuteczności działań zaradczych oraz ich transferowalności między projektami.

### Faza 3 — wielosektorowość

- Katalogi i reguły dla transportu, energetyki, zdrowia, edukacji i innych inwestycji.
- Konfigurowalne szablony sektorowe i etapy inwestycji.
- Operacyjny monitoring zmian, integracja z narzędziami administracji i audyt decyzji.

---

## 16. Decyzje do podjęcia przez zespół na starcie

Te decyzje należy zamknąć **w pierwszych 30 minutach**, bez rozciągania planowania:

1. **Stack:** wybrany frontend, backend, baza i sposób deployu.
2. **LLM:** dostawca/model, limit kosztów, lokalizacja przetwarzania danych i interfejs adaptera.
3. **Najlepszy rekord BZP do demonstracji:** wybrać po rzeczywistym sprawdzeniu dostępności dokumentów, a nie z góry po nazwie.
4. **Drugie źródło:** TED czy BIP/BK2021 — zgodnie z dostępnymi identyfikatorami.
5. **Scenariusz Chaos Lab:** startowo R03/R06, chyba że pozyskany przypadek historyczny lepiej uzasadnia inny.
6. **Osoba integrująca:** odpowiedzialna za ciągłe działanie obu ścieżek P0.
7. **Zasada danych demonstracyjnych:** co jest rzeczywiste, co przykładowe, co jest hipotezą; oznaczać w interfejsie.

---

## 17. Spójna opowieść produktowa

**REMEMBER — CHALLENGE — IMPROVE**

- **REMEMBER:** rekonstruujemy doświadczenia z inwestycji publicznych i odkrywamy udokumentowane problemy.
- **CHALLENGE:** przenosimy zatwierdzone wzorce do kontrolowanych testów nowych projektów.
- **IMPROVE:** wskazujemy najważniejsze braki, środki zaradcze i dowody potrzebne do decyzji.

**Epidemic Radar** wyszukuje sygnały powtarzalnych problemów. **Project Twin** dobiera porównywalne przypadki. **Document Gap Detector** ujawnia, czego nie wiemy. **Risk Graph** pokazuje zależności. **Geo Risk** i **Social Impact** wyjaśniają kontekst. **Evidence Lens** pozwala zweryfikować wyniki. **Expert Studio** zapobiega utrwalaniu błędnych wniosków. **Chaos Lab** zamienia tę wiedzę w proaktywne testowanie.

> **Risk Miner 2.0 nie tylko mówi, co może pójść nie tak. Pokazuje, co poszło nie tak wcześniej, na jakiej podstawie to wiemy i jak sprawdzić gotowość nowej inwestycji, zanim problem wystąpi.**

---

## 18. Źródła planu i uwagi interpretacyjne

### Materiały dostarczone przez organizatora

1. `MFiPR - Pełna treść zadania konkursowego.pdf`, rozdziały 2–9: wymagania funkcjonalne i techniczne, sposób testowania, kryteria oceny i materiały finałowe.
2. `Risk_Miner_dane_projekty.xlsx`, arkusze `Projekty` oraz `Opis kolumn`: faktyczna liczba rekordów, typy identyfikatorów i nazwy pól.
3. `Risk_Miner_material_ekspercki_przygotowanie_inw_wodociagowej.docx`, rozdziały 1–8: problemy przygotowania sieci wodociągowej i zbiorcza lista dziewięciu wymagań informacyjnych.
4. `Risk_Miner_material_porady_fazy_dokumenty_ryzyka_ciekawostki.docx`, rozdziały 1–6: fazy, dokumenty, podsektory, katalog ryzyk R01–R15, warunki odtwarzania umowy, interpretacja niepewności i adres kopii API BZP.

### Co jest autorską koncepcją zespołu, a nie wymogiem organizatora

Nazwy **Institutional Immunity Engine**, **Risk DNA**, **Epidemic Radar**, **Chaos Lab**, **Evidence Lens** i proponowane reguły scoringowe, przykładowa architektura, schemat API oraz harmonogram 24 godzin to **koncepcja i rekomendacje projektowe**. Organizator nie wymaga dokładnie tych nazw, algorytmów ani technologii.

Przykładowe scenariusze (np. opóźnienie o 90 dni) są **parametrami testów**, nie stwierdzeniami o którejkolwiek z 22 dostarczonych inwestycji. Wersja hackathonowa powinna jasno pokazywać różnicę między funkcjami zaimplementowanymi, uproszczeniami a przyszłymi kierunkami rozwoju.
