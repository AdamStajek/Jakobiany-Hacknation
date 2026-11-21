# Risk Miner 2.0 — 15 najważniejszych integracji danych i backlog pozostałych źródeł

**Data:** 21.11.2026  
**Podstawa:** `Risk_Miner_2_0_Plan_Projektu.md`, `Risk_Miner_katalog_danych_i_zrodel_bulk_on_demand.md`, `Risk_Miner_2_0_Rekomendowana_Polityka_Danych_i_Aktualizacji.md`, zadanie MFiPR.  
**Zasada liczenia:** jedna pozycja = jedna integracja / rodzina źródeł, a nie pojedynczy endpoint czy typ ogłoszenia. Cztery rodzaje danych BZP (Z01–Z04) liczone są jako jedna integracja. Import plików organizatora jest źródłem nr 1, choć nie jest API publicznym. W14 (cechy techniczne z dokumentacji), H01/H02 (historia kontraktów firm w BZP/TED) i słowniki CPV/NUTS (E07) wykorzystują już wybrane konektory i parsery, nie powielają ich jako nowe integracje.

## A. TOP 15 — implementować w tej kolejności

| # | Integracja/źródło | Kody katalogu | Główne dane i wartość | Model | Kontrola/aktualizacja | Faza |
|---:|---|---|---|---|---|---|
| 1 | Pakiet MFiPR + uploady użytkownika (XLSX/CSV/PDF/DOCX) | dane konkursowe, Z11/W14 (po stronie parsera) | Import 22 projektów, nowe dokumenty, cechy, wersje i dowody | PROJECT / CORE | Od razu po dodaniu pliku | MVP krytyczne |
| 2 | BZP / e-Zamówienia | Z01–Z04, H01 | Ogłoszenie, wynik, umowa, zmiany, wykonanie, kontrakty historyczne | INDEX + PROJECT | Aktywne co 1 h; indeks codziennie; delta | MVP krytyczne |
| 3 | Platformy zakupowe zamawiających | Z07, W14, H07 | SWZ, PFU, OPZ, STWiORB, PPU, Q&A i modyfikacje; podstawa R01–R15 | OD → PROJECT | Nowa wersja / aktywne co 6–24 h | MVP krytyczne |
| 4 | TED Search API | Z05, H02 | Ogłoszenia unijne, wyniki, kontrakty i firmy zagraniczne | INDEX + PROJECT / OD | Aktywne co 6 h; indeks codziennie | MVP: drugie źródło, jeśli pasuje do projektu |
| 5 | Listy projektów Funduszy Europejskich / KPO | Z10, E05 (część) | Identyfikatory CST/KPO, beneficjent, finansowanie, powiązania z zamówieniami | INDEX + PROJECT | Po publikacji; kontrola 7–30 dni | MVP krytyczne dla 7 rekordów KPO |
| 6 | BIP konkretnych inwestorów / gmin | Z08, E04 (część) | Budżety, WPF, uchwały, umowy, harmonogramy, komunikaty | OD → PROJECT | Aktywne co 24 h; inne na żądanie | MVP: alternatywa dla TED |
| 7 | KIO — orzeczenia | Z09 (część) | Odwołania, przyczyny sporów, rozstrzygnięcia, R11 | OD → PROJECT | Na żądanie; sporne co 7 dni | Po MVP — I fala |
| 8 | GUS TERYT | G01, E06 | Jednostki administracyjne, normalizacja gmin i lokalizacji | CORE | Kontrola miesięczna, import po nowej wersji | Po MVP — I fala |
| 9 | GUS BDL | W03, E01–E02 | Długości sieci, przyłącza, ludność, kontekst i miary porównawcze | CORE | Kontrola miesięczna; nowe wartości po publikacji | Po MVP — I fala |
| 10 | KPOŚK/AKPOŚK — Wody Polskie | W01–W02 | Aglomeracje, RLM, oczyszczalnie, sektorowy kontekst inwestycji | CORE (wersjonowane) | Kontrola kwartalna; aktualizacja po wydaniu | Po MVP — I fala |
| 11 | GUS — wskaźniki cen budownictwa | E03 | Normalizacja kosztów historycznych i porównania wieloletnie | CORE | Po publikacji, kontrola miesięczna | Po MVP — I fala |
| 12 | KRS | PL01 | Status i identyfikacja konkretnego wykonawcy | OD + krótki CACHE; trwała relacja/dowód | Przy sprawdzaniu firmy / wygaśnięciu cache | Po MVP — I fala |
| 13 | REGON (BIR) | PL03 | Potwierdzenie NIP/REGON, normalizacja tożsamości podmiotu | OD + krótki CACHE | Przy sprawdzaniu firmy / wygaśnięciu cache | Po MVP — I fala |
| 14 | Geoportal — BDOT10k | G03 | Drogi, cieki, obiekty i przeszkody dla trasy inwestycji | wycinki CORE / OD | Po zmianie warstwy lub geometrii; kontrola kwartalna | Po MVP — II fala, warunkowo |
| 15 | GDOŚ — obszary chronione | G08 | Natura 2000 i inne granice ochrony; rozpoznanie R04 | wycinki CORE / OD | Kontrola miesięczna; po zmianie warstwy | Po MVP — II fala, warunkowo |

