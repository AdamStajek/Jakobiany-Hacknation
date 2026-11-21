# Materiał Ekspercki

*materiał ekspercki dla zespołów HackNation | inwestycje wodno-kanalizacyjne*

W przypadku gdybyście nie mieli akurat w składzie Zespołu eksperta ds. Zamówień Publicznych w sektorze Wodno-Kanalizacyjnym, przygotowaliśmy dla Was zestaw pomocy eksperckich, które powinny uzupełnić Waszą wiedzę w tym zakresie.

## 1. Co jeszcze Wam dostarczamy

Zanim jednak zaczniemy o kanalizacji to jedna istotna kwestia techniczna (którą w drodze wyjątku rozwiązujemy już teraz, zamiast w panice podczas trwania wydarzenia). Czujemy, że będzie Wam potrzebny dostęp do ogłoszeń BZP podczas hackathonu, a te pobiera się przez API platformy e-Zamówienia. Od 6.10.2026 to API przyjmuje jedynie 30 zapytań na minutę z jednego adresu IP, a przy wspólnym IP i wielu zespołach, jest szansa, że okresowo będzie się blokować (nawet jak przejdziecie na własne hotspoty). Na czas HackNation działa kopia ogłoszeń o robotach wodno-kanalizacyjnych: https://bzp.cytr.us. Ma ten sam interfejs co API BZP i nie ma limitu zapytań; wystarczy zamienić adres ezamowienia.gov.pl na bzp.cytr.us. Jeśli macie takie życzenie, to całą kopię do uruchomienia u siebie można pobrać z adresu https://bzp.cytr.us/paczka/risk_miner_bzp_kopia.zip.

## 2. Fazy inwestycji i typowe dokumenty

Nie każda inwestycja obejmuje wszystkie fazy ani wszystkie wymienione dokumenty. Ten sam dokument może być przygotowany w jednej fazie, a opublikowany lub zmieniony w kolejnej. Lista pokazuje typowy przebieg, nie obowiązkowy komplet. Wyjaśnienie trudnych słów i dziwnych skrótów znajdziecie w kolejnej sekcji.

| Faza i zakres | Typowe dokumenty powstające lub aktualizowane |
| --- | --- |
| Planowanie<br>Określenie potrzeby, wariantów, zakresu, budżetu i sposobu finansowania. | analiza potrzeb; program inwestycji; studium wykonalności; analiza wariantów; wstępny harmonogram i koszt; uchwała budżetowa; WPF – Wieloletnia Prognoza Finansowa; wniosek lub umowa o dofinansowanie |
| Przygotowanie<br>Rozpoznanie terenu, danych wejściowych, rozwiązań technicznych, decyzji i praw do terenu. | mapy i inwentaryzacje; dokumentacja geotechniczna lub geologiczna; decyzja środowiskowa; warunki techniczne i uzgodnienia; dokumentacja projektowa; PFU lub OPZ; STWiORB; przedmiar; kosztorys; pozwolenie na budowę albo zgłoszenie robót |
| Postępowanie zakupowe<br>Opis zamówienia, publikacja, pytania, ocena ofert i wybór wykonawcy. | ogłoszenie o zamówieniu; SWZ; PFU/OPZ i dokumentacja techniczna jako załączniki; PPU/SWU; pytania i odpowiedzi; modyfikacje; informacja o kwocie; informacja z otwarcia ofert; wybór oferty; ogłoszenie o wyniku; orzeczenie KIO, jeżeli wniesiono odwołanie |
| Zawarcie i uruchomienie umowy<br>Ustalenie wiążących warunków realizacji i rozpoczęcie obowiązków stron. | podpisana umowa z załącznikami to rzadkość w otwartych źródłach, ale wystarczy np. uzupełnić PPU o informację z rozstrzygnięcia przetargu i już mamy gotowy rdzeń; zabezpieczenie należytego wykonania; polisy i gwarancje; harmonogram bazowy; plan płatności; protokół przekazania terenu lub placu budowy |
| Projektowanie po zawarciu umowy<br>Faza typowa dla formuły „projektuj i buduj”. | koncepcje i projekty wykonawcy; uzgodnienia międzybranżowe; warunki gestorów; wnioski o decyzje i pozwolenia; decyzje administracyjne; aktualizacje harmonogramu i dokumentacji technicznej |
| Realizacja<br>Roboty, dostawy, nadzór, rozliczenia częściowe, zmiany i obsługa problemów. | dziennik budowy; protokoły narad; raporty wykonawcy i nadzoru; harmonogramy aktualizowane; protokoły odbiorów częściowych; faktury; wnioski o zmianę; protokoły konieczności; roszczenia; aneksy; ogłoszenia o zmianie umowy |
| Próby, rozruch i odbiór<br>Sprawdzenie jakości, parametrów, kompletności i możliwości użytkowania. | protokoły badań i prób; raport z rozruchu; protokoły odbioru; wykaz wad i usterek; dokumentacja powykonawcza; instrukcje eksploatacji; zawiadomienie o zakończeniu robót lub pozwolenie na użytkowanie |
| Zamknięcie i gwarancja<br>Rozliczenie końcowe, przekazanie do eksploatacji i obsługa zobowiązań gwarancyjnych. | protokół odbioru końcowego; rozliczenie i faktura końcowa; ogłoszenie o wykonaniu umowy; dokumenty gwarancyjne i serwisowe; protokoły usunięcia wad; raporty końcowe i potwierdzenie osiągnięcia efektu projektu |

