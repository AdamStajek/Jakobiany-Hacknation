# WodoStrażnik · pitch zespołu Jakobiany

## Wystąpienie na 2–3 minuty

**Pole w Kościanie.** Wyobraźmy sobie rolniczkę, która chce sprawdzić, czy na plantacji ziemniaka powinien ją niepokoić ostatni miesiąc opadów. Wybieram w WodoStrażniku granicę działki w gminie Kościan i datę 5 lipca 2024. To istniejąca działka, której granicę pobieramy z GUGiK. Ziemniak jest wybranym scenariuszem uprawy. Aplikacja nie ustala, co rosło tu w 2024 roku.

**Wynik.** W danych pogodowych z 30 dni znalazło się około 56 mm opadu. Oszacowane zapotrzebowanie ziemniaka w tym okresie wyniosło około 135 mm. To sygnał, żeby zajrzeć do gleby w kilku punktach, zwłaszcza w czasie zawiązywania i wzrostu bulw. W raporcie widać też, że lipiec należy do miesięcy z najniższym typowym bilansem w tym miejscu.

**Decyzja.** WodoStrażnik podpowiada, żeby po zbiorze zostawić osłonę z resztek roślinnych i ustalić z doradcą, gdzie warto zatrzymywać odpływ. Każda karta mówi, co zrobić, kiedy i na jakim dowodzie oparto zalecenie. W tym przykładzie obraz pokrycia terenu wskazuje stałą wodę około 246 metrów od granicy. Można więc zacząć od obejrzenia otoczenia po deszczu. Takie wskazanie nie potwierdza prawa do poboru ani możliwości wykonania robót.

**Co liczymy.** Z opadu i danych o pogodzie liczymy ET₀ metodą FAO-56. Przemnażamy ją przez współczynnik zależny od fazy uprawy. SoilGrids dostarcza oszacowanie wody możliwej do zatrzymania w strefie korzeni. Obrazy Sentinel-2 przechodzą maskowanie chmur i są porównywane sezonowo. Gdy któryś odczyt jest niedostępny, raport pokazuje brak. Rolnik może też sprawdzić scenariusz dodatkowego opadu zatrzymanego w glebie, zachowując te same pozostałe założenia.

**Pokaż aplikację.** Rozwijam powód zalecenia, przechodzę do historii i pobieram PDF. Dla danych lokalnych najważniejsze są trzy decyzje. Gdzie sprawdzić pole, kiedy wrócić do pomiaru i co zaplanować na następny sezon. To właśnie rolnik dostaje po wskazaniu działki i uprawy.

## Pytania jury

- **Czy to działa poza pokazem?** Tak. Backend odpytuje ULDK i źródła po położeniu i dacie. W repozytorium są dowody uruchomienia w Wielkopolsce, Lubelskiem i na Warmii.
- **Czy możecie dobrać dawkę nawodnienia?** Bilans to przesiewowa ocena niedoboru. Szczegółowa dawka wymaga pomiaru wilgotności, aktualnego deszczu, sprawności instalacji i dostępności wody. Formularz pozwala uwzględnić znany dopływ netto.
- **Czy NDMI oznacza wilgotność gleby?** NDMI opisuje sygnał od powierzchni i łanu. Łączymy go z pogodą i fazą. Zbiór, płodozmian lub inny stres może zmienić indeks.
- **Co, jeśli jest zachmurzenie?** Obraz musi przejść maskę jakości. W razie braku dobrej sceny raport nadal korzysta z dostępnych kategorii i jawnie obniża ocenę pewności.
- **Czy potraficie analizować dzień sprzed 10 lat?** Tak, pogoda jest pobierana na tyle daleko wstecz, żeby zbudować ruchome tło. Pokrycie satelitarne i aktualne warstwy przestrzenne są opisane osobno.
- **Jak sprawdziliście metodę?** Test ET₀ odtwarza przykład 18 FAO-56 w tolerancji 0,15 mm/d, a test retencji odtwarza przykład 36 oraz sprawdza zachowanie masy wody. Chętnie porównamy wynik z danymi jury i sprawdzimy lokalne pomiary.
- **Co ogranicza skalę?** Limity źródeł i przepustowość odczytów rastrów. Prototyp buforuje agregaty, ogranicza współbieżność i przelicza zalecenia zależnie od parametrów.
- **Czy KOWR może dalej rozwijać aplikację?** Własne elementy i zewnętrzne komponenty są opisane oddzielnie. Publiczny prototyp domyślnie nie korzysta z ograniczonego do użytku niekomercyjnego API Open-Meteo.