**Warunek Geo Risk:** #14–15 wdrażać do analiz przecięć tylko przy potwierdzonej geometrii inwestycji. Bez niej odłożyć interfejs przestrzenny, nie przedstawiać hipotetycznych kolizji.

**Uwaga dotycząca priorytetu 24-godzinnego hackathonu:** TOP 15 to kolejka wdrożenia, a nie obietnica ukończenia 15 integracji w 24 godziny. Dla dwóch obowiązkowych ścieżek jurorskich najpierw #1–3, następnie jedno realne dodatkowe źródło z #4–6. Jednocześnie trzeba zbudować parser, zapis dowodów, panel eksperta, Project Twin, Risk DNA i Chaos Lab — to nie są osobne zewnętrzne źródła.

## B. Pozostałe źródła — wdrożyć później

### Druga fala po TOP 15: wzmacnianie ryzyk formalnych i terenowych

- **Z06** — Baza Konkurencyjności: zamówienia poza typowym BZP, po potwierdzeniu technicznej metody integracji.
- **Z09 (pozostała część)** — NIK i inne organy kontroli: historyczne ustalenia, przyczyny, środki zaradcze; wyszukiwanie dla zidentyfikowanych projektów.
- **W04, W11** — JCW/Hydroportal i pozwolenia wodnoprawne: R04, status i warunki zgód, gdy dostępne.
- **G02, G04, G05** — NMT, EGiB, GESUT: ukształtowanie terenu, działki, możliwe kolizje, po uzyskaniu geometrii i zweryfikowaniu warunków danych.
- **G06, G12** — mapy powodziowe i planowanie przestrzenne: kontekst lokalizacyjny i formalny dla konkretnej inwestycji.
- **PL02, PL04** — CEIDG i wykaz VAT: weryfikacja podmiotu on-demand, zgodnie z warunkami i RODO.
- **INT01, INT03–INT05, INT07** — VIES, Companies House, Francja, Czechy, GLEIF: zagraniczne firmy na żądanie, tylko gdy pojawi się konkretny wykonawca.

### Trzecia fala: rozszerzenie środowiskowe i sektorowe

- **W05–W10, W12–W13** — GIOŚ (wody powierzchniowe i podziemne, PRTR), PIG/PSH, pobór wody, jakość wody do spożycia, taryfy i planowane inwestycje. `W08` przez BDL można zrealizować bez nowego adaptera. `W14` realizuje parser z TOP 15.
- **G07, G09–G11, G13–G14** — susza i hydrologia, geologia, hydrogeologia, osuwiska, IMGW i monitoring środowiskowy. `G14` współdzieli integrację z `W05–W06`.
- **E04–E05 (rozszerzenia)** — pogłębione pozyskiwanie WPF, NFOŚiGW i lokalnych informacji finansowych, poza BIP/UE już objętymi TOP 15.
- **INT02, INT06, INT08–INT09** — BRIS, Niemcy, OpenCorporates i wyszukiwarki upadłości: adaptery warunkowe/manualne, bez niezweryfikowanych założeń o API.
- **PL05–PL06** — sprawozdania finansowe RDF/KRS i KRZ na żądanie.
- **H03–H06** — BOAMP, Contracts Finder, Find a Tender i krajowe portale zamówień poza TED; historii konkretnej firmy szukać on-demand.

### Nie wymaga osobnej integracji do implementacji

- **E07** — słowniki CPV/NUTS: włączyć do normalizacji BZP/TED już w etapie podstawowym.
- **H01/H02** — zapytania o poprzednie kontrakty firmy: funkcje istniejących adapterów BZP/TED, najpierw na żądanie.
- **H07/H08** — lokalne dokumenty i historia relacji z wewnętrznej bazy: korzystają z platform/BIP oraz `company_contract_relations`.
- **Z11 i dane W (prywatne)** — dokumenty udostępnione przez uprawnionego inwestora: wspólny mechanizm uploadu, bez masowego publicznego pobierania; odpowiednia kontrola uprawnień i retencji.

## C. Zasada aktualizacji ≤3 h

- Do codziennego rutynowego cyklu: **delta BZP/TED, monitorowane projekty i nowe metadane/dokumenty**; łącznie maksymalnie 180 min na zdefiniowany batch.
- Firmy (#12–13), analizy obszarowe (#14–15), KIO (#7) i większość BIP (#6) uruchamiać **na żądanie albo tylko dla monitorowanych projektów**.
- Dane TERYT, BDL, KPOŚK, ceny GUS: sprawdzać **wersję**, nie pobierać całego zasobu codziennie.
- Oddzielić pobranie, aktualizację indeksu i ciężką analizę LLM; nie blokować publikacji nowej spójnej wersji danych oczekiwaniem na weryfikację eksperta.
- Limit 3 h odnosi się do **jednego przyrostowego cyklu o zadanym zakresie**, a nie do całego pierwszego importu danych z Polski. Obecny status API/licencji i wydajność trzeba sprawdzić w testach.

## D. Kryterium sukcesu

Pierwszy etap jest gotowy, gdy system na prawdziwym rekordzie przejdzie: **import → BZP → dokument → zdarzenie R01–R15 z dowodem → decyzja eksperta → Risk DNA → bliźniak nowej inwestycji → Chaos Lab → eksport**, a przynajmniej jedno dodatkowe publiczne źródło przyniesie rzeczywisty rekord. Dopiero potem rozwijać integracje 7–15.