### 2.1. Podsektory inwestycji wod-kan

Sektor wodno-kanalizacyjny nie jest oczywiście jednorodny. Aby zachować spójność i porównywalność rozwiązań narzucamy klasyfikację i nazewnictwo podsektorów. Każdą inwestycję przypisuje się do podsektora głównego, odpowiadającego dominującemu zakresowi przedsięwzięcia (mogą też występować zakresy równorzędne). Projekty obejmujące kilka rodzajów infrastruktury mogą otrzymać również jeden lub więcej podsektorów dodatkowych. Rodzaj prac – budowa/rozbudowa lub przebudowa/renowacja - zapisuje się jako osobną cechę inwestycji.

| Podsektor | Zakres |
| --- | --- |
| Sieć wodociągowa | sieci, przyłącza oraz obiekty służące do przesyłu i dystrybucji wody |
| Kanalizacja sanitarna | sieci, przyłącza, przepompownie i przewody tłoczne służące do odprowadzania ścieków |
| Oczyszczalnia ścieków | budowa, rozbudowa lub modernizacja obiektów i instalacji oczyszczania ścieków |
| Uzdatnianie i zaopatrzenie w wodę | stacje uzdatniania wody, ujęcia, studnie, zbiorniki oraz obiekty magazynowania i pompowania wody |
| Kanalizacja deszczowa i retencja | sieci deszczowe, odwodnienie, zbiorniki retencyjne i urządzenia gospodarowania wodami opadowymi |
| Inne obiekty wod-kan | infrastruktura wodno-kanalizacyjna, której nie można przypisać do pozostałych podsektorów |

Przykład: budowa kanalizacji sanitarnej z wymianą krótkiego odcinka wodociągu: podsektor główny „Kanalizacja sanitarna”, podsektor dodatkowy „Sieć wodociągowa”.

## 3. Dokumenty możliwe do wykorzystania w pakiecie

Lista obejmuje dokumenty, które mogą wystąpić w inwestycji i które da się realnie zidentyfikować lub pozyskać z publicznych źródeł. Nie jest to lista dokumentów obowiązkowych dla każdej inwestycji.

> Nie wszystkie dokumenty powstają w każdym postępowaniu, nie wszystkie są publikowane, a część może być dostępna dopiero po wystąpieniu o informację publiczną. Składanie takich wniosków nie jest częścią wyzwania. Mechanizm ma rozpoznać brak w przekazanej paczce, wyjaśnić jego znaczenie i wskazać, jaki dokument lub zakres danych należy uzupełnić. Braku pliku nie wolno utożsamiać z nieistnieniem dokumentu w inwestycji.

