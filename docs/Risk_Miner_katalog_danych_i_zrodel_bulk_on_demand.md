# Risk Miner 2.0 — katalog danych i źródeł (baza trwała + on-demand)

**Wersja:** 1.0  
**Stan rozpoznania źródeł:** 21 listopada 2026 r.  
**Zakres:** inwestycje publiczne wodociągowo-kanalizacyjne w Polsce, w tym wykonawcy i podwykonawcy krajowi oraz zagraniczni, a także ich historyczne realizacje.  
**Cel:** specyfikacja integracji i zakresu danych dla *Risk Miner 2.0 — Institutional Immunity Engine*, w tym Project Twin, Risk DNA, Chaos Lab i monitorowania inwestycji.

> **Ważne:** „dane są publiczne” **nie oznacza automatycznie** „wolno scrapować cały serwis i przechowywać jego treść bez ograniczeń”. Poniższe rozstrzygnięcia opisują **zalecany model techniczny**, a nie bezwarunkową zgodę prawną. Przed wdrożeniem każdego konektora sprawdzić regulamin/API, licencję konkretnego zbioru, prawa do dokumentów, ograniczenia dostępu, RODO, limity oraz aktualność informacji. Gdzie istnieje oficjalne API, usługa WFS lub pliki do pobrania, **preferować je zamiast scrapowania HTML**.

## Spis treści

