export type ExperimentGuide = {
  slug: string;
  title: string;
  purpose: string;
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
    purpose: 'Sprawdź, jak szybko woda wsiąka tam, gdzie po deszczu stoi lub spływa.',
    icon: 'pi-stopwatch',
    time: '20–60 minut lub dłużej',
    cost: '20–80 zł',
    equipment: [
      'Metalowy pierścień bez dna i linijka',
      'Klocek drewniany i gumowy młotek',
      'Folia, naczynie z podziałką w ml i deszczówka lub woda destylowana',
      'Stoper lub telefon oraz notes',
    ],
    conditions: 'Wybierz rozmarzniętą ziemię bez kałuż i głębokich szczelin. Gdy wierzch jest bardzo suchy, poczekaj na deszcz albo zwilż ziemię przed próbą i zaczekaj, aż woda wsiąknie. Zapisz, co zrobiłeś.',
    steps: [
      { title: 'Wybierz trzy miejsca', instruction: 'Wybierz trzy podobne punkty w typowej części pola. Omiń nory i świeżo rozkopaną ziemię. Jeśli sprawdzasz koleinę, zanotuj ją osobno i porównaj z podobnym miejscem poza koleiną. Zapisz, kiedy ostatnio padało, czy ziemia jest sucha i co ją okrywa.' },
      { title: 'Wbij i uszczelnij pierścień', instruction: 'Zmierz średnicę od jednej wewnętrznej krawędzi do drugiej, przez środek. Usuń luźne resztki z wnętrza bez naruszania ziemi. Połóż klocek na pierścieniu i wbij go pionowo na około 7,5 cm. Lekko dociśnij ziemię przy wewnętrznej krawędzi, żeby woda nie uciekała bokiem.' },
      { title: 'Odmierz wodę i uruchom stoper', instruction: 'Dobierz porcję z tabeli poniżej. Wyłóż wnętrze folią i wlej na nią wodę. Ostrożnie wysuń folię i od razu włącz stoper. Zatrzymaj go, gdy zniknie stojąca woda, a ziemia będzie jeszcze błyszcząca. Zapisz czas.' },
      { title: 'Wlej drugą taką samą porcję', instruction: 'Gdy pierwsza porcja całkiem wsiąknie, powtórz próbę z folią w tym samym pierścieniu. Zapisz drugi czas osobno. Zrób to samo w pozostałych punktach. Porównuj drugie porcje z drugimi, najlepiej przy podobnej wilgotności gleby przed próbą.' },
      { title: 'Zapisz też nieudaną próbę', instruction: 'Przed rozpoczęciem ustal, ile czekasz na każdą porcję, np. 60 minut. Jeśli po tym czasie woda nadal stoi, zapisz „nie wsiąkła w 60 min”. Gdy woda ucieknie bokiem lub przerwiesz próbę, zapisz powód i powtórz pomiar w nowym punkcie.' },
    ],
    reference: {
      title: 'Ile wody wlać za każdym razem?',
      rows: [
        { label: '10 cm wewnątrz', detail: 'Około 200 ml' },
        { label: '15 cm wewnątrz', detail: 'Około 450 ml. Dla wzorcowego pierścienia USDA użyj 444 ml.' },
        { label: '20 cm wewnątrz', detail: 'Około 800 ml' },
        { label: 'Inna średnica', detail: 'Na kalkulatorze pomnóż średnicę w cm przez siebie, a następnie przez 2. Otrzymasz porcję w ml, odpowiadającą około 25 mm wody w pierścieniu.' },
      ],
    },
    record: 'Zapisz datę, miejsce, stan powierzchni i wilgotność przed próbą, średnicę i głębokość wbicia pierścienia, ilość wody i osobny czas każdej porcji. Zaznacz, które porcje trafiły na wcześniej zwilżoną glebę i czy cała woda wsiąkła.',
    example: 'Punkt przy wjeździe, poza koleiną. Gleba sucha. Pierścień 15 cm, wbity na 7,5 cm. Pierwsza porcja 450 ml wsiąkła w 12 min, druga w 20 min.',
    meaning: 'Jeśli druga porcja w koleinie wsiąka dłużej niż obok, sprawdź strukturę gleby w obu miejscach. Na czas wsiąkania wpływają też rodzaj i wilgotność ziemi oraz skorupa na powierzchni.',
    sources: [{ label: 'USDA-NRCS · instrukcja z rysunkami (PDF)', url: 'https://www.nrcs.usda.gov/sites/default/files/2022-10/Soil%20Infiltration.pdf' }],
  },
  {
    slug: 'wilgotnosc-gleby',
    title: 'Wilgotność gleby w dłoni',
    purpose: 'Sprawdź, czy ziemia jest sucha też głębiej, tam gdzie rosną korzenie.',
    icon: 'pi-search',
    time: '10–25 minut',
    cost: '0–80 zł',
    equipment: [
      'Szpadel lub ręczny świder',
      'Linijka albo miarka',
      'Podpisane woreczki, jeśli oceniasz próbki później',
      'Notes i karta ze zdjęciami gleby',
    ],
    conditions: 'Zrób próbę w sezonie, gdy ziemia jest rozmarznięta i możesz bezpiecznie pobrać próbki. Po deszczu dobrze widać, czy wilgoć dotarła głębiej.',
    steps: [
      { title: 'Wybierz dwa lub trzy miejsca', instruction: 'Zacznij od typowych miejsc pola. Zapisz, co rośnie i jak duże są rośliny. Gdy osobno sprawdzasz koleinę lub mokre zagłębienie, oznacz je w notesie.' },
      { title: 'Pobierz ziemię z osobnych głębokości', instruction: 'Wykop mały dołek lub użyj świdra. Odmierz głębokość od powierzchni i pobierz po garści z każdej warstwy osobno. Możesz zacząć od głębokości 0–10, 10–20 i 20–40 cm, zależnie od uprawy i tego, jak głęboko sięgają korzenie.' },
      { title: 'Ściśnij garść świeżej ziemi', instruction: 'Sprawdź, czy ziemia jest ziarnista jak piasek, czy gładka i plastyczna jak glina. Ściśnij ją w dłoni i otwórz palce. Zobacz, czy powstała kulka, czy łatwo się kruszy, czy ziemia lepi się do palców i czy widać wodę. Obejrzyj próbkę od razu. Na krótki transport zamknij ją w woreczku.' },
      { title: 'Oceń każdą warstwę', instruction: 'Porównaj próbkę ze zdjęciami podobnej gleby, korzystając z karty na dole strony. Wybierz opis: bardzo sucha, sucha, umiarkowanie wilgotna, mokra albo bardzo mokra. Gdy trudno rozpoznać rodzaj ziemi lub ocenić jej stan, zapisz „nie wiem”. Zapisz też, czy widzisz korzenie.' },
      { title: 'Powtórz i zasyp dołki', instruction: 'Sprawdź kolejne warstwy i miejsca tak samo. Zapisz każdy wynik oddzielnie. Zasyp dołki po pracy.' },
    ],
    reference: {
      title: 'Jak zachowuje się ziemia w dłoni?',
      rows: [
        { label: 'Gleba piaszczysta', detail: 'Sucha przesypuje się przez palce. Wilgotniejsza może skleić się w słabą kulkę, która łatwo się rozpada.' },
        { label: 'Gleba gliniasta', detail: 'Sucha bywa twarda i grudkowata. Wilgotna łatwiej daje się ulepić w kulkę. Im mokrzejsza, tym mocniej może lepić się i rozmazywać na palcach.' },
        { label: 'Widoczne krople', detail: 'Jeśli po ściśnięciu pojawiają się krople, próbka jest bardzo mokra.' },
      ],
    },
    record: 'Zapisz godzinę, datę, uprawę, miejsce, zakres głębokości, rodzaj gleby, ocenę wilgotności i to, czy dało się ulepić kulkę oraz czy były widoczne korzenie.',
    example: 'Środek pola, pszenica. 0–10 cm: piaszczysta, sucha, rozsypuje się. 20–40 cm: piaszczysta, umiarkowanie wilgotna, słaba kulka, widać korzenie.',
    meaning: 'Suchy wierzch i wilgotniejsza ziemia niżej oznaczają, że wilgoć różni się z głębokością w tym miejscu. Jeśli na wszystkich sprawdzonych głębokościach jest sucho, może brakować wody w zbadanej części pola. Zapisuj opis wilgotności. Do ustalenia dawki nawadniania potrzebne są dodatkowe dane.',
    sources: [{ label: 'USDA-NRCS · karta zdjęć dla różnych rodzajów gleby (PDF)', url: 'https://www.nrcs.usda.gov/sites/default/files/2023-01/Estimating-Soil-Moinsture-By-Feel-And-Appearance.pdf' }],
  },
  {
    slug: 'struktura-gleby',
    title: 'Struktura gleby pod szpadlem (VESS)',
    purpose: 'Obejrzyj bryły i korzenie, żeby znaleźć zbitą warstwę gleby.',
    icon: 'pi-th-large',
    time: '15–30 minut na miejsce',
    cost: '0–100 zł',
    equipment: ['Szpadel', 'Linijka lub taśma miernicza', 'Tacka albo kawałek folii', 'Notes i karta VESS ze zdjęciami'],
    conditions: 'Pracuj, gdy ziemia jest lekko wilgotna i bryły dają się rozdzielać rękami. Poczekaj, gdy ziemia jest twarda od suszy albo rozmazuje się od nadmiaru wody.',
    steps: [
      { title: 'Porównaj dwa lub trzy miejsca', instruction: 'Wybierz typowe miejsce i miejsce podejrzane o ubicie, np. koleinę. Szukaj punktów o podobnym rodzaju gleby. Zanotuj koleiny, skorupę, kałuże lub różnicę we wzroście roślin.' },
      { title: 'Wyjmij blok ziemi sięgający około 30 cm w głąb', instruction: 'Wykop mały dołek na głębokość szpadla. Przy jego równej ścianie odetnij szpadlem trzy pozostałe boki bloku. Podważ go ostrożnie, połóż na folii stroną od dołka do góry i zmierz rzeczywistą głębokość. Jeśli blok się rozsypie, wyjmij drugi.' },
      { title: 'Znajdź warstwy i obejrzyj korzenie', instruction: 'Rozchyl blok dłońmi. Jeśli w środku widać inną warstwę, zmierz jej górną i dolną granicę od powierzchni ziemi. Rozdzielaj bryły ręcznie. Zobacz, jak łatwo pękają, czy mają drobne otwory i czy korzenie przechodzą przez bryły, rosną tylko w szczelinach lub skręcają w bok.' },
      { title: 'Oceń strukturę od 1 do 5', instruction: 'Porównaj ziemię z tabelą poniżej i z kartą zdjęć VESS. Jeśli cały blok wygląda podobnie, daj mu jedną ocenę. Jeśli widać różne warstwy, oceń każdą osobno. Zaznacz warstwę z najwyższą liczbą, bo to w niej struktura jest najsłabsza.' },
      { title: 'Powtórz w kolejnych miejscach', instruction: 'Jeśli możesz, zrób zdjęcie bloku z miarką. Zasyp dołek i zrób nową próbę w pozostałych punktach.' },
    ],
    reference: {
      title: 'Skala VESS od 1 do 5',
      rows: [
        { label: '1 · Bardzo dobra', detail: 'Małe, zaokrąglone grudki łatwo kruszą się w palcach. Widać dużo drobnych otworów i korzeni.' },
        { label: '2 · Dobra', detail: 'Bryłki są większe, ale łatwo się rozdzielają. Korzenie są widoczne w całej warstwie.' },
        { label: '3 · Umiarkowana', detail: 'Bryły są twardsze, część ma ostre krawędzie. Widać mniej drobnych otworów i korzeni.' },
        { label: '4 · Słaba', detail: 'Duże, zbite bryły trudno rozłamać. Korzenie pojawiają się głównie w szczelinach.' },
        { label: '5 · Bardzo słaba', detail: 'Ziemia odchodzi w twardych płatach lub wielkich bryłach. Korzeni jest bardzo mało.' },
      ],
    },
    record: 'Zapisz miejsce, datę, stan powierzchni i głębokość całego bloku. Dla każdej warstwy dopisz głębokość od–do, ocenę i zachowanie korzeni. Jeśli potrzebujesz jednej oceny dla całego bloku, pomnóż ocenę każdej warstwy przez jej grubość w cm. Dodaj wyniki i podziel przez głębokość bloku w cm.',
    example: 'Koleina przy wjeździe, blok do 30 cm. Warstwa 12–23 cm: ocena 4, twarde bryły, korzenie skręcają w bok.',
    meaning: 'Jeśli w koleinie bryły są wyraźnie bardziej zbite niż obok, przejazdy mogły ubić ziemię. Przed decyzją o zabiegu sprawdź, jak głęboko i w ilu miejscach na polu występuje zbita warstwa.',
    sources: [
      { label: 'AHDB / SRUC · skala VESS ze zdjęciami', url: 'https://ahdb.org.uk/knowledge-library/how-to-assess-soil-structure' },
      { label: 'SRUC · ocena całego bloku (PDF)', url: 'https://www.sruc.ac.uk/media/ki2n30aj/vess-method-description.pdf' },
    ],
  },
  {
    slug: 'brylki-w-wodzie',
    title: 'Bryłki ziemi w wodzie',
    purpose: 'Porównaj, czy bryłki z dwóch miejsc zachowują kształt po zanurzeniu.',
    icon: 'pi-objects-column',
    time: '15–30 minut pracy i 1–3 dni suszenia',
    cost: '0–40 zł',
    equipment: ['Dwa jednakowe, przezroczyste naczynia po około 1 litrze', 'Dwie siatki lub koszyki, które utrzymają bryłki nad dnem', 'Woda z tego samego źródła do obu naczyń', 'Szpadel, linijka, stoper lub telefon i notes'],
    conditions: 'Przygotuj dwie nieuszkodzone bryłki podobnej wielkości z podobnej gleby, np. z uprawianej części pola i osłoniętego fragmentu obok. Jeśli bryłka rozpadnie się przed zanurzeniem, przygotuj nową.',
    steps: [
      { title: 'Pobierz dwie bryłki', instruction: 'Ostrożnie wyjmij po jednej bryłce z górnych 10 cm ziemi w każdym miejscu. Wybierz bryłki szerokie na około 5–8 cm. Oznacz je nazwą miejsca. Nie rozgniataj ich ani nie sklejaj w dłoni.' },
      { title: 'Wysusz przez 1–3 dni', instruction: 'Połóż bryłki obok siebie na 24–72 godziny w temperaturze otoczenia, aż obie będą suche w dotyku. Zapisz, ile czasu schły i jak szeroka jest każda z nich.' },
      { title: 'Zanurz obie bryłki', instruction: 'Do dwóch naczyń wlej tę samą wodę i zawieś w nich siatki nad dnem. Delikatnie połóż po jednej bryłce na siatce. Woda powinna całkowicie je zakryć. Włącz stoper. Nie mieszaj wody i nie potrząsaj naczyniami.' },
      { title: 'Obejrzyj obie próbki po 5 i 10 minutach', instruction: 'W każdej z tych chwil zanotuj osobno kształt bryłki i to, czy woda zmętniała. Jeśli chcesz, zrób zdjęcia po zanurzeniu i przy odczytach. Możesz powtórzyć obserwację po godzinie i po 24 godzinach.' },
      { title: 'Porównaj odczyty z tej samej chwili', instruction: 'Porównaj 5 minut z 5 minutami i 10 minut z 10 minutami. Jeśli bryłki różniły się wielkością, wilgotnością po suszeniu lub rodzajem gleby, zanotuj to i powtórz próbę z lepiej dobranymi bryłkami.' },
    ],
    reference: {
      title: 'Jak opisać rozpad bryłki?',
      rows: [
        { label: 'Cała', detail: 'Bryłka zachowała kształt.' },
        { label: 'Spękana', detail: 'Na powierzchni pojawiły się pęknięcia, środek trzyma się razem.' },
        { label: 'Częściowo rozpadnięta', detail: 'Kawałki odpadają, ale większość bryłki jeszcze się trzyma.' },
        { label: 'W większości rozpadnięta', detail: 'Pozostał tylko niewielki kawałek.' },
        { label: 'Całkiem rozpadnięta', detail: 'Bryłka praktycznie znikła z siatki.' },
        { label: 'Nie da się ocenić', detail: 'Zapisz przyczynę, np. bardzo mętna woda zasłoniła próbkę.' },
      ],
    },
    record: 'Dla każdej próbki zapisz miejsce, głębokość, szerokość bryłki, czas suszenia i rodzaj wody. Przy każdym odczycie dopisz czas od zanurzenia, opis bryłki i wygląd wody.',
    example: 'Bryłki po 6 cm, suszone 48 godz., deszczówka. Po 5 min: bryłka z pola częściowo się rozpadła, woda mętna. Bryłka znad miedzy zachowała kształt, woda przejrzysta.',
    meaning: 'Szybszy rozpad pokazuje, że dana bryłka gorzej zniosła gwałtowne zalanie. Warto przyjrzeć się, czy ziemia w tym miejscu ma okrywę roślinną. Zapisz opis rozpadu. Zawartość próchnicy wymaga osobnego badania.',
    sources: [{ label: 'SARE · próba zanurzeniowa (Slake Test)', url: 'https://www.sare.org/publications/farming-with-soil-life/observing-soil-life/' }],
  },
  {
    slug: 'deszczomierz',
    title: 'Pomiar deszczu deszczomierzem',
    purpose: 'Zobacz, ile deszczu naprawdę spadło w pobliżu Twojego pola.',
    icon: 'pi-cloud-download',
    time: '2–3 minuty dziennie przez wiele dni',
    cost: '20–60 zł',
    equipment: ['Ręczny deszczomierz z podziałką w milimetrach', 'Stabilny uchwyt', 'Zegarek i notes'],
    conditions: 'Wybierz otwarte miejsce z dala od drzew, budynków, płotów i zraszaczy. Jeśli przeszkoda wystaje o 3 m nad wlot deszczomierza, ustaw przyrząd w miarę możliwości co najmniej 6 m od niej. Jeżeli przyrząd musi stać bliżej, zanotuj to.',
    steps: [
      { title: 'Zamontuj pusty deszczomierz', instruction: 'Ustaw go pionowo w stabilnym uchwycie, z poziomym, odsłoniętym wlotem. Zapisz nazwę przyrządu i jego położenie, np. „Deszczomierz 1, 200 m na zachód od pola”. Opróżnij przyrząd i zapisz datę i godzinę rozpoczęcia.' },
      { title: 'Odczytuj codziennie o stałej porze', instruction: 'Wybierz godzinę, np. 8:00 rano czasu lokalnego. Odczytaj poziom wody na wysokości oczu, przy dolnej krawędzi wody. Zapisz liczbę w milimetrach oraz rzeczywistą datę i godzinę. Gdy nie padało, a przyrząd działał poprawnie, zapisz 0 mm.' },
      { title: 'Sprawdź, czy coś zakłóciło pomiar', instruction: 'Zanotuj, jeśli przyrząd się przepełnił, przechylił, woda się wylała albo wlot zatkały liście. Jeśli w środku jest śnieg lub lód, oznacz pomiar jako niepełny, o ile przyrząd i sposób pomiaru są przeznaczone tylko do deszczu.' },
      { title: 'Opróżnij przyrząd po odczycie', instruction: 'Zapisz godzinę opróżnienia. Od tej chwili zaczyna się kolejny pomiar. Jeśli opuścisz dzień i woda nadal jest w przyrządzie, zapisz jedną sumę od ostatniego opróżnienia do odczytu. Zostaw ją jako sumę z kilku dni.' },
      { title: 'Porównaj z pogodą za te same godziny', instruction: 'Zestawiaj odczyt tylko z sumą w danych pogodowych dla tego samego miejsca i dokładnie tego samego okresu. Jeśli Twój odczyt jest od 8:00 do 8:00, a dane obejmują dobę od północy do północy, pomiń takie porównanie.' },
    ],
    record: 'Zapisz nazwę i lokalizację deszczomierza, datę i godzinę od–do, odczyt w mm, ewentualne zakłócenia i czas opróżnienia.',
    example: 'Deszczomierz 1, 200 m na zachód od pola. 5 czerwca, 8:00 – 6 czerwca, 8:00. Opad 14 mm. Bez zakłóceń. Opróżniony o 8:00.',
    meaning: 'Jeśli deszczomierz wskazał 14 mm, a dane pogodowe dla tego samego okresu 9 mm, w tym pomiarze różnica wynosi 5 mm. Kilka poprawnych odczytów pozwoli sprawdzić, czy różnica się powtarza.',
    sources: [
      { label: 'CoCoRaHS · odczyty deszczomierza (PDF)', url: 'https://www.weather.gov/media/epz/mesonet/CoCoRaHS-MeasuringRain.pdf' },
      { label: 'USGS · ustawienie deszczomierza', url: 'https://water.usgs.gov/water-resources/memos/memo.php?id=654' },
    ],
  },
];