> Tutaj od razu musimy się przyznać, że posiadamy własne bazy (np. bazę CST2021 - wszystkich projektów finansowanych ze źródeł funduszy europejskich) i spore ilości dokumentów. Po rozwiązaniu kwestii własności, poufności czy anonimizacji, będziemy docelowo uzupełniać i wzbogacać Risk Minera o wszystkie brakujące elementy. Kto wie, może we współpracy właśnie z Wami?

### 3.1. Gdzie dokumenty mogą być publikowane

| Źródło | Znaczenie dla pakietu |
| --- | --- |
| e-Zamówienia / BZP | Platforma e-Zamówienia i BZP – Biuletyn Zamówień Publicznych. Źródło ogłoszeń, dokumentów postępowania, wyniku, zmian i wykonania umowy dla zamówień objętych publikacją krajową. |
| Platforma zakupowa zamawiającego | Miejsce prowadzenia konkretnego postępowania. Zwykle zawiera SWZ, załączniki techniczne, pytania i odpowiedzi, modyfikacje oraz informacje o ofertach i wyborze. |
| BIP | BIP – Biuletyn Informacji Publicznej. Może zawierać umowy, rejestry umów, uchwały budżetowe, WPF, zarządzenia, sprawozdania, komunikaty i dokumenty dotyczące inwestycji. |
| TED | TED – Tenders Electronic Daily, elektroniczny dodatek do Dziennika Urzędowego Unii Europejskiej. Źródło ogłoszeń dla postępowań publikowanych na poziomie unijnym. |
| KIO | KIO – Krajowa Izba Odwoławcza. Źródło orzeczeń dotyczących odwołań w postępowaniach o udzielenie zamówienia. |
| NIK i inne organy kontroli | NIK – Najwyższa Izba Kontroli. Informacje o wynikach kontroli mogą opisywać nieprawidłowości, skutki i zalecenia. Podobne materiały mogą publikować inne organy kontrolne. |

### 3.2. Przygotowanie i postępowanie zakupowe

| Dokument | Czym jest i co zawiera |
| --- | --- |
| Ogłoszenie o zamówieniu | Publiczna informacja rozpoczynająca postępowanie. Zawiera zamawiającego, przedmiot, tryb, terminy, warunki udziału, kryteria oceny oraz kody CPV – Common Procurement Vocabulary, czyli Wspólnego Słownika Zamówień. |
| SWZ – Specyfikacja Warunków Zamówienia | Podstawowy dokument określający zasady udziału w postępowaniu, wymagania wobec wykonawców, sposób przygotowania oferty, terminy, kryteria oraz listę załączników. |
| PFU – Program Funkcjonalno-Użytkowy | Dokument typowy dla formuły „projektuj i buduj”. Określa funkcje, zakres, parametry, oczekiwany efekt i wymagania zamawiającego, pozostawiając wykonawcy zaprojektowanie rozwiązania. |
| OPZ – Opis Przedmiotu Zamówienia | Opis robót, dostaw lub usług i wymagań zamawiającego. Może być samodzielnym dokumentem albo częścią SWZ. |
| Dokumentacja projektowa | Projekty, rysunki, trasy, schematy, zestawienia, obliczenia i rozwiązania techniczne. Może występować w wielu plikach i wersjach. |
| STWiORB – Specyfikacje Techniczne Wykonania i Odbioru Robót Budowlanych | Wymagania dotyczące materiałów, sposobu wykonania, badań, kontroli jakości oraz odbioru poszczególnych robót. |
| Przedmiar robót / kosztorys ofertowy | Pozycje i ilości robót przyjęte do wyceny. Przy wynagrodzeniu ryczałtowym mogą mieć charakter pomocniczy, dlatego należy sprawdzać ich relację do OPZ, projektu i umowy. |
| Decyzje, pozwolenia, warunki i uzgodnienia | Dokumenty określające możliwość i warunki realizacji, np. decyzja środowiskowa, pozwolenie na budowę, warunki techniczne, uzgodnienia z gestorami sieci lub właścicielami terenu. Nie zawsze są załączane do postępowania. |
| Pytania wykonawców i odpowiedzi zamawiającego | Pokazują miejsca niejasne, sporne lub trudne do wyceny. Odpowiedzi mogą doprecyzować albo zmienić SWZ, PFU, OPZ, projekt, STWiORB lub PPU. |
| Modyfikacje SWZ i załączników | Formalne zmiany wymagań, zakresu, terminów, kryteriów, dokumentacji technicznej lub warunków przyszłej umowy. Analiza musi uwzględniać wersję obowiązującą po zmianach. |
| Informacja o kwocie przeznaczonej na sfinansowanie zamówienia | Kwota ujawniona przez zamawiającego przed otwarciem ofert. Pozwala porównać założony budżet z cenami ofert. |
| Informacja z otwarcia ofert | Zestawienie wykonawców, cen ofert oraz – zależnie od postępowania – innych zadeklarowanych parametrów. |
| Informacja o wyborze najkorzystniejszej oferty | Wskazuje wybranego wykonawcę, cenę, punktację oraz wynik oceny ofert. |
| Ogłoszenie o wyniku postępowania | Potwierdza udzielenie zamówienia, wykonawcę, wartość i podstawowe dane kontraktu albo informuje o zakończeniu postępowania bez udzielenia zamówienia. |