1. [Model dostępu do danych](#1-model-dostępu-do-danych)
2. [Dane do regularnego pobierania i zapisu w bazie](#2-dane-do-regularnego-pobierania-i-zapisu-w-bazie)
3. [Dane o firmach krajowych i zagranicznych — on-demand](#3-dane-o-firmach-krajowych-i-zagranicznych--on-demand)
4. [Historia wcześniejszych realizacji konkretnej firmy — on-demand](#4-historia-wcześniejszych-realizacji-konkretnej-firmy--on-demand)
5. [Jak odkrywać podwykonawców w dokumentach](#5-jak-odkrywać-podwykonawców-w-dokumentach)
6. [Minimalny model danych i zasady analizy](#6-minimalny-model-danych-i-zasady-analizy)
7. [Zgodność, licencje i bezpieczeństwo](#7-zgodność-licencje-i-bezpieczeństwo)
8. [Priorytety realizacji MVP](#8-priorytety-realizacji-mvp)
9. [Mapa ryzyk R01–R15 do źródeł](#9-mapa-ryzyk-r01r15-do-źródeł)

---

## 1. Model dostępu do danych

| Kod | Model | Co zapisujemy | Kiedy używać |
|---|---|---|---|
| **B** | **Baza trwała / cykliczny import** | Wybrane rekordy, metadane, znormalizowane dane, geometrie lub cechy i dowody, zgodnie z warunkami źródła | Źródła sektorowe, dane terytorialne, zdarzenia inwestycyjne, statystyki i warstwy GIS |
| **P** | **Dane dotyczące projektu — pobrane i utrwalane** | Rekordy konkretnego projektu, kontraktu, dokumentu, zmiany, zdarzenia; przechowywanie pełnej treści dokumentów tylko gdy dozwolone | BZP, TED, dokumenty inwestycji, BIP, KIO, NIK |
| **OD** | **On-demand** | Na żądanie odczyt pojedynczego podmiotu; w bazie głównie identyfikator, potwierdzone relacje i metadane dowodu | KRS, CEIDG, VIES, zagraniczne rejestry, historyczne realizacje konkretnych firm |
| **W** | **Warunkowe / dane dostarczane przez użytkownika** | Dane tylko od uprawnionego podmiotu i na jasno określony cel | SCADA, CCTV sieci, awarie, umowy podwykonawcze, dane operacyjne, poufne projekty |

**Hierarchia pozyskiwania:** oficjalne API → oficjalny plik danych (CSV/XLSX/GeoJSON/GPKG/SHP/XML) → WFS/usługa pobierania → publiczny dokument → ekstrakcja z HTML/PDF, gdy zgodna z warunkami serwisu. **WMS to przede wszystkim obraz mapy**, nie zamiennik danych wektorowych do obliczeń przestrzennych.

**Granularność obowiązkowa:** oddzielić `projekt → postępowanie → część → ogłoszenie → kontrakt → zmiana → zdarzenie → dokument`. Inwestycja może zawierać wiele postępowań i umów; wartość projektu nie jest wartością jednej umowy. Lokalizacja siedziby zamawiającego **nie jest** automatycznie lokalizacją robót.

---

## 2. Dane do regularnego pobierania i zapisu w bazie

### 2.1. Historia zamówień, kontraktów, zmian i zdarzeń

| ID | Zbiór / dane do pobrania | Główne pola | Źródło i sposób dostępu | Model / priorytet | Zastosowanie |
|---|---|---|---|---|---|
| Z01 | Ogłoszenia o zamówieniach | nr BZP, identyfikator postępowania, OCID, CPV, zamawiający, opis, wartość szacowana, terminy | [e-Zamówienia — dokumentacja API](https://ezamowienia.gov.pl/pl/integracja/) — **API BZP** | P / **P0** | Identyfikacja i łączenie postępowań |
| Z02 | Wynik postępowania i udzielenie zamówienia | wykonawca, identyfikatory, cena oferty/umowy, data, część zamówienia | [e-Zamówienia](https://ezamowienia.gov.pl/pl/integracja/) — **API BZP** | P / **P0** | Początkowa wartość i wykonawca kontraktu |
| Z03 | Zmiany umów i ich przyczyny | rodzaj zmiany, podstawa prawna, data, nowa wartość/termin, uzasadnienie | [e-Zamówienia](https://ezamowienia.gov.pl/pl/integracja/) — **API BZP** | P / **P0** | R06/R07/R13, rekonstrukcja zdarzeń |
| Z04 | Wykonanie umowy | data wykonania, faktyczna wypłata, zmiany, należyte wykonanie (o ile opublikowano) | [e-Zamówienia](https://ezamowienia.gov.pl/pl/integracja/) — **API BZP** | P / **P0** | Odchylenia terminów i kosztów |
| Z05 | Unijne postępowania i wyniki | nr TED, wykonawca, NUTS, CPV, wartość, daty, części, informacje o podwykonawstwie *jeśli są* | [TED Search API](https://docs.ted.europa.eu/api/latest/search.html) — **API**, XML/eForms | P / **P1** | Duże i międzynarodowe zamówienia |
| Z06 | Zapytania i wyniki dla projektów objętych zasadą konkurencyjności | zamawiający, przedmiot, oferty/wynik, dokumenty | [Baza Konkurencyjności](https://bazakonkurencyjnosci.funduszeeuropejskie.gov.pl/) — portal, dokumenty; **sprawdzić bieżącą metodę integracji** | P / P1 | Rozszerzenie poza Pzp |
| Z07 | SWZ, PFU, OPZ, STWiORB, projekt, przedmiar, PPU/SWU, Q&A i modyfikacje | zakres robót, parametry, materiały, zależności, podział odpowiedzialności, daty i wersje | Platforma zakupowa konkretnego zamawiającego; załączniki BZP/TED, jeśli dostępne | P / **P0** | Ekstrakcja R01–R15, analiza luk |
| Z08 | BIP: umowy, rejestry, WPF, uchwały, raporty i komunikaty | budżet, finansowanie, zmiany, etapy, lokalizacja, podmioty | BIP gmin, spółek komunalnych i jednostek publicznych — publiczne strony/pliki; bez uniwersalnego API | P / P1 | Potwierdzanie finansowania i zmian |
| Z09 | Kontrole, orzeczenia i ustalenia | sygnatura, opis problemu, ustalenia, zalecenia, związane podmioty i zamówienia | [KIO — wyszukiwarka orzeczeń](https://orzeczenia.uzp.gov.pl/Home/Search), [NIK — wyniki kontroli](https://www.nik.gov.pl/kontrole/wyniki-kontroli-nik/) — portale/dokumenty | P / P2 | Źródła przyczyn, skutków i działań naprawczych |
| Z10 | Projekty UE/KPO i finansowanie | identyfikator projektu CST/KPO, beneficjent, tytuł, kwoty, zakres, program, termin | [Fundusze Europejskie — listy projektów](https://funduszeeuropejskie.gov.pl/) i pakiet organizatora; pliki/portale | P / **P0** | Łączenie projektu z kontraktami |
| Z11 | Harmonogramy, protokoły, roszczenia i odbiory | termin bazowy/aktualny, przerwy, zdarzenia, skutki, parametry prób | Dokumenty publiczne lub udostępnione przez inwestora; nie ma kompletnej ogólnopolskiej bazy | P/W / P1 | Najsilniejsze dowody rzeczywistych problemów |

**Ważne:** API BZP ma limity żądań obowiązujące od października 2026 r.; stosować kolejkę, backoff i identyfikację zmian. W materiałach MFiPR wskazano też *hackathonową kopię wybranych danych BZP* `https://bzp.cytr.us` (alternatywa konkursowa; nie zakładać jej trwałej dostępności ani tego samego statusu co źródło urzędowe).

### 2.2. Dane stricte wodociągowo-kanalizacyjne

| ID | Zbiór / dane | Pola, które warto zapisać | Źródło i sposób dostępu | Model / priorytet | Analiza |
|---|---|---|---|---|---|
| W01 | Aglomeracje kanalizacyjne | kod/nazwa aglomeracji, RLM, gminy, zakres, rok raportu | [KPOŚK / AKPOŚK — Wody Polskie](https://www.gov.pl/web/wody-polskie/krajowy-program-oczyszczania-sciekow-komunalnych), [gospodarka ściekowa MI](https://www.gov.pl/web/infrastruktura/gospodarka-sciekowa) — XLSX i raporty | B / **P1** | Porównanie skali i zgodności zamierzenia |
| W02 | Oczyszczalnie w aglomeracjach | obiekt/aglom., przepustowość, RLM, typ i rozbudowa, daty | KPOŚK, coroczne sprawozdania Wód Polskich — XLSX/tabele, zakres zależny od wydania | B / P1 | Planowanie rozbudowy oczyszczalni |
| W03 | Wskaźniki sieci wod-kan | długość sieci, przyłącza, ludność korzystająca, korzystanie z oczyszczalni | [GUS BDL API](https://api.stat.gov.pl/home/bdlapi) — JSON/API | B / **P1** | Koszt/km, sieć na mieszkańca, Project Twin |
| W04 | JCW — jednolite części wód | identyfikator, stan, cele środowiskowe, charakterystyka | [SIGW / Hydroportal](https://www.gov.pl/web/wody-polskie/udostepnianie-danych-z-systemu-informacyjnego-gospodarowania-wodami) — mapy/usługi/wybrane pliki | B / P1 | Ryzyko środowiskowe i odbiornik ścieków |
| W05 | Jakość wód powierzchniowych | stacja, data, parametry i ocena stanu, jednostka | [GIOŚ — otwarte API](https://dane.gios.gov.pl/) — **SURFACE WATER API** | B / P1 | Rozpoznanie odbiornika i otoczenia |
| W06 | Jakość wód podziemnych | punkt, data, parametry i ocena, lokalizacja | [GIOŚ API](https://dane.gios.gov.pl/) — **GROUNDWATER API**; [PIG PSH](https://www.pgi.gov.pl/psh/dane-hydrogeologiczne-psh.html) | B / P1 | Zasoby/warunki ujęć, kontekst jakości |
| W07 | Monitoring ilościowy wód podziemnych i GZWP | zbiornik, punkty, głębokość zwierciadła, pomiary, czas | [PIG — dane hydrogeologiczne](https://www.pgi.gov.pl/psh/dane-hydrogeologiczne-psh.html), [HydroGeoPortal](https://www.pgi.gov.pl/psh/psh-2/dane-online.html) | B / P1 | Warunki hydrogeologiczne, dostępność zasobów |
| W08 | Pobór wody i gospodarowanie zasobami | wolumen, obszar, rok, kategoria zastosowania | [GUS BDL API](https://api.stat.gov.pl/home/bdlapi), [PIG — dane hydrogeologiczne](https://www.pgi.gov.pl/psh/dane-hydrogeologiczne-psh.html) | B / P2 | Kontekst zapotrzebowania na wodę |
| W09 | Jakość wody przeznaczonej do spożycia | rodzaj wodociągu, liczba odbiorców, badane parametry, przekroczenia (wg raportu) | [GIS — badania i ocena wody](https://www.gov.pl/web/gis/badania-i-ocena-wody2), raporty WSSE/PSSE — PDF/raporty | B/P / P2 | Kontekst uzdatniania; dane często zagregowane |
| W10 | Instalacje i transfer zanieczyszczeń | zakład, emisje/transfery do wody i gleby, rok, rodzaj substancji | [GIOŚ — PRTR API](https://dane.gios.gov.pl/), [rejestr PRTR](https://www.gov.pl/web/gios/rejestr-prtr) | B / P2 | Oddziaływanie instalacji, tło środowiskowe |
| W11 | Pozwolenia/zgody wodnoprawne | organ, decyzja, zakres, data, ważność, warunki, lokalizacja — **o ile opublikowane** | [Wody Polskie — pozwolenia](https://www.gov.pl/web/wody-polskie/pozwolenie-wodnoprawne), BIP właściwych organów — decyzje/obwieszczenia | P / P1 | R04, harmonogram formalności |
| W12 | Taryfy woda/ścieki | operator, okres, stawka, grupa odbiorców, decyzja | [Wody Polskie — informacja taryfowa](https://www.gov.pl/web/wody-polskie/informacja-taryfowa), BIP/operatorzy — dokumenty, różna kompletność | B/P / P2 | Ekonomika eksploatacji, kontekst kosztów |
| W13 | Planowane inwestycje wod-kan | obiekt, inwestor, zakres, etap, wartość, harmonogram, źródło finansowania | KPOŚK/AKPOŚK, BIP gmin/operatorów, [NFOŚiGW](https://www.gov.pl/web/nfosigw/) | B/P / P2 | Zależności między inwestycjami |
| W14 | Parametry technologiczne z dokumentów projektów | średnica i materiał rur, długość, pompownie, technologia, wydajność, BZT₅/ChZT/N/P, RLM | PFU, OPZ, projekt, STWiORB, raporty inwestora/operatora; ekstrakcja **z dokumentów powiązanych z projektem** | P / **P1** | Właściwe porównywanie podobnych projektów |

**Nie utożsamiać:** danych monitoringu wód z laboratoryjnym badaniem konkretnego ujęcia; RLM z liczbą osób; danych zagregowanych dla gminy z parametrami pojedynczej oczyszczalni. Dane PIG/PSH mogą istnieć w bazie, ale **nie cały ich zakres** musi być bez ograniczeń dostępny do masowego odczytu.

### 2.3. Dane geograficzne, geotechniczne, środowiskowe

| ID | Zbiór / dane | Pola/obiekty | Źródło / sposób dostępu | Model / priorytet | Przykładowe zastosowanie |
|---|---|---|---|---|---|
| G01 | Podział administracyjny, miejscowości i ulice | TERYT, nazwy, typ jednostki, hierarchia, daty obowiązywania | [GUS TERYT API](https://api.stat.gov.pl/Home/TerytApi) | B / **P0** | Normalizacja lokalizacji i dopasowanie projektów |
| G02 | Rzeźba terenu / NMT | wysokości, spadki, profil terenu, rozdzielczość | [Geoportal — NMT](https://www.geoportal.gov.pl/pl/dane/numeryczny-model-terenu-nmt/) — pliki/usługi GUGiK | B (obszarowo) / P1 | Warunki trasy, grawitacyjność kanalizacji |
| G03 | Obiekty topograficzne | drogi, cieki, koleje, budynki, mosty, przeszkody | [Geoportal — BDOT10k](https://www.geoportal.gov.pl/pl/dane/baza-danych-obiektow-topograficznych-bdot10k/) — pliki/analizy | B / **P1** | Przecięcia trasy z przeszkodami |
| G04 | Działki i geometrie ewidencyjne | ID działki, geometria, obręb, granice | [Geoportal — EGiB](https://www.geoportal.gov.pl/pl/dane/ewidencja-gruntow-i-budynkow-egib/) — wybrane dane do pobrania, ULDK/WFS | B/P / P1 | Liczba działek przecinanych przez trasę; **bez wnioskowania o właścicielach** |
| G05 | Istniejące uzbrojenie | rodzaj i orientacyjny przebieg sieci, punkty infrastruktury | [Geoportal — GESUT](https://www.geoportal.gov.pl/pl/dane/uzbrojenie-terenu-gesut/) — dostęp i kompletność zależą od obszaru | B/P / P1 | Wstępne potencjalne kolizje, nie formalne uzgodnienie |
| G06 | Mapa zagrożenia/ryzyka powodziowego | obszary/poziomy zagrożenia, scenariusze, geometrie | [Wody Polskie — SIGW/Hydroportal](https://www.gov.pl/web/wody-polskie/udostepnianie-danych-z-systemu-informacyjnego-gospodarowania-wodami) — WMS/usługi pobierania | B / **P1** | Zagrożenie zalaniem urządzeń |
| G07 | Susza, hydrologia i zasoby | obszary ryzyka suszy, cieki, JCW, dostępne plany | [Hydroportal](https://wody.isok.gov.pl/hydroportal.html) — mapy i dostępne usługi | B / P2 | Warunki poboru, retencji i zasilania |
| G08 | Obszary chronione | Natura 2000, rezerwaty, parki, formy ochrony i granice | [GDOŚ — dane geoprzestrzenne](https://www.gov.pl/web/gdos/dostep-do-danych-geoprzestrzennych) — WMS/wybrane pliki | B / **P1** | R04, konieczne uzgodnienia i OOŚ |
| G09 | Geologia i otwory wiertnicze | typ gruntu, profil otworu, lokalizacja, dostępne wyniki | [PIG — CBDG Geoportal](https://baza.pgi.gov.pl/geoportal), [Menedżer pobierania CBDG](https://baza.pgi.gov.pl/geoportal/dm) | B/P / P1 | Wstępne ryzyko robót ziemnych |
| G10 | Hydrogeologia | poziomy wodonośne, GZWP, dane monitoringu, warunki ujęć | [PIG PSH](https://www.pgi.gov.pl/psh/dane-hydrogeologiczne-psh.html) | B/P / P1 | Zmienność warunków gruntowo-wodnych |
| G11 | Osuwiska i tereny zagrożone | geometria, klasyfikacja, aktualność inwentaryzacji | [PIG — SOPO](https://mapa.osuwiska.pgi.gov.pl/) — portal/mapy, sprawdzić usługę pobierania | B/P / P2 | Ryzyko osuwiskowe |
| G12 | Planowanie przestrzenne | przeznaczenie terenów, plan miejscowy, ograniczenia lokalizacyjne | [Rejestr Urbanistyczny](https://rejestr-urbanistyczny.gov.pl/published), BIP i SIP gmin — dokumenty/dane zależne od gminy | P / P2 | R03/R04, kolizje planistyczne |
| G13 | Hydrometeorologia historyczna | opady, temperatura, stacje, data, przepływy/stany wód | [IMGW — dane publiczne/API](https://danepubliczne.imgw.pl/apiinfo) | B / **P1** | Sezonowość i ryzyko pogodowe |
| G14 | Mapa jakości środowiska | punkty monitoringu, wyniki, jednostki, daty | [GIOŚ API](https://dane.gios.gov.pl/) | B / P2 | Warunki środowiskowe projektu |

**Warunek użycia GIS:** przypisać ryzyko przestrzenne do **potwierdzonej geometrii inwestycji** (linia planowanej sieci, punkt stacji uzdatniania, poligon oczyszczalni) i do warstwy o znanej skali/rozdzielczości. Sama lokalizacja gminy, siedziby zamawiającego czy centroid miejscowości nie uzasadnia twierdzenia, że trasa „przecina” konkretny obiekt.

### 2.4. Dane ekonomiczne, społeczne, planistyczne i referencyjne

| ID | Dane | Źródło | Dostęp / model | Zastosowanie |
|---|---|---|---|---|
| E01 | Ludność, gęstość zaludnienia, gospodarstwa, mieszkania, budownictwo | [GUS BDL API](https://api.stat.gov.pl/home/bdlapi) | API / B / **P1** | Potencjał odbiorców, skala projektu |
| E02 | Wskaźniki rozwoju infrastruktury i gospodarki komunalnej | [GUS BDL API](https://api.stat.gov.pl/home/bdlapi) | API / B / **P1** | Porównanie gmin i projektów |
| E03 | Inflacja, wskaźniki cen produkcji budowlano-montażowej | [GUS — wskaźniki cen](https://stat.gov.pl/obszary-tematyczne/ceny-handel/wskazniki-cen/) | Tabele/XLSX/raporty / B / P1 | Normalizacja historycznych kosztów do wspólnego poziomu cen |
| E04 | Budżety JST, WPF, wielkość finansowania inwestycji | BIP właściwych JST, uchwały budżetowe, WPF | Dokumenty / P / P2 | Ocena finansowania R13 |
| E05 | Dofinansowanie UE i NFOŚiGW | [Fundusze Europejskie](https://funduszeeuropejskie.gov.pl/), [NFOŚiGW](https://www.gov.pl/web/nfosigw/) | Portale/pliki / P / P2 | Powiązanie z programem i warunkami finansowania |
| E06 | Nazwy miejscowości i podział administracyjny | [GUS TERYT API](https://api.stat.gov.pl/Home/TerytApi) | API / B / **P0** | Stabilne klucze łączenia danych |
| E07 | Klasyfikacje CPV / NUTS | [TED Developer Docs](https://docs.ted.europa.eu/), [Eurostat NUTS](https://ec.europa.eu/eurostat/web/nuts) | Słowniki / B / **P0** | Jednolite typowanie zamówień i lokalizacji |

### 2.5. Dane *niepubliczne lub niepełne* — import wyłącznie od uprawnionego właściciela

| Dane | Typowe miejsce posiadania | Po co przyjmować | Tryb |
|---|---|---|---|
| Schemat i inwentaryzacja czynnych sieci z dokładnością operacyjną | przedsiębiorstwo wod-kan / GIS/asset management | Weryfikacja kolizji, przebudowa, parametry | **W** |
| Awarie, wiek rur, materiały, średnice, historia napraw | operator sieci / CMMS/EAM | Ocena awaryjności, priorytety modernizacji | **W** |
| Ciśnienia, przepływy, SCADA, bilanse i straty wody | operator / systemy przemysłowe | Zdolność zasilania, hydraulika | **W** |
| Inspekcje CCTV kanałów, infiltracja i nieszczelności | operator / wykonawca diagnostyki | Ryzyko stanu istniejącego | **W** |
| Laboratoryjne wyniki konkretnych ujęć i oczyszczalni | operator / akredytowane laboratorium | Dobór technologii i rozruch | **W** |
| Faktyczne zgłoszenia podwykonawców, umowy, akceptacje i płatności | zamawiający / generalny wykonawca | Potwierdzenie rzeczywistego udziału | **W** |
| Dziennik budowy, harmonogramy, protokoły robót i roszczenia | inwestor, inspektor nadzoru, wykonawca | Dokładna identyfikacja przyczyn i skutków | **W** |

**Zasada:** brak danych eksploatacyjnych w publicznym internecie ≠ brak awarii, uzgodnienia, wykonanych badań czy podwykonawcy. System zapisuje `NOT_AVAILABLE`, `NOT_FOUND`, `NOT_MENTIONED`, `CONFIRMED_ABSENT` jako **różne stany**.

---

## 3. Dane o firmach krajowych i zagranicznych — on-demand

**Cel:** po wykryciu nazwy podwykonawcy/wykonawcy albo przy analizie wskazanej firmy pobrać **jeden podmiot**, zweryfikować jego tożsamość i wyciągnąć odpowiednie fakty bez tworzenia hurtowni wszystkich firm.

### 3.1. Polska

| ID | Rejestr | Identyfikator zapytania | Dane do pobrania dla jednej firmy | Sposób i źródło | Ograniczenia / zalecany zapis |
|---|---|---|---|---|---|
| PL01 | **KRS** | przede wszystkim KRS; wstępne mapowanie NIP/REGON | nazwa, status, siedziba, forma prawna, wybrane dane rejestrowe, historia wpisów | [Portal Rejestrów Sądowych / API KRS](https://prs.ms.gov.pl/krs/openApi) — publiczne API | OD; nie zakładać, że REST API ujawnia wszystkie dane osobowe widoczne w odpisach |
| PL02 | **CEIDG** | NIP/REGON/nazwa, zależnie od API | status JDG, nazwa działalności, daty, PKD, dostępne dane rejestrowe | [Dane Biznes.gov.pl](https://dane.biznes.gov.pl/) i [dokumentacja API CEIDG](https://pliki.biznes.gov.pl/akademia/20250117/HD%20CEIDG%20-%20API%20v3%20HD%20-%20Dokumentacja%20dla%20integrator%C3%B3w%20v1.1.pdf) | OD; wymaga dostępu/tokena; **RODO** dla jednoosobowych działalności |
| PL03 | **REGON (BIR)** | NIP lub REGON | nazwa, REGON, PKD, adres, typ/status jednostki wg rejestru | [GUS — API REGON](https://api.stat.gov.pl/Home/RegonApi?lang=pl) — API z kluczem | OD; przydatne do normalizacji, nie dowodzi doświadczenia w budownictwie |
| PL04 | **Wykaz podatników VAT** | NIP/REGON/rachunek, zależnie od usługi | status VAT na dzień, podstawowe dane rejestrowe | [MF — API wykazu VAT](https://www.gov.pl/web/kas/api-wykazu-podatnikow-vat) | OD; nie interpretować „braku czynnego VAT” automatycznie jako niezdolności do realizacji |
| PL05 | **Repozytorium dokumentów finansowych KRS** | KRS | złożone roczne sprawozdania finansowe, jeśli dostępne | [PRS — RDF/KRS](https://prs.ms.gov.pl/krs/) — portal i dokumenty | OD; analiza konkretnej spółki, treść/rozpowszechnianie zgodnie z warunkami |
| PL06 | **KRZ** | dane wyszukiwawcze dopuszczone przez portal | publiczne informacje o określonych postępowaniach restrukturyzacyjnych/upadłościowych itp. | [KRZ](https://www.gov.pl/web/sprawiedliwosc/krajowy-rejestr-zadluzonych) — portal | OD/manual; **nie zakładać istnienia ogólnodostępnego API**; ograniczyć dane i uwzględnić kontekst |

### 3.2. Unia Europejska i podmioty zagraniczne

| ID | Zasięg / źródło | Identyfikator | Dane o pojedynczym podmiocie | Dostęp | Uwagi |
|---|---|---|---|---|---|
| INT01 | **UE — VIES** | VAT UE (prefiks kraju + numer) | potwierdzenie ważności VAT UE na dzień weryfikacji; ewentualnie nazwa/adres, jeśli udostępnia państwo | [Komisja Europejska — VIES](https://ec.europa.eu/taxation_customs/vies/) — usługa online | OD; **to nie jest pełny rejestr firm**, a brak ważnego VAT UE ≠ brak firmy |
| INT02 | **UE/EOG — BRIS** | nazwa/nr krajowego rejestru / EUID, gdzie dostępny | wpis i status spółki z rejestru państwa członkowskiego | [Europejski portal e-Sprawiedliwość — BRIS](https://e-justice.europa.eu/topics/registers-business-insolvency-land/business-registers-search-company-eu/general-information-find-company_pl) — portal | OD; dane aktualizowane z rejestrów krajowych; **nie zakładać publicznego API BRIS** |
| INT03 | **Wielka Brytania — Companies House** | company number, nazwa | status, adres, rodzaj spółki, dokumenty, filing history | [Companies House API](https://developer.company-information.service.gov.uk/) — REST API, klucz | OD; nie obejmuje automatycznie wszystkich form działalności ani kontraktów |
| INT04 | **Francja — API Recherche d'Entreprises** | SIREN/SIRET, nazwa | nazwa, identyfikator, adres, status, działalność — zależnie od widoku i ograniczeń | [API Recherche d'Entreprises](https://recherche-entreprises.api.gouv.fr/docs/) — REST API | OD; pierwszoplanowy identyfikator **SIREN/SIRET**, nie polski NIP |
| INT05 | **Czechy — ARES** | IČO | dane identyfikacyjne firmy, wpisy powiązane | [ARES Swagger/API](https://ares.gov.cz/swagger-ui/) — REST API | OD; używać **IČO** i sprawdzać zasady ruchu/API |
| INT06 | **Niemcy — Unternehmensregister** | nazwa, numer rejestrowy (HRB/HRA), sąd | dostępne dane rejestrowe i dokumenty/ogłoszenia | [Unternehmensregister](https://www.unternehmensregister.de/en) — portal | OD, początkowo link/manual; **nie oznaczać jako potwierdzone otwarte REST API** |
| INT07 | **Wiele krajów — GLEIF** | LEI, nazwa | LEI, nazwa, adres, status i wybrane powiązania jednostek | [GLEIF API](https://www.gleif.org/en/lei-data/gleif-api/) — REST API | OD; **tylko podmioty z LEI**, a nie pełny katalog przedsiębiorstw |
| INT08 | **Wiele krajów — OpenCorporates** | jurysdykcja + numer/nazwa | ujednolicone profile firm, numery rejestrowe, zależnie od planu | [OpenCorporates API](https://api.opencorporates.com/documentation/API-Reference) — API komercyjne/warunkowe | OD; sprawdzić opłaty, licencję, możliwość redystrybucji i cache |
| INT09 | **UE — wyszukiwarki upadłości** | kraj + numer/nazwa | informacje dostępne w połączonych krajowych rejestrach | [e-Justice — rejestry upadłości](https://e-justice.europa.eu/topics/registers-business-insolvency-land/bankruptcy-insolvency-registers-search-insolvent-debtors-eu/general-information-interconnected-registers_en) — portal | OD/manual; zakres państw i danych jest niejednorodny |

**Zalecany wynik `company_lookup`:** `country`, `registry_type`, `registry_id`, `name`, `status`, `status_as_of`, `source_url`, `checked_at`, `match_method`, `match_confidence`, `cache_expires_at`, `raw_data_retention_policy`.

**Uwaga:** `KRS`, `CEIDG`, `VIES`, `LEI`, `IČO`, `SIREN`, `company_number` to **różne identyfikatory**. Konieczna tabela mapowania z nazwą jurysdykcji i źródłem. Samo podobieństwo nazwy nie wystarcza do automatycznego połączenia.

---

## 4. Historia wcześniejszych realizacji konkretnej firmy — on-demand

**Rejestr przedsiębiorców nie jest rejestrem wszystkich realizowanych robót.** Aby ustalić doświadczenie wykonawcy/podwykonawcy w sektorze wod-kan, trzeba wyszukać **kontrakty**, w których ten podmiot jest jednoznacznie wskazany, i powiązać je z dokumentacją wykonania.

### 4.1. Gdzie szukać przeszłych kontraktów

| ID | Zasięg / źródło | Sposób wyszukania | Co można ustalić | Ważne ograniczenie |
|---|---|---|---|---|
| H01 | **Polska — BZP/e-Zamówienia** | NIP/REGON lub nazwa firmy w polach/treściach ogłoszeń; dalej numer postępowania | wykonawca, przedmiot, wartość, daty, zmiany i wykonanie | dostępne pola zależą od ogłoszenia; podwykonawcy nie zawsze ujawnieni; [API](https://ezamowienia.gov.pl/pl/integracja/) |
| H02 | **UE — TED** | dane organizacji, nazwa, kraj, CPV, NUTS, okres; identyfikator zamówienia | historyczne ogłoszenia i wyniki, wybrane dane podwykonawstwa | struktura i kompletność różne między eForms i starszymi formularzami; [API](https://docs.ted.europa.eu/api/latest/search.html) |
| H03 | **Francja — BOAMP** | nazwa/SIREN/SIRET, obszar, zamawiający, zamówienia | ogłoszenia i wyniki, szczegóły zależnie od rodzaju zamówienia | [BOAMP API](https://www.boamp.fr/pages/api-boamp/) — dostęp z rejestracją/dokumentacją |
| H04 | **Wielka Brytania — Contracts Finder** | nazwa dostawcy, keywords, kategoria | ogłoszenia, przyznane kontrakty, wartości i daty | [Contracts Finder / open contracting](https://www.gov.uk/government/publications/open-contracting); [opis danych](https://www.data.gov.uk/collections/government-and-parliament/contracts-finder) |
| H05 | **Wielka Brytania — Find a Tender** | dostawca, nazwa i numery ogłoszeń | duże zamówienia UK; ogłoszenia i wyniki | [Find a Tender](https://www.find-tender.service.gov.uk/) — portal i materiały techniczne; sprawdzić aktualne API dla produkcji |
| H06 | **Pozostałe państwa UE** | państwo + nazwa/ID firmy + CPV | kontrakty krajowe spoza TED | krajowe portale zamówień; **adapter tylko po weryfikacji** istnienia API/warunków; najpierw TED |
| H07 | **Źródła lokalne** | wykonawca + zamawiający + nazwa zamówienia | dalsze dokumenty, referencje, informacje o realizacji, ewentualne zgłoszenia podwykonawców | BIP i platformy zakupowe właściwych jednostek; brak jednego API |
| H08 | **Wewnętrzna baza Risk Miner** | dokładny `company_id` i powiązania do `contract_id` | tylko wcześniejsze przypadki potwierdzone w systemie | nie zastępuje wyszukiwania zewnętrznego |

### 4.2. Jakie pola wyliczać dla znalezionej realizacji

| Pole / cecha | Metoda | Czy wolno traktować jako pewne? |
|---|---|---|
| Numer kontraktu, zamawiający, kraj, CPV, zakres | ekstrakcja z ogłoszenia i dokumentów | Tak, **jeśli** dowód potwierdza tożsamość kontraktu |
| Rola firmy: wykonawca, konsorcjant, planowany podwykonawca, zgłoszony podwykonawca, podwykonawca potwierdzony | informacje z wyniku/umowy/oferty/zgłoszenia | Tylko z oznaczeniem rodzaju dowodu i statusu |
| Kwota pierwotna i końcowa | ogłoszenie o wyniku, zmiana, wykonanie | Po ujednoliceniu waluty, netto/brutto i zakresu |
| Termin początkowy i faktyczny | umowa/ogłoszenia/odbiór | Po weryfikacji definicji dat i części zadania |
| Przekroczenie wartości [%] | `(wartość końcowa - początkowa) / początkowa` | Wskaźnik kontraktu, **nie automatycznie wina wykonawcy** |
| Opóźnienie [dni] | `data rzeczywistego wykonania - termin bazowy` | Wskaźnik kontraktu; trzeba zbadać przyczynę |
| Rodzaj robót (np. HDD, przepompownia, oczyszczalnia) | CPV + tekst PFU/OPZ/umowy | Weryfikacja zakresu technicznego, nie tylko PKD |
| Potwierdzone zdarzenia R01–R15 | dokument + fragment + ekspercka ocena | Dopiero po zatwierdzeniu eksperta |
| „Doświadczenie w HDD” albo „kontrakty podobnej skali” | dopasowanie opisów technicznych i parametrów | Często **wniosek**, nie twardy fakt rejestrowy |

**Bardzo ważne:** firmie można przypisać historyczną *obecność* w kontrakcie na podstawie dowodu; nie można automatycznie przypisać jej odpowiedzialności za opóźnienie, wzrost kosztów ani spór. Brak znalezionych kontraktów oznacza tylko **brak potwierdzonych realizacji w przeszukanych źródłach**, nie brak doświadczenia.

---

## 5. Jak odkrywać podwykonawców w dokumentach

W większości państw **nie ma kompletnego centralnego rejestru relacji `kontrakt → wszyscy faktyczni podwykonawcy`**. Identyfikacja wymaga przeglądania dokumentów powiązanych z zamówieniem.

| Dokument / pole | Potencjalna informacja | Źródło |
|---|---|---|
| Ogłoszenie o wyniku, szczegóły organizacji i roli | wykonawca, konsorcjanci, czasami podwykonawca | BZP/TED, zwłaszcza eForms |
| TED eForms: `BT-773` i organizacje o roli `Subcontractor` | zamiar podwykonawstwa / rola organizacji, jeśli zgłoszona | [TED — business terms](https://docs.ted.europa.eu/eforms/latest/reference/business-terms/), [TED — parties](https://docs.ted.europa.eu/eforms/latest/schema/parties.html) |
| Formularz ofertowy / wykaz podwykonawców | planowany podwykonawca, powierzany zakres, czasem podmiot | SWZ i załączniki na platformie zakupowej |
| Zgłoszenia i akceptacje podwykonawców | faktyczna relacja i jej zakres | dokumentacja zamawiającego — nie zawsze publiczna |
| Umowy i aneksy | zmiana wykonawcy lub podwykonawcy, dodatkowe roboty | BIP / dokumenty udostępnione |
| Protokoły, komunikaty, dokumenty wykonania | wykonawcy poszczególnych robót | inwestor/operator; dostępność niepewna |

**Pipeline odkrywania:**

1. `contract_id` → pobierz **dokumenty tego kontraktu**, nie cały internet.
2. Rozpoznaj wersje i etapy: ogłoszenie → oferta → wynik → umowa → aneksy → wykonanie.
3. Ekstrahuj `organisation_name`, `registry_id`, `country`, `role`, `work_scope` oraz fragment uzasadniający.
4. Rozróżnij `PLANNED`, `DECLARED`, `APPROVED`, `CONFIRMED_PERFORMED`, `UNVERIFIED`.
5. Uruchom `company_lookup` **on-demand** tylko dla rozpoznanej firmy.
6. Ustal tożsamość po numerze rejestrowym; przy samej nazwie oznacz `AMBIGUOUS` i wyślij do eksperta.
7. Zapisz minimalny `company_contract_relation` i dowód; nie twórz listy rzekomo „wszystkich podwykonawców”.

---

## 6. Minimalny model danych i zasady analizy

### 6.1. Zalecane tabele / kolekcje

| Tabela | Kluczowe pola |
|---|---|
| `projects` | `project_id`, `cst_or_kpo_id`, `title`, `sector`, `subsector`, `location_status`, `geometry_id` |
| `procurements` | `procurement_id`, `project_id`, `ocid`, `buyer_id`, `cpv`, `title`, `status` |
| `lots` | `lot_id`, `procurement_id`, `lot_number`, `scope` |
| `contracts` | `contract_id`, `procurement_id`, `lot_id`, `original_value`, `currency`, `vat_basis`, `original_deadline` |
| `contract_changes` | `change_id`, `contract_id`, `kind`, `change_date`, `new_value`, `new_deadline`, `evidence_id` |
| `risk_events` | `event_id`, `contract_id`, `risk_code`, `event_type`, `cause_status`, `impact_cost`, `impact_days`, `review_status` |
| `documents` | `document_id`, `contract_id`, `url`, `document_type`, `version`, `publication_date`, `retrieved_at`, `content_hash`, `storage_policy` |
| `evidence` | `evidence_id`, `document_id`, `page_or_section`, `quote_or_reference`, `source_url`, `source_date`, `confidence` |
| `geospatial_features` | `feature_id`, `dataset_id`, `geometry`, `crs`, `valid_on`, `source_url`, `resolution` |
| `region_indicators` | `teryt`, `indicator_code`, `year`, `value`, `unit`, `source_id` |
| `companies_minimal` | `company_id`, `country`, `registry_type`, `registry_id`, `canonical_name`, `last_verified_at` |
| `company_contract_relations` | `company_id`, `contract_id`, `role`, `role_status`, `work_scope`, `evidence_id`, `expert_decision` |
| `company_lookup_log` | `company_id`, `registry`, `checked_at`, `result_status`, `licence_version`, `cache_until`, `source_url` |
| `expert_decisions` | `target_type`, `target_id`, `decision`, `reason`, `reviewer`, `reviewed_at`, `revision` |

### 6.2. Schemat działania on-demand

```text
Użytkownik wskazuje firmę LUB dokument zawiera nową nazwę firmy
     ↓
Identyfikator + jurysdykcja; deduplikacja i sprawdzenie krótkiego cache
     ↓
Wybór konkretnego adaptera rejestrowego (PL/FR/CZ/GB/VIES/GLEIF...)
     ↓
Pobranie danych TYLKO jednej firmy (lub wąskiego zestawu kandydatów)
     ↓
Weryfikacja tożsamości i statusu; źródło i data odczytu
     ↓
Na osobne żądanie: wyszukaj poprzednie kontrakty tej firmy w BZP/TED/BOAMP...
     ↓
Powiąż TYLKO kontrakty z potwierdzoną rolą i udokumentuj każde dopasowanie
     ↓
Wylicz statystyki i sygnały (R12, R06, R13) + pokaż liczebność próby
     ↓
Ekspert zatwierdza wnioski; zapisz minimalne fakty, powiązania i dowody
```

### 6.3. Pola metadanych wymagane w **każdym** ważnym rekordzie

`source_system`, `source_url`, `source_record_id`, `retrieved_at`, `source_published_at`, `valid_from`/`valid_to` (jeśli mają sens), `licence_or_terms`, `retrieval_method`, `field_provenance`, `match_method`, `match_confidence`, `evidence_id`, `expert_review_status`, `revision`. Dane z różnych źródeł mogą być sprzeczne albo nieaktualne; nie nadpisywać ich bez utraty historii.

Rozróżniać trzy rodzaje informacji:

- `SOURCE_FACT` — dosłowna informacja ze źródła;
- `CALCULATED` — rachunek z jawnie wskazanych danych wejściowych;
- `MODEL_INFERENCE` — hipoteza/wniosek wymagający oceny.

### 6.4. Kiedy zapisywać całość, a kiedy tylko wynik

- **Dane referencyjne i statystyczne, dopuszczone do ponownego wykorzystania:** znormalizowane rekordy lub legalnie dopuszczony wycinek/geometria.
- **Dokumenty kontraktu:** metadane i fragment dowodu; pełny plik tylko zgodnie z prawami do jego utrwalenia.
- **Zagraniczny rejestr przedsiębiorstw:** nie kopiować całego rekordu „na wszelki wypadek”; identyfikator, data i wynik weryfikacji + krótki cache pod warunkami źródła.
- **Wniosek o podwykonawcy:** w bazie trzymać *relację wraz z dowodem*, nie tylko nazwę z tekstu.
- **Dane osobowe:** minimalizacja, podstawa przetwarzania, retencja i zasady udostępniania.

---

## 7. Zgodność, licencje i bezpieczeństwo

**Przed automatyzacją wykonaj dla każdego źródła kontrolę:**

1. Czy źródło udostępnia **oficjalne API lub pliki do pobrania**? Jeśli tak, unikać robotów HTML.
2. Czy warunki zezwalają na **masowe pobieranie**, **cache**, **trwały zapis**, **łączenie**, **udostępnianie wyników**, **komercyjne użycie** i **wykorzystanie przez model AI**? To odrębne pytania.
3. Czy trzeba podać autora, instytucję, licencję, datę pobrania, informację o zmianach lub odnośnik do wersji źródła?
4. Czy zbiór zawiera dane osobowe (np. JDG, osoby reprezentujące podmioty), ograniczenia bezpieczeństwa infrastruktury krytycznej, informacje chronione lub prawnie niejawne?
5. Czy API ma limity, wymagany klucz, warunki logowania i mechanizm korekty/usuwania rekordów?
6. Czy wynik dotyczy określonej daty? **Bieżący status spółki nie dowodzi jej statusu w dniu wykonywania kontraktu.**

**Podstawowe źródła zasad prawnych:** [Gov.pl — ponowne wykorzystywanie ISP](https://www.gov.pl/web/gov/wykorzystaj-informacje-sektora-publicznego2), [GUS BDL — licencja i dokumentacja](https://api.stat.gov.pl/home/bdlapi), [GDOŚ — dostęp do danych GIS](https://www.gov.pl/web/gdos/dostep-do-danych-geoprzestrzennych), [BZP — dokumentacja integracji](https://ezamowienia.gov.pl/pl/integracja/). Nie wszystkie portale administracyjne udostępniają identyczną licencję; sprawdzać warunki **konkretnego zbioru**.

**Zakazy metodologiczne:**

- Nie twierdzić, że podwykonawca został potwierdzony, jeżeli dokument jedynie zapowiada jego udział.
- Nie oceniać negatywnie podmiotu tylko dlatego, że ma siedzibę za granicą, jest mały, ma mało publicznych kontraktów lub nie występuje w VIES/GLEIF.
- Nie utożsamiać zmiany umowy ani opóźnienia z winą wykonawcy.
- Nie przedstawiać wyliczonego prawdopodobieństwa jako statystycznie wiarygodnego bez wystarczającej liczby porównywalnych przypadków.
- Nie budować automatycznej „czarnej listy” firm na podstawie niezweryfikowanych przesłanek.
- Nie obchodzić zabezpieczeń, CAPTCHY, limitów dostępu ani zakazów automatycznego pobierania.

---

## 8. Priorytety realizacji MVP

| Sprint | Integracja | Minimalny wynik demonstracyjny | Priorytet |
|---|---|---|---|
| 1 | Import arkusza konkursowego + API BZP | połączony projekt → postępowanie → wynik → wykonanie, z URL i datą | **P0** |
| 2 | Parser dokumentów + ekstrakcja R01–R15 | zdarzenie i wskazany fragment źródła + decyzja eksperta | **P0** |
| 3 | GUS TERYT i BDL | normalizacja gminy i wskaźniki branżowe dla projektu | **P1** |
| 4 | KPOŚK/AKPOŚK | RLM, kontekst aglomeracji i oczyszczalni dla wybranych przypadków | **P1** |
| 5 | BDOT10k + Hydroportal + GDOŚ | 2–3 testy przestrzenne **po wprowadzeniu geometrii projektu** | **P1** |
| 6 | KRS + REGON + Companies House/FR/CZ | przycisk „Sprawdź konkretną firmę” → karta weryfikacyjna | **P1** |
| 7 | TED + BOAMP/Contracts Finder | przycisk „Znajdź wcześniejsze kontrakty firmy” → lista źródeł i próba dopasowania | **P2** |
| 8 | Odkrywanie podwykonawców | ekstrakcja z wybranego ogłoszenia/załącznika + eksperckie potwierdzenie | **P2** |
| 9 | Wzbogacenie GIOŚ/PIG/IMGW | dane środowiskowe i pogodowe z określonym kontekstem przestrzennym/czasowym | **P2** |

**Sugerowane demo:**

1. Wybierz jedną z inwestycji w dostarczonym `Risk_Miner_dane_projekty.xlsx` i automatycznie pobierz jej ogłoszenia BZP, zmianę i wykonanie (jeśli występują).
2. Pokaż udokumentowane zdarzenie, jego skutek i weryfikację eksperta.
3. Wprowadź przebieg planowanej sieci w GeoJSON (jeżeli dostępny) i zaznacz potencjalne kolizje z warstwami publicznymi.
4. Wybierz wykonawcę z ogłoszenia i naciśnij „Sprawdź firmę” (KRS/REGON); dla demonstracji podmiotu zagranicznego użyj kontrolowanego przykładu z legalnie udostępnionym identyfikatorem.
5. Naciśnij „Szukaj poprzednich realizacji” (BZP/TED/BOAMP/Contracts Finder), pokaż źródła i ograniczenia dopasowania.
6. Na koniec pokaż w panelu eksperta rozróżnienie `fakt / obliczenie / hipoteza`.

---

## 9. Mapa ryzyk R01–R15 do źródeł

| Kod MFiPR | Ryzyko | Dane szczególnie użyteczne |
|---|---|---|
| **R01** | Niepełny lub niespójny zakres | PFU, OPZ, SWZ, projekt, przedmiary, pytania i odpowiedzi |
| **R02** | Niedostateczne rozpoznanie stanu istniejącego | PIG/CBDG, PSH, GESUT, inspekcje i badania operatora |
| **R03** | Kolizje, dostęp do terenu, prawa do nieruchomości | BDOT10k, EGiB, GESUT, przebieg projektu, decyzje i uzgodnienia |
| **R04** | Decyzje, pozwolenia, uzgodnienia | Wody Polskie, GDOŚ, BIP, pozwolenia wodnoprawne |
| **R05** | Niejasny podział odpowiedzialności | PPU, SWU, umowy, zakres robót i potwierdzone relacje podwykonawców |
| **R06** | Nierealistyczny harmonogram i zależności | BZP zmiany/wykonanie, harmonogramy, IMGW, formalności |
| **R07** | Nieprzewidziane zmiany i roboty dodatkowe | zmiany umów, aneksy, protokoły konieczności |
| **R08** | Model wynagrodzenia nieadekwatny do niepewności | PPU, kosztorysy, warunki gruntowe, zmiany kosztów |
| **R09** | Niejednoznaczne wymagania techniczne | PFU, OPZ, STWiORB, dokumentacja urządzeń, pytania/odpowiedzi |
| **R10** | Niedookreślone próby, rozruch i odbiór | STWiORB, PPU, parametry ścieków/wody, protokoły prób |
| **R11** | Postępowanie podatne na odwołania | SWZ, pytania, ogłoszenia, KIO |
| **R12** | Niewystarczająca zdolność wykonawcy lub dostaw | poprzednie **udokumentowane** realizacje, harmonogramy, zgłoszone role firm, rejestry on-demand |
| **R13** | Finansowanie, budżet i płatności | BIP/WPF, dane projektów UE, BZP, wskaźniki cen GUS |
| **R14** | Nadmierne koszty utrzymania | taryfy, eksploatacja operatora, zużycie energii, technologia |
| **R15** | Nieosiągnięcie efektu technologicznego/użytkowego/środowiskowego | KPOŚK, GIOŚ, GIS, protokoły rozruchu, laboratoryjne wyniki operatora |

---

## Źródła wewnętrzne, na których oparto strukturę

- `MFiPR - Pełna treść zadania konkursowego.pdf` — wymagania integracji, skalowalność, dowody, poziomy projektu/umowy, ekspert w pętli.
- `Risk_Miner_material_porady_fazy_dokumenty_ryzyka_ciekawostki.docx` — fazy, typowe dokumenty, podsektory, R01–R15, interpretacja zmiany umowy i braków w dokumentach.
- `Risk_Miner_material_ekspercki_przygotowanie_inw_wodociagowej.docx` — odbiorcy, zasilenie, przebieg sieci, nieruchomości, ochrona środowiska i rozdział odpowiedzialności.
- `Risk_Miner_dane_projekty.xlsx` — punkt startowy importu projektów konkursowych.
- `Risk_Miner_2_0_Plan_Projektu.md` — zakres MVP i moduły Risk DNA / Project Twin / Chaos Lab.

**Status weryfikacji:** podane linki prowadzą do oficjalnych stron, portali lub dokumentacji zidentyfikowanych źródeł (poza komercyjnym OpenCorporates). Nie wykonano pełnych testów każdego endpointu, nie uzyskano kluczy API i nie przeprowadzono indywidualnego audytu licencji każdej kolekcji. Przed implementacją oznaczyć każdy adapter `READY`, `NEEDS_AUTH`, `NEEDS_TERMS_REVIEW`, `DOCUMENTS_ONLY` lub `UNSUPPORTED`.
