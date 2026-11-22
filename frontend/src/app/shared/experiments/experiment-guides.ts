export type ExperimentGuide = {
  slug: string;
  title: string;
  purpose: string;
  illustration?: { src: string; alt: string };
  icon: string;
  time: string;
  cost: string;
  equipment: string[];
  conditions: string;
  steps: { title: string; instruction: string }[];
  reference?: { title: string; rows: { label: string; detail: string }[] };
  record: string;
  example: string;
  meaning: string;
  sources: { label: string; url: string }[];
};

export const experimentGuides: ExperimentGuide[] = [
  {
    slug: 'wsiakanie-wody',
    title: 'Wsiąkanie wody',
    illustration: {
      src: 'assets/experiments/eks-wsiakanie-wody.png',
      alt: 'Pomiar wsiąkania dwóch porcji wody w pierścieniu wbitym w glebę.',
    },
    purpose: 'Pozwala porównać, jak szybko woda wsiąka w różnych miejscach pola. Wolniejsze wsiąkanie może wskazywać na utrudniony przepływ wody przez glebę, ale samo nie dowodzi jej zagęszczenia.',
    icon: 'pi-stopwatch',
    time: '20–120 minut na miejsce; przy kilku miejscach dłużej',
    cost: '20–80 zł',
    equipment: [
      'Metalowy pierścień bez dna i linijka',
      'Klocek drewniany i gumowy młotek',
      'Folia, naczynie z podziałką w ml i deszczówka lub woda destylowana',
      'Stoper lub telefon oraz notes',
    ],
    conditions: 'Badaj rozmarzniętą glebę bez kałuż i głębokich szczelin. Zapisz, czy jest sucha, czy wilgotna, oraz kiedy ostatnio padało. Jeżeli gleba jest silnie przesuszona i popękana, pomiar może być trudny do porównania z innymi: zapisz to lub powtórz badanie po opadzie. Nie zwilżaj przed próbą tylko jednego z porównywanych miejsc.',
    steps: [
      { title: 'Wybierz miejsca do porównania', instruction: 'Wybierz trzy punkty o podobnej glebie i warunkach, najlepiej w typowej części pola. Omiń nory i świeżo rozkopaną ziemię. Jeśli chcesz zbadać koleinę, wybierz parę punktów: w koleinie i tuż obok, poza koleiną. Zapisz położenie, stan gleby i to, co pokrywa jej powierzchnię.' },
      { title: 'Wbij pierścień', instruction: 'Zmierz jego średnicę wewnętrzną przez środek, od krawędzi do krawędzi. Połóż klocek na górnej krawędzi i wbij pierścień pionowo na około 7,5 cm. Nie ugniataj ziemi w środku. Delikatnie dociśnij tylko ziemię przy wewnętrznym brzegu pierścienia, aby woda nie wypływała szczeliną wzdłuż ścianki.' },
      { title: 'Wlej pierwszą porcję i zmierz czas', instruction: 'Dobierz ilość wody z tabeli. Wyłóż wnętrze pierścienia folią i wlej wodę na folię, aby nie rozmyć powierzchni gleby. Ostrożnie wyciągnij folię i w tym momencie uruchom stoper. Zatrzymaj go, gdy na powierzchni nie ma już stojącej warstwy wody. Zapisz czas pierwszej porcji.' },
      { title: 'Powtórz pomiar w tym samym pierścieniu', instruction: 'Gdy pierwsza porcja całkowicie wsiąknie, wlej taką samą drugą porcję, ponownie używając folii. Zmierz jej czas osobno. Pierwsza porcja zmienia wilgotność gleby, dlatego przy porównywaniu miejsc zestawiaj drugie pomiary z drugimi. W każdym kolejnym punkcie wykonaj obie porcje w ten sam sposób.' },
      { title: 'Zapisz wynik także wtedy, gdy pomiar się nie uda', instruction: 'Przed rozpoczęciem ustal maksymalny czas oczekiwania na każdą porcję, np. 60 minut. Jeśli po tym czasie nadal stoi woda, zapisz „nie wsiąkła w 60 minut”, zamiast wpisywać wymyślony czas. Jeśli woda wypłynęła bokiem, pierścień się poruszył lub przerwano próbę, zapisz przyczynę i wykonaj nowy pomiar w innym punkcie.' },
    ],
    reference: {
      title: 'Ile wody wlać przy każdej porcji?',
      rows: [
        { label: 'Średnica wewnętrzna 10 cm', detail: 'Około 200 ml wody.' },
        { label: 'Średnica wewnętrzna 15 cm', detail: 'Około 450 ml. Dla wzorcowego pierścienia USDA użyj 444 ml.' },
        { label: 'Średnica wewnętrzna 20 cm', detail: 'Około 800 ml wody.' },
        { label: 'Inna średnica', detail: 'Średnica wewnętrzna (cm) × średnica wewnętrzna (cm) × 2 = objętość wlewanej wody (ml).' },
        { label: 'Dlaczego dwie porcje?', detail: 'Pierwsza zwilża glebę w miejscu pomiaru. Druga pozwala porównać miejsca po podobnym sposobie wstępnego zwilżenia, choć ich wilgotność nadal może się różnić.' },
      ],
    },
    record: 'Zapisz datę, godzinę, lokalizację każdego punktu, ostatni opad, rodzaj i początkową wilgotność gleby, jej pokrycie, średnicę i głębokość wbicia pierścienia, objętość każdej porcji oraz dwa osobne czasy. Zaznacz, czy cała woda wsiąkła i czy wystąpiły zakłócenia.',
    example: 'Dzień po deszczu, podobna gleba w obu punktach. Pierścień 15 cm, wbity na 7,5 cm; dwie porcje po 450 ml. Koleina: pierwsza porcja 25 min, druga 34 min. Obok koleiny: pierwsza 12 min, druga 16 min. Druga porcja wsiąkała wolniej w koleinie.',
    meaning: 'Dłuższy czas drugiej porcji oznacza, że w badanym punkcie woda wolniej znikała z powierzchni. Jeśli tak dzieje się w koleinie, możliwą przyczyną jest zagęszczenie, ale wpływ mają również rodzaj gleby, jej wilgotność i stan powierzchni. Aby sprawdzić przyczynę, porównaj strukturę gleby w obu miejscach. To nie jest bezpośredni pomiar ilości wody dostępnej dla korzeni.',
    sources: [{ label: 'USDA-NRCS · instrukcja z rysunkami (PDF)', url: 'https://www.nrcs.usda.gov/sites/default/files/2022-10/Soil%20Infiltration.pdf' }],
  },
  {
    slug: 'wilgotnosc-gleby',
    title: 'Wilgotność gleby w dłoni',
    illustration: {
      src: 'assets/experiments/eks-wilgotnosc-gleby.png',
      alt: 'Pobieranie gleby z trzech głębokości i ocena wilgotności przez ściśnięcie próbki w dłoni.',
    },
    purpose: 'Pozwala orientacyjnie ustalić, które warstwy gleby są bardziej suche, a które wilgotniejsze, oraz czy przesuszenie dotyczy tylko powierzchni, czy także głębszej części strefy korzeniowej. Nie daje dokładnej zawartości wody w glebie.',
    icon: 'pi-search',
    time: '10–25 minut',
    cost: '0–80 zł',
    equipment: [
      'Szpadel lub ręczny świder',
      'Linijka albo miarka',
      'Podpisane woreczki, jeśli oceniasz próbki później',
      'Notes i karta ze zdjęciami gleby',
    ],
    conditions: 'Pobieraj próbki z rozmarzniętej gleby, kiedy można bezpiecznie wykopać dołek. Zanotuj, kiedy ostatnio padało. Najlepiej oceniać świeżo pobraną ziemię, zanim wyschnie na powietrzu.',
    steps: [
      { title: 'Wybierz dwa lub trzy miejsca', instruction: 'Wybierz typowe punkty pola i zapisz, jaka roślina w nich rośnie. Jeśli osobno sprawdzasz koleinę, suche wzniesienie lub mokre zagłębienie, zaznacz to. Do porównania wybieraj miejsca o możliwie podobnym rodzaju gleby.' },
      { title: 'Pobierz ziemię z trzech głębokości', instruction: 'Wykop mały dołek lub użyj świdra. Odmierz głębokość od powierzchni. Pobierz osobno po garści gleby z warstw 0–10 cm, 10–20 cm i 20–40 cm, jeśli pozwala na to głębokość gleby i układ korzeni. Nie mieszaj próbek z różnych warstw.' },
      { title: 'Sprawdź próbkę w dłoni', instruction: 'Weź świeżą ziemię z jednej warstwy i ściśnij w dłoni. Otwórz palce i sprawdź, czy się rozsypuje, tworzy słabą lub trwałą kulkę, przykleja się do palców, zostawia mokry ślad albo wydziela wodę. Zwróć uwagę, czy przypomina piasek, czy bardziej gliniastą, plastyczną ziemię. W razie krótkiego transportu zamknij próbkę w podpisanym woreczku.' },
      { title: 'Oceń wilgotność każdej warstwy', instruction: 'Skorzystaj z tabeli i zdjęć przedstawiających glebę podobnego rodzaju. Wybierz jeden opis: bardzo sucha, sucha, umiarkowanie wilgotna, mokra albo bardzo mokra. Piasek nawet przy znacznej wilgotności może tworzyć słabą kulkę, dlatego nie oceniaj różnych rodzajów gleby wyłącznie według tego, czy kulka się utrzymała. Gdy nie umiesz ocenić próbki, zapisz „nie wiem”.' },
      { title: 'Zapisz wyniki i zasyp dołek', instruction: 'Dla każdej głębokości osobno zapisz ocenę wilgotności, zachowanie ziemi i obecność korzeni. Powtórz wszystkie kroki w pozostałych miejscach. Na końcu zasyp dołki.' },
    ],
    reference: {
      title: 'Orientacyjne oznaki wilgotności',
      rows: [
        { label: 'Bardzo sucha', detail: 'Ziemia jest sypka lub bardzo twarda, nie zostawia wilgotnego śladu. Gleba piaszczysta łatwo się rozsypuje, a gliniasta może tworzyć suche, twarde grudki.' },
        { label: 'Sucha', detail: 'Nie widać ani nie czuć wyraźnej wilgoci. Piasek słabo się skleja; gleba gliniasta jest raczej sztywna i trudno ją uformować.' },
        { label: 'Umiarkowanie wilgotna', detail: 'Czuć wilgoć, ale nie widać wolnej wody. Piasek może tworzyć nietrwałą kulkę, a gleba gliniasta łatwiej daje się formować.' },
        { label: 'Mokra', detail: 'Ziemia jest wyraźnie wilgotna w dotyku. Wiele gleb drobnoziarnistych mocniej się lepi i rozmazuje; piasek może nadal słabo trzymać kształt.' },
        { label: 'Bardzo mokra', detail: 'Próbka jest silnie nasiąknięta; może pozostawiać wyraźnie mokry ślad lub wydzielać wodę przy ściskaniu. Widoczne krople są mocną oznaką bardzo dużej wilgotności.' },
        { label: 'Ważne przy porównaniu', detail: 'Te opisy są orientacyjne. Ocena zależy od rodzaju gleby; porównuj próbki z podobnej gleby i korzystaj ze zdjęć w karcie USDA-NRCS.' },
      ],
    },
    record: 'Dla każdego punktu zapisz datę, godzinę, uprawę, ostatni opad, zakres głębokości i rodzaj gleby. Przy każdej warstwie zanotuj ocenę wilgotności, to, czy tworzyła kulkę, czy lepiła się do dłoni i czy były widoczne korzenie. Nie zastępuj niepewnej oceny zgadywaną liczbą.',
    example: 'Środek pola, pszenica, gleba piaszczysta, dwa dni po deszczu. 0–10 cm: sucha, rozsypuje się, nieliczne korzenie. 10–20 cm: umiarkowanie wilgotna, słaba kulka, widoczne korzenie. 20–40 cm: umiarkowanie wilgotna, słaba kulka, widoczne korzenie. Wierzchnia warstwa była suchsza od głębszych.',
    meaning: 'Porównanie warstw pokazuje, gdzie gleba jest względnie suchsza lub wilgotniejsza w chwili pobrania próbek. Suchy wierzch przy wilgotniejszym podglebiu nie oznacza automatycznie niedoboru wody dla roślin. Jeżeli wszystkie badane warstwy są suche, warto sprawdzić stan upraw i inne dane o wodzie. Ta próba nie określa precyzyjnej wilgotności objętościowej ani dawki nawadniania.',
    sources: [{ label: 'USDA-NRCS · karta zdjęć dla różnych rodzajów gleby (PDF)', url: 'https://www.nrcs.usda.gov/sites/default/files/2023-01/Estimating-Soil-Moinsture-By-Feel-And-Appearance.pdf' }],
  },
  {
    slug: 'struktura-gleby',
    title: 'Struktura gleby pod szpadlem (VESS)',
    illustration: {
      src: 'assets/experiments/eks-struktura-gleby.png',
      alt: 'Pobieranie bloku ziemi szpadlem i ocena struktury warstw w skali VESS od 1 do 5.',
    },
    purpose: 'Pozwala ocenić, w których warstwach gleba ma lepszą lub gorszą strukturę oraz czy korzenie napotykają zbite bryły. Może pomóc wskazać miejsca wymagające dalszego sprawdzenia pod kątem zagęszczenia.',
    icon: 'pi-th-large',
    time: '15–30 minut na miejsce',
    cost: '0–100 zł',
    equipment: ['Szpadel', 'Linijka lub taśma miernicza', 'Tacka albo kawałek folii', 'Notes i karta VESS ze zdjęciami'],
    conditions: 'Najłatwiej oceniać glebę lekko wilgotną, kiedy bryły dają się rozdzielać rękami. Odłóż badanie, jeśli ziemia jest tak sucha, że rozpada się na pył albo jest tak mokra, że rozmazuje się pod naciskiem. Porównuj miejsca o podobnym rodzaju gleby.',
    steps: [
      { title: 'Wybierz miejsca do porównania', instruction: 'Wybierz typowe miejsce pola oraz punkt, w którym podejrzewasz zagęszczenie, np. koleinę. Zanotuj, gdzie znajdują się kałuże, skorupa na powierzchni lub rośliny o słabszym wzroście. Staraj się wybrać miejsca o podobnej glebie.' },
      { title: 'Wyjmij możliwie cały blok ziemi', instruction: 'Wykop mały dołek o głębokości około 30 cm. Jedna jego pionowa ściana będzie przednią stroną pobieranego bloku. Szpadlem odetnij dwa boki i tył bloku o szerokości zbliżonej do szerokości szpadla. Następnie ostrożnie podważ blok od spodu i wyjmij go, starając się zachować układ warstw. Połóż go na folii górą do góry. Zmierz jego rzeczywistą głębokość. Jeśli całkowicie się rozpadł podczas wyjmowania, spróbuj ponownie obok.' },
      { title: 'Obejrzyj bryły, warstwy i korzenie', instruction: 'Najpierw obejrzyj cały blok, a potem delikatnie rozdzielaj bryły rękami, nie rozbijając ich szpadlem. Sprawdź, czy pękają łatwo, czy mają małe otwory i czy korzenie przechodzą przez bryły, omijają je lub skręcają w bok. Jeśli widzisz różne warstwy, zmierz od powierzchni ich górne i dolne granice.' },
      { title: 'Przyznaj ocenę VESS od 1 do 5', instruction: 'Porównaj każdą warstwę z tabelą oraz zdjęciami na karcie VESS: 1 oznacza bardzo dobrą strukturę, a 5 bardzo słabą. Jeśli blok jest jednolity, możesz nadać mu jedną ocenę. Jeżeli ma różne warstwy, oceń je osobno i zaznacz tę z najwyższą oceną liczbową, czyli o najsłabszej strukturze. Jeśli nie jesteś pewien, zapisz wątpliwość i zrób zdjęcie.' },
      { title: 'Porównaj punkty i zasyp dołki', instruction: 'Zrób zdjęcia z przyłożoną miarką, zachowując orientację bloku. Powtórz badanie w pozostałych miejscach. Porównuj zarówno oceny, jak i głębokość warstw o słabej strukturze. Na końcu zasyp dołki.' },
    ],
    reference: {
      title: 'Skala VESS od 1 do 5',
      rows: [
        { label: '1 · Bardzo dobra', detail: 'Małe, zaokrąglone grudki łatwo kruszą się w palcach. Widać dużo drobnych otworów i korzeni.' },
        { label: '2 · Dobra', detail: 'Bryłki są większe, ale łatwo się rozdzielają. Korzenie są widoczne w całej warstwie.' },
        { label: '3 · Umiarkowana', detail: 'Bryły są twardsze, część ma ostre krawędzie. Widać mniej drobnych otworów i korzeni.' },
        { label: '4 · Słaba', detail: 'Duże, zbite bryły trudno rozłamać. Korzenie pojawiają się głównie w szczelinach.' },
        { label: '5 · Bardzo słaba', detail: 'Ziemia odchodzi w twardych płatach lub wielkich bryłach. Korzeni jest bardzo mało.' },
        { label: 'Ważne', detail: 'Opisy są skrótem skali. Do przyznania oceny użyj również zdjęć wzorcowych VESS; sama twardość ziemi nie wystarcza do rozpoznania zagęszczenia.' },
      ],
    },
    record: 'Zapisz datę, miejsce, stan wilgotności gleby, głębokość wyjętego bloku oraz ocenę VESS dla każdej rozpoznanej warstwy. Podaj zakres głębokości od–do, wygląd brył i kierunek wzrostu korzeni. Do podstawowego porównania wystarczą oceny warstw. Jeśli potrzebna jest jedna ocena całego bloku, można ją obliczyć jako średnią ocen ważoną grubością warstw; najlepiej zautomatyzować to w aplikacji.',
    example: 'Koleina przy wjeździe, blok 0–30 cm: 0–12 cm – ocena 2, drobne bryłki; 12–23 cm – ocena 4, twarde bryły i korzenie skręcające w bok; 23–30 cm – ocena 3. Punkt poza koleiną, blok 0–30 cm: wszystkie warstwy ocenione na 2. Największa różnica dotyczy warstwy 12–23 cm.',
    meaning: 'Wyższa ocena VESS oznacza słabszą strukturę w badanej warstwie. Jeśli w koleinie ocena jest wyższa niż obok i korzenie omijają twarde bryły, może to wskazywać na zagęszczenie związane z przejazdami. Samo badanie nie ustala jednak pewnie przyczyny. Przed wyborem zabiegu sprawdź, czy podobna warstwa występuje też w innych punktach pola.',
    sources: [
      { label: 'AHDB / SRUC · skala VESS ze zdjęciami', url: 'https://ahdb.org.uk/knowledge-library/how-to-assess-soil-structure' },
      { label: 'SRUC · ocena całego bloku (PDF)', url: 'https://www.sruc.ac.uk/media/ki2n30aj/vess-method-description.pdf' },
    ],
  },
  {
    slug: 'brylki-w-wodzie',
    title: 'Bryłki ziemi w wodzie',
    illustration: {
      src: 'assets/experiments/eks-brylki-gleby.png',
      alt: 'Porównanie bryłek z pola i miedzy po 5 i 10 minutach od zanurzenia w wodzie.',
    },
    purpose: 'Pozwala porównać odporność bryłek gleby na szybkie zanurzenie w wodzie: które zachowują kształt, a które łatwiej się rozpadają. Wynik opisuje zachowanie próbek, a nie bezpośrednio zawartość próchnicy w polu.',
    icon: 'pi-objects-column',
    time: '15–30 minut pracy i 1–3 dni suszenia',
    cost: '0–40 zł',
    equipment: [
      'Dwa jednakowe, przezroczyste naczynia o pojemności około 1 litra, na tyle szerokie, aby bryłki nie dotykały ścianek',
      'Dwie siatki lub koszyki, które utrzymają bryłki nad dnem',
      'Woda z tego samego źródła do obu naczyń',
      'Szpadel, linijka, stoper lub telefon i notes',
    ],
    conditions: 'Porównuj bryłki pobrane z podobnego rodzaju gleby i tej samej głębokości, np. z pola i osłoniętej miedzy. Obie powinny być nieuszkodzone i zbliżonej wielkości. Jeśli próbka rozsypie się już podczas pobierania, wybierz inną i odnotuj problem.',
    steps: [
      { title: 'Pobierz parę bryłek', instruction: 'Ostrożnie wyjmij po jednej naturalnej bryłce z górnych 10 cm ziemi w każdym z dwóch miejsc. Wybierz bryłki o szerokości około 5–8 cm. Oznacz je, np. „pole” i „miedza”. Nie zgniataj, nie sklejaj i nie formuj ich rękami.' },
      { title: 'Wysusz obie w tych samych warunkach', instruction: 'Połóż bryłki obok siebie w suchym, przewiewnym miejscu w temperaturze otoczenia na 24–72 godziny, aż będą suche w dotyku. Nie susz jednej na słońcu, a drugiej w cieniu. Zanotuj czas suszenia i wielkość bryłek.' },
      { title: 'Zanurz próbki jednocześnie', instruction: 'Nalej do obu naczyń taką samą ilość wody z tego samego źródła. Umieść siatki nad dnem i delikatnie połóż na nich bryłki. Obie powinny zostać całkowicie przykryte wodą, bez dotykania ścianek. Włącz stoper w chwili zanurzenia. Nie mieszaj wody i nie poruszaj naczyniami.' },
      { title: 'Zapisz obserwacje po 5 i 10 minutach', instruction: 'Po 5 minutach opisz osobno stan każdej bryłki, korzystając z tabeli, i zanotuj, czy woda jest przejrzysta czy mętna. Powtórz obserwację po 10 minutach. Zdjęcia z tych samych chwil ułatwią porównanie. Dodatkowo możesz sprawdzić próbki po godzinie lub po 24 godzinach.' },
      { title: 'Porównaj wyniki i, jeśli możesz, powtórz próbę', instruction: 'Porównuj obie bryłki w tych samych momentach, np. po 5 minutach. Jedna para pokazuje tylko zachowanie dwóch próbek. Aby sprawdzić, czy różnica się powtarza, zbadaj kolejne pary bryłek z tych samych dwóch obszarów, zachowując podobną wielkość, suszenie i rodzaj wody.' },
    ],
    reference: {
      title: 'Jak opisać rozpad bryłki?',
      rows: [
        { label: 'Cała', detail: 'Bryłka zachowała kształt.' },
        { label: 'Spękana', detail: 'Na powierzchni pojawiły się pęknięcia, ale środek nadal trzyma się razem.' },
        { label: 'Częściowo rozpadnięta', detail: 'Część kawałków odpadła, ale większość bryłki pozostała na siatce.' },
        { label: 'W większości rozpadnięta', detail: 'Pozostał tylko niewielki fragment bryłki.' },
        { label: 'Całkiem rozpadnięta', detail: 'Bryłka praktycznie zniknęła z siatki.' },
        { label: 'Nie da się ocenić', detail: 'Zapisz powód, np. mętna woda całkowicie zasłoniła próbkę.' },
      ],
    },
    record: 'Zapisz datę, oba miejsca pobrania, głębokość, rozmiar i czas suszenia każdej bryłki oraz rodzaj wody. Dla każdej próbki osobno zanotuj stan bryłki i wygląd wody po 5 i po 10 minutach. Jeśli wykonasz kolejne pary, zapisz ich wyniki oddzielnie.',
    example: 'Pole i miedza, bryłki o szerokości około 6 cm z głębokości 0–10 cm, suszone obok siebie 48 godzin; deszczówka. Po 5 min: pole – częściowo rozpadnięta, woda mętna; miedza – cała, woda przejrzysta. Po 10 min: pole – w większości rozpadnięta; miedza – spękana. W tej parze bryłka z miedzy lepiej zachowała kształt.',
    meaning: 'Bryłka, która szybciej się rozpada, jest w tej próbie mniej odporna na gwałtowne zalanie. Przyczyną różnic mogą być różne cechy gleby i sposób jej użytkowania; nie można na tej podstawie obliczyć zawartości próchnicy. Aby wyciągać wnioski o większym obszarze, potrzebne są kolejne próbki i najlepiej także inne obserwacje gleby.',
    sources: [{ label: 'SARE · próba zanurzeniowa (Slake Test)', url: 'https://www.sare.org/publications/farming-with-soil-life/observing-soil-life/' }],
  },
  {
    slug: 'deszczomierz',
    title: 'Pomiar deszczu deszczomierzem',
    purpose: 'Pozwala ustalić, ile deszczu spadło w miejscu ustawienia przyrządu w określonym czasie, i sprawdzić, czy lokalny opad różni się od danych pogodowych. Sam pomiar nie mówi, ile tej wody pozostało w glebie.',
    icon: 'pi-cloud-download',
    time: '2–3 minuty dziennie przez wiele dni',
    cost: '20–60 zł',
    equipment: ['Ręczny deszczomierz z podziałką w milimetrach', 'Stabilny uchwyt', 'Zegarek i notes'],
    conditions: 'Ustaw deszczomierz w otwartym miejscu, z dala od drzew, budynków, płotów i zraszaczy. Jeśli przeszkoda wystaje np. 3 m ponad wlot, postaraj się ustawić deszczomierz co najmniej 6 m od niej. Jeśli nie możesz zachować takiej odległości, zapisz to jako ograniczenie pomiaru.',
    steps: [
      { title: 'Ustaw i opróżnij deszczomierz', instruction: 'Zamocuj przyrząd stabilnie i pionowo, tak aby jego wlot był poziomy i nic go nie zasłaniało. Zapisz miejsce ustawienia, np. „Deszczomierz 1, 200 m na zachód od pola”. Opróżnij go i zanotuj datę oraz godzinę rozpoczęcia pomiaru.' },
      { title: 'Odczytuj codziennie o tej samej porze', instruction: 'Wybierz stałą godzinę, np. 8:00. Patrz na podziałkę na wysokości oczu. Jeśli powierzchnia wody tworzy łuk, odczytaj poziom w jego najniższym punkcie. Zapisz wynik w mm oraz rzeczywistą datę i godzinę. Jeśli nie padało i przyrząd działał poprawnie, zapisz 0 mm.' },
      { title: 'Sprawdź zakłócenia', instruction: 'Sprawdź, czy przyrząd nie przechylił się, nie przepełnił, nie przeciekał i czy wlot nie został zasłonięty. Jeśli coś zakłóciło pomiar, zapisz co się stało i nie traktuj wyniku jako pewnego. Jeżeli deszczomierz nie nadaje się do pomiaru opadu śniegu, oznacz pomiar z lodem lub śniegiem jako niepełny.' },
      { title: 'Opróżnij przyrząd po odczycie', instruction: 'Po zapisaniu wyniku wylej wodę i zanotuj godzinę opróżnienia. Od tej chwili zaczyna się kolejny okres pomiarowy. Jeśli opuścisz jeden lub więcej dni, zanotuj wynik jako sumę od ostatniego opróżnienia do aktualnego odczytu; nie rozdzielaj go zgadywaniem na poszczególne dni.' },
      { title: 'Porównaj z danymi za ten sam czas', instruction: 'Porównuj odczyt tylko z opadem dla tego samego lub możliwie bliskiego miejsca i dokładnie tego samego okresu. Jeśli mierzysz od 8:00 do 8:00, a dane pokazują dobę od 0:00 do 0:00, nie zestawiaj tych wartości wprost. Jeśli masz dane godzinowe, zsumuj je za godziny odpowiadające Twojemu pomiarowi.' },
    ],
    record: 'Zapisz nazwę i położenie deszczomierza, datę i godzinę początku oraz końca pomiaru, sumę opadu w mm, godzinę opróżnienia i wszystkie zakłócenia. Przy porównaniu z danymi pogodowymi zapisz źródło danych oraz okres, którego dotyczą.',
    example: 'Deszczomierz 1, 200 m na zachód od pola. Pomiar od 5 czerwca, 8:00, do 6 czerwca, 8:00: 14 mm deszczu, bez zakłóceń. Opróżniony 6 czerwca o 8:00. Dane pogodowe dla tego samego okresu: 9 mm. Różnica: 5 mm.',
    meaning: 'Wynik 14 mm oznacza, że w okresie pomiarowym w miejscu deszczomierza zebrano opad odpowiadający warstwie wody o grubości 14 mm. Różnica względem danych pogodowych może wynikać z lokalnej zmienności deszczu lub niedokładności pomiaru czy danych. Dopiero seria poprawnych pomiarów pokaże, czy takie różnice się powtarzają. Opad nie jest tym samym co ilość wody dostępnej dla roślin.',
    sources: [
      { label: 'CoCoRaHS · odczyty deszczomierza (PDF)', url: 'https://www.weather.gov/media/epz/mesonet/CoCoRaHS-MeasuringRain.pdf' },
      { label: 'USGS · ustawienie deszczomierza', url: 'https://water.usgs.gov/water-resources/memos/memo.php?id=654' },
    ],
  },
];