### 3.3. Umowa, zmiany i zakończenie

| Dokument | Czym jest i co zawiera |
| --- | --- |
| PPU – Projektowane Postanowienia Umowy | Projekt treści przyszłej umowy. Zawiera obowiązki stron, terminy, wynagrodzenie, kary, zasady zmian, odbiorów, gwarancji i odpowiedzialności. |
| SWU – Szczególne Warunki Umowy | Warunki kontraktowe uzupełniające ogólne warunki i dokumentację techniczną. Mogą określać hierarchię dokumentów, procedury zmian, sposób rozliczeń i podział odpowiedzialności. |
| Podpisana umowa | Finalny kontrakt z oznaczeniem stron, ceną, terminem, załącznikami i podpisami. Jest podstawowym źródłem wiążących warunków realizacji, lecz nie zawsze znajduje się w publicznie dostępnej paczce. |
| Aneks do umowy | Dokument zmieniający konkretne postanowienia umowy, np. termin, wartość, zakres lub zasady realizacji. Uzasadnienie faktyczne może być skrótowe albo znajdować się w innym dokumencie. |
| Ogłoszenie o zmianie umowy | Publiczna informacja o zmianie zakresu, wartości, terminu lub innych warunków oraz o podstawie prawnej zmiany. Może potwierdzić zmianę, ale nie zawsze wyjaśnia jej pełną przyczynę. |
| Ogłoszenie o wykonaniu umowy | Informacja o wykonaniu lub zakończeniu kontraktu, dacie, wartości końcowej i zmianach. Zakres informacji zależy od formularza i sposobu jego wypełnienia. |
| Dokumenty realizacyjne i odbiorowe | M.in. harmonogramy, protokoły narad, protokoły konieczności, raporty nadzoru, protokoły prób i odbiorów, dokumentacja powykonawcza oraz rozliczenie końcowe. Są szczególnie wartościowe, ale rzadko występują w komplecie w publicznej dokumentacji. |

> PPU lub SWU jako warunkowy substytut podpisanej umowy: jeżeli nie można załączyć finalnej umowy z podpisami, PPU albo SWU może być użyte jako zastępcze źródło warunków kontraktowych, pod warunkiem że z innych dokumentów znane są co najmniej wykonawca, cena, termin i identyfikator postępowania oraz uwzględniono modyfikacje. Materiał należy oznaczyć: „warunki kontraktowe odtworzone; brak podpisanego egzemplarza umowy”.

### 3.4. Materiały zewnętrzne i uzupełniające

| Materiał | Czym jest i co może potwierdzać |
| --- | --- |
| Orzeczenie KIO – Krajowej Izby Odwoławczej | Opis zarzutów dotyczących postępowania, stanowisk stron, ustaleń Izby i rozstrzygnięcia. Dotyczy przede wszystkim ryzyk powstałych przed zawarciem umowy. |
| Informacja o wynikach kontroli NIK – Najwyższej Izby Kontroli lub innego organu | Ustalenia kontrolne, stwierdzone nieprawidłowości, ich skutki i zalecenia. Może dostarczyć wiedzy o realizacji, której nie ma w dokumentach postępowania. |
| Uchwały, WPF, rejestry umów, sprawozdania i komunikaty w BIP | Materiały publikowane w Biuletynie Informacji Publicznej mogą potwierdzać finansowanie, wartość, zmianę terminu, zawarcie umowy, zwiększenie środków, zakończenie albo problemy realizacyjne. |
| Komunikaty inwestora, operatora lub instytucji finansującej | Aktualności, raporty i listy projektów mogą potwierdzać etap realizacji, zakres, dofinansowanie i osiągnięcie efektu. Są źródłem pomocniczym i wymagają powiązania z dokumentami podstawowymi. |

## 4. Jak opisane są Zmiany widoczne w publicznych danych o postępowaniu i realizacji umowy

Zmiany w umowach są dla nas niezwykle istotne, bo to wyraźny sygnał, że w Postępowaniu mogło dojść do realizacji zdarzenia Ryzyka.

### 4.1. Zmiany i wydarzenia

Krótka ściągawka przykładowych sygnałów, których szukamy i gdzie je znajdziemy w dokumentach, przy czym lista nie wyczerpuje możliwych zdarzeń i możliwych źródeł każdego z nich.

| Zdarzenie | Źródło w danych publicznych |
| --- | --- |
| Zmiana terminu wykonania | ogłoszenie o zmianie umowy, ogłoszenie o wykonaniu umowy, aneks |
| Zmiana wynagrodzenia | ogłoszenie o zmianie umowy, ogłoszenie o wykonaniu umowy, aneks |
| Zmiana zakresu, roboty dodatkowe lub zamienne | opis zmiany w ogłoszeniu o zmianie lub wykonaniu umowy, aneks |
| Wykonanie po pierwotnym terminie | ogłoszenie o wykonaniu umowy |
| Wypłata wyższa niż pierwotna wartość umowy | ogłoszenie o wykonaniu umowy |
| Nienależyte wykonanie albo kara umowna | ogłoszenie o wykonaniu umowy, wyniki kontroli, orzeczenia |
| Niewykonanie, rozwiązanie albo odstąpienie od umowy | ogłoszenie o wykonaniu umowy, dokument zakończenia umowy |
| Unieważnienie postępowania | ogłoszenie o wyniku postępowania |
| Odwołanie do KIO | orzeczenia i postanowienia KIO |
| Zmiana wykonawcy | ogłoszenie o wykonaniu umowy, aneks, informacja zamawiającego |
| Nieprawidłowość stwierdzona w kontroli | wystąpienia pokontrolne NIK i innych organów |

### 4.2. Zmiany umów i ich oznaczanie

Zmiana umowy to formalna modyfikacja warunków podpisanego kontraktu. Może obejmować termin, wynagrodzenie, zakres, sposób realizacji lub wykonawcę. W ogłoszeniu wskazywane są opis i przyczyna zmiany, data, wartość oraz podstawa prawna. Podstawa prawna pokazuje, dlaczego zmiana mogła zostać dokonana bez nowego postępowania.

| Podstawa | Znaczenie |
| --- | --- |
| art. 455 ust. 1 pkt 1 | zmiana przewidziana w dokumentach zamówienia |
| art. 455 ust. 1 pkt 2 | dopuszczalna zmiana wykonawcy |
| art. 455 ust. 1 pkt 3 | konieczne dodatkowe roboty, dostawy lub usługi realizowane przez dotychczasowego wykonawcę |
| art. 455 ust. 1 pkt 4 | okoliczności, których zamawiający przy zachowaniu należytej staranności nie mógł przewidzieć |
| art. 455 ust. 2 | zmiana o niewielkiej wartości, mieszcząca się w ustawowych limitach |

Nie wszystkie Zmiany umowy wymagają osobnych Ogłoszeń. Osobne ogłoszenie o zmianie umowy publikuje się po zmianach dokonanych na podstawie art. 455 ust. 1 pkt 3 (dodatkowe roboty, dostawy lub usługi ) lub 4 (okoliczności, których nie można było wcześniej przewidzieć ) Pzp. Ogłoszenie trafia do BZP albo do publikacji unijnej, zależnie od trybu publikacji zamówienia.

Po wykonaniu umowy zamawiający publikuje w BZP ogłoszenie o wykonaniu umowy w terminie 30 dni. Zawiera ono zbiorcze informacje o zmianach, terminie realizacji, łącznej kwocie wypłaconej wykonawcy i należytym wykonaniu umowy.

## 5. Typy ryzyka możliwe do rozpoznawania

> Ryzyko to zdarzenie lub warunek, które może wpłynąć na koszt, termin, zakres, jakość, odbiór albo eksploatację. Efekt który najczęściej widzimy po zakończeniu inwestycji, najczęściej ma źródło już na etapie planowania inwestycji – w SWZ, PFU, STWiORB i PPU.

Czyli to czego szukamy i co chcemy zbadać zmierzyć, opisać i wyciągnąć wnioski. Przedstawiamy ekspercki ogólny katalog ryzyk dla inwestycji publicznych i ich przewidywanego efektu. Nie jest to w żadnej mierze katalog zamknięty. Każde wskazanie powinno mieć postać: warunek lub sygnał w dokumentach → możliwe zdarzenie → możliwy wpływ → możliwe środki zaradcze.

| Ryzyko | Efekty |
| --- | --- |
| R01 Niepełny lub niespójny zakres | Błędna wycena, pominięcie lub dublowanie robót, zmiana zakresu, roboty dodatkowe, roszczenie albo spór o wynagrodzenie. |
| R02 Niedostateczne rozpoznanie stanu istniejącego | Przeprojektowanie, nieprzewidziane roboty, przestoje, wzrost kosztu albo wydłużenie terminu. |
| R03 Kolizje, dostęp do terenu i prawa do nieruchomości | Brak możliwości rozpoczęcia części robót, zmiana trasy lub technologii, wstrzymanie prac albo roszczenia. |
| R04 Decyzje, pozwolenia i uzgodnienia zależne od podmiotów trzecich | Opóźnienie rozpoczęcia lub kontynuacji prac, zmiana warunków realizacji albo brak możliwości użytkowania obiektu. |
| R05 Niejasny lub nieadekwatny podział odpowiedzialności | Luka odpowiedzialności, dublowanie prac, odmowa wykonania, roszczenie i spór o koszt lub termin. |
| R06 Nierealistyczny harmonogram i nieuwzględnione zależności | Opóźnienie, kary, kumulacja prac, presja na skrócenie prób i badań albo pogorszenie jakości. |
| R07 Nieprzewidziane zmiany i roboty dodatkowe | Wstrzymanie robót, negocjacje, aneks, roszczenie, przekroczenie budżetu albo spór o odpowiedzialność. |
| R08 Model wynagrodzenia niedopasowany do niepewności zakresu | Zawyżona rezerwa w cenie albo niedoszacowanie, problemy płynnościowe i spory o zakres objęty wynagrodzeniem. |
| R09 Niejednoznaczne lub niemierzalne wymagania techniczne | Niewłaściwy dobór rozwiązania, przeprojektowanie, trudność w potwierdzeniu zgodności, problem z odbiorem. |
| R10 Niedookreślone próby, rozruch i odbiór | Wykonane roboty nie mogą zostać odebrane; opóźnia się użytkowanie i rozliczenie; powstaje spór o osiągnięcie parametrów. |
| R11 Postępowanie podatne na odwołanie lub ograniczenie konkurencji | Przedłużenie albo unieważnienie postępowania, słabsza konkurencja, wyższa cena lub wybór rozwiązania nieadekwatnego do potrzeb. |
| R12 Niewystarczająca zdolność wykonawcy lub łańcucha dostaw | Opóźnienie, zamiana materiałów lub urządzeń, problemy jakościowe i finansowe albo przerwanie realizacji. |
| R13 Ryzyko finansowania, budżetu i płatności | Ograniczenie zakresu, opóźnione płatności, utrata dofinansowania, brak środków na niezbędne zmiany albo problemy płynnościowe. |
| R14 Nadmierne koszty eksploatacji i utrzymania | Obiekt spełnia wymagania inwestycyjne, ale jest drogi, trudny lub niestabilny w eksploatacji. |
| R15 Nieosiągnięcie efektu technologicznego, użytkowego lub środowiskowego | Brak wymaganej jakości lub wydajności, ograniczenie użytkowania, konieczność dodatkowych prac, ryzyko sankcji albo utraty efektu projektu. |

## 6. „Porady”

Sekcja Porad, czyli tak naprawdę wszystkie ważne rzeczy, które nie zmieściły się gdzie indziej. Porady opisują mechaniki pracy z dokumentami i dają minimalną wiedzę potrzebną do poprawnej interpretacji.

| Mechanika | Porada |
| --- | --- |
| Identyfikacja dokumentu | Rozpoznanie typu dokumentu, źródła, daty, wersji, identyfikatora postępowania i fazy inwestycji. |
| Chronologia i wersje | Ustalenie, które dokumenty i modyfikacje są wcześniejsze, późniejsze oraz które postanowienia zostały zastąpione. |
| Hierarchia dokumentów | Sprawdzenie, czy umowa lub SWZ określa pierwszeństwo dokumentów w razie sprzeczności. |
| Normalizacja faktów | Sprowadzenie terminów, kwot, zakresu, parametrów i odpowiedzialności do wspólnego schematu umożliwiającego porównanie. |
| Rozpoznawanie sprzeczności | Porównanie tego samego faktu w różnych dokumentach i odróżnienie rzeczywistej sprzeczności od prawidłowej późniejszej zmiany. |
| Brak dokumentu a brak działania | Rozróżnienie: „nie ma w paczce”, „dokument nie wspomina”, „brak potwierdzenia” i „potwierdzono, że nie wykonano”. Te stany nie są równoważne. |
| Dowód źródłowy | Każda obserwacja i każde ryzyko powinny wskazywać dokument oraz lokalizację zapisu; wniosek bez dowodu powinien mieć obniżoną pewność. |
| Formułowanie ryzyka | Warunek lub sygnał → możliwe zdarzenie → możliwy wpływ. |
| Pewność i niepewność | Oddzielna ocena jakości danych, kompletności materiału i siły związku między sygnałem a przewidywanym zdarzeniem. |
| Potrzeba uzupełnienia | Wskazanie konkretnego dokumentu lub informacji, która jest potrzebna, oraz tego, jak jej brak ogranicza analizę. |
| Aktualizacja analizy | Po dodaniu nowego dokumentu mechanizm powinien wskazać, które fakty, sprzeczności i ryzyka zostały potwierdzone, zmienione albo zamknięte. |
| Projekt, postępowanie, część, umowa | Projekt może obejmować kilka postępowań, postępowanie kilka części, a każda część kończy się osobną umową. Wartość projektu nie jest wartością umowy z wykonawcą. |
| Unieważnienia i powtórzone postępowania | Unieważnione postępowanie i jego powtórzenie dotyczące tej samej inwestycji też często są sygnałem ryzyka. Przyczynę może podawać ogłoszenie o wyniku. |
| Kwoty netto i brutto | Wartość zamówienia jest szacunkiem bez VAT. Kwota przeznaczona na sfinansowanie, ceny ofert i wartość umowy są kwotami z VAT. Porównuj tylko kwoty tego samego rodzaju. |

> Prototyp ma być zaawansowanym narzędziem do obsługi przez Ekspertów. To oni mają finalnie oceniać i zatwierdzać wnioski. Narzędzie ma wykorzystywać dostępne materiały, wskazywać podstawę każdego wniosku oraz w razie potrzeby jasno komunikować, których dokumentów lub danych brakuje do silniejszej oceny.
