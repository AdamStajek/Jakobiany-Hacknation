"""Plain-language explanations shown in the action catalogue, keyed by action ID."""

DESCRIPTIONS = {
    1: ("Po zbiorach można rozłożyć na ziemi zdrowe resztki roślin, takie jak słoma czy łodygi. "
        "Taka warstwa osłania ziemię i pomaga jej dłużej utrzymać wilgoć."),
    2: ("Między zbiorem jednej uprawy a siewem następnej można wysiać rośliny osłaniające ziemię. "
        "To międzyplon. Potrzebuje wilgoci, żeby wzejść, a gdy rośnie, sam zużywa wodę."),
    3: ("Mulczowanie to przykrycie gołej ziemi warstwą materiału, np. słomą. "
        "Spowalnia wysychanie ziemi, jeśli taki sposób okrycia pasuje do rosnących tam roślin."),
    4: ("Na polu, które często wysycha, można orać mniej intensywnie. "
        "Pomaga to zachować wilgoć, zwłaszcza gdy ziemia pozostaje osłonięta, a uprawa dobrze znosi taką zmianę."),
    5: ("Można siać bez odwracania ziemi pługiem albo przygotować ziemię tylko w wąskich pasach pod siew. "
        "Przy częstych suszach warto sprawdzić, czy takie podejście pasuje do gleby i kolejności upraw."),
    6: ("Kompost lub obornik mogą pomóc glebie zatrzymywać wodę. "
        "Najpierw warto zbadać glebę, bo efekt zależy między innymi od tego, jak dużo ma piasku i gliny."),
    7: ("Specjalna maszyna może rozluźnić mocno ubitą warstwę ziemi pod powierzchnią. "
        "Ma to sens tam, gdzie sprawdzono głębokość tej warstwy i ziemia jest na tyle sucha, że się kruszy."),
    8: ("Ciężki sprzęt zostawia koleiny i ubija mokrą ziemię. "
        "Można ograniczyć liczbę przejazdów albo zaczekać, aż pole obeschnie."),
    9: ("W czasie suszy chwasty pobierają część wody potrzebnej uprawie. "
        "Gdy na polu widać chwasty, można ograniczyć ich wzrost metodą dopasowaną do uprawy."),
    10: ("Płodozmian to uprawianie na tym samym polu różnych roślin w kolejnych latach. "
         "Taka zmiana może poprawić stan gleby i pomóc uzyskać bardziej przewidywalne zbiory w suchych latach."),
    11: ("W zagłębieniu, do którego dopływa woda, można zaplanować zbiornik na jej zapas. "
         "Przed budową trzeba sprawdzić dopływ, warunki w terenie i wymagane formalności."),
    12: ("Małe oczko wodne może zatrzymać część deszczówki i ziemi niesionej przez wodę. "
         "Przywrócenie oczka warto rozważyć w miejscu, gdzie kiedyś było, lub tam, gdzie sprzyja temu teren. "
         "Potrzebna jest ocena wpływu na przyrodę i sprawdzenie formalności."),
    13: ("Zastawka to przegroda, która pozwala regulować poziom wody w rowie odwadniającym. "
         "Może spowolnić odpływ, ale podnosi poziom wody także w okolicy. "
         "Trzeba uzgodnić jej montaż z zarządcą rowu i sprawdzić ryzyko podtopień."),
    14: ("Pas drzew i krzewów spowalnia wiatr, który z otwartego pola może wywiewać ziemię. "
         "Gdy ten problem się powtarza, warto dobrać miejsce i rośliny do warunków na polu."),
    15: ("Pas trawy na drodze spływu lub przy rowie czy strumieniu spowalnia wodę. "
         "Zatrzymuje część ziemi, którą deszcz wymywa z pola."),
    16: ("Rzędy roślin prowadzone w poprzek zbocza spowalniają wodę płynącą w dół. "
         "Taki układ ma sens tam, gdzie maszyny mogą bezpiecznie jeździć w poprzek zbocza."),
    17: ("Na stromym zboczu można zaprojektować płaskie stopnie, czyli tarasy. "
         "Dzielą długą drogę spływu na krótsze odcinki. Specjalista musi ocenić stabilność gruntu i sposób odprowadzania wody."),
    18: ("Wodę z rynny można zbierać w zbiorniku i wykorzystać później, np. do podlewania. "
         "Ilość wody zależy od wielkości dachu, opadów i pojemności zbiornika."),
    19: ("W odpowiedniej sieci rur odwadniających można sterować odpływem. "
         "Dzięki temu w suchym okresie woda dłużej zostaje w glebie, a w mokrym jej nadmiar można odprowadzić."),
    20: ("Mokradła i naturalnie zalewane zakątki spowalniają odpływ wody. "
         "Przed osuszaniem lub zmianą terenu warto sprawdzić na miejscu, czy to cenny przyrodniczo fragment pola."),
    21: ("Podlewanie uzupełnia wodę, której brakuje roślinom. "
         "Decyzja ma sens po pomiarze wilgoci na głębokości korzeni, gdy prognozowany deszcz nie wystarczy, "
         "a wody do podlewania można użyć zgodnie z prawem."),
    22: ("Można odłożyć podlewanie, jeśli pomiar pokazuje, że roślinom wystarczy wody na najbliższe dni. "
         "Prognozowany deszcz musi też wystarczyć na ich potrzeby i mieć szansę wsiąknąć aż do korzeni."),
    23: ("Jeśli w dzień woda szybko paruje, zraszacze mogą pracować rano albo wieczorem. "
         "Warto wybrać porę z odpowiednim wiatrem i uwzględnić, że długo mokre liście sprzyjają niektórym chorobom."),
    24: ("Zamiast podać dużo wody naraz, można podzielić ją na mniejsze porcje. "
         "Przy płytkich korzeniach albo glebie, która zatrzymuje mało wody, zmniejsza to ryzyko przesiąkania poza zasięg korzeni."),
    25: ("Po pomiarach wilgotności można podlewać tylko te fragmenty pola, które tego potrzebują. "
         "Potrzebna jest instalacja pozwalająca osobno uruchamiać podlewanie w różnych częściach pola."),
    26: ("Przewody kroplujące podają małe ilości wody blisko korzeni. "
         "Takie rozwiązanie warto rozważyć przy częstych niedoborach, jeśli pasuje do uprawy, a źródło wody jest dostępne zgodnie z prawem."),
    27: ("Odmiany tej samej rośliny różnie znoszą brak wody. "
         "Na polu, które często wysycha, przy wyborze nasion warto uwzględnić wyniki prób w podobnych warunkach."),
    28: ("Jeśli uprawie regularnie brakuje wody, na kolejny sezon można wybrać inny gatunek o mniejszym zapotrzebowaniu. "
         "Powinien pasować do gleby i miejscowego klimatu oraz mieć odbiorcę po zbiorze."),
    29: ("Przesunięcie siewu może sprawić, że rośliny przejdą najwrażliwszy okres wzrostu poza typową porą suszy. "
         "Nowy termin musi pasować do uprawy i warunków, w których nasiona mają wykiełkować."),
    30: ("Czujniki pokazują, ile wilgoci jest w ziemi na głębokości korzeni. "
         "Pomiary pomagają śledzić zmiany i sprawdzić, czy różne części pola wysychają w tym samym tempie."),
    31: ("Maszyny mogą jeździć zawsze po tych samych wyznaczonych torach. "
         "Wtedy koła ubijają ziemię głównie na tych torach, a reszta pola jest mniej narażona."),
    32: ("Jeśli badanie wykaże, że ziemia jest za kwaśna dla danej uprawy, można dodać nawóz wapniowy. "
         "O ilości wapna decydują wynik badania i potrzeby roślin."),
    33: ("Rośliny wysiane między dwiema głównymi uprawami osłaniają ziemię, ale zużywają wodę. "
         "Gdy wilgoci ubywa i zbliża się kolejny siew, można zakończyć ich wzrost w terminie odpowiednim dla uprawy i gospodarstwa."),
    34: ("Dodatkowe spulchnianie lub mieszanie suchej ziemi może przyspieszyć jej wysychanie. "
         "Gdy brakuje wilgoci, warto zostawić osłonę gleby i pominąć prace, które nie są potrzebne."),
    35: ("Fragment pola, z którego woda regularnie zmywa ziemię i gdzie uprawa słabo się udaje, można obsiać roślinami wieloletnimi. "
         "Ich okrywa spowalnia wodę i zatrzymuje część niesionej przez nią ziemi."),
    36: ("Jeśli woda zbiera się w jednym obniżeniu i wymywa tam ziemię, można obsiać jej drogę trawą. "
         "Korzenie trawy pomagają chronić ziemię, gdy płynie po niej woda."),
    37: ("Płytkie zagłębienie może zbierać deszczówkę i pozwolić jej stopniowo wsiąkać w grunt. "
         "Potrzebna jest przepuszczalna ziemia oraz woda, która nie wniesie zanieczyszczeń do gruntu."),
    38: ("Na zboczu można rozmieścić różne uprawy w naprzemiennych pasach biegnących w poprzek spadku. "
         "Pasy lepiej osłonięte przez rośliny przerywają drogę spływu i ograniczają wymywanie ziemi."),
    39: ("Drzewa sadzone razem z uprawami mogą chronić ziemię przed wymywaniem i ograniczać parowanie. "
         "Trzeba tak dobrać gatunki i odstępy, żeby drzewa i uprawy nie konkurowały nadmiernie o wodę."),
    40: ("Jeśli sztuczny zbiornik traci wodę przez potwierdzony przeciek, można go uszczelnić. "
         "Najpierw trzeba ocenić, jak zmniejszenie wsiąkania wpłynie na okolicę."),
    41: ("Nagły wzrost zużycia wody, spadek ciśnienia albo mokre miejsce przy rurze mogą oznaczać wyciek. "
         "Przegląd instalacji i pomiar przepływu pomagają znaleźć przyczynę."),
    42: ("Rozstawione na polu pojemniki pokażą, czy wszędzie trafia podobna ilość wody ze zraszaczy. "
         "Jeśli wyniki się różnią, można sprawdzić dysze, ciśnienie i wpływ wiatru."),
    43: ("Gdy wody nie wystarcza na wszystkie uprawy, można najpierw podlać te, w których brak wody na obecnym etapie wzrostu "
         "najmocniej zmniejszyłby zbiory."),
    44: ("Silny wiatr znosi wodę ze zraszaczy, więc część pola dostaje jej mniej. "
         "Podlewanie można przesunąć na spokojniejszą porę, jeśli roślinom wystarczy wody do tego czasu."),
    45: ("Liczbę roślin na metr kwadratowy można dopasować do tego, ile wody zwykle ma pole. "
         "Przed zmianą trzeba sprawdzić, jaka gęstość siewu jest odpowiednia dla wybranego gatunku i odmiany."),
    46: ("Jeśli susza zwykle nasila się pod koniec sezonu, wcześniej dojrzewająca odmiana może zdążyć przed najgorszym okresem. "
         "Musi przy tym pasować do warunków pola przez cały sezon."),
    47: ("Rośliny o długich korzeniach mogą korzystać z wilgoci położonej głębiej niż wyschnięta powierzchnia. "
         "Zyskują na tym tylko wtedy, gdy na dole rzeczywiście jest woda, a korzenie mogą do niej dotrzeć."),
    48: ("Gdy susza ogranicza wzrost, uprawa może dać mniejsze zbiory i pobrać mniej azotu. "
         "Ilość nawozu warto przeliczyć według spodziewanych zbiorów i ilości składników dostępnych dla roślin."),
    49: ("Zamiast podać cały nawóz azotowy jednego dnia, można rozłożyć go na kilka terminów. "
         "Pozwala to dopasować nawożenie do opadów, rodzaju ziemi i tego, ile azotu potrzebuje wtedy uprawa."),
    50: ("W jednym gospodarstwie niektóre pola szybciej wysychają, a inne dłużej trzymają wilgoć. "
         "Można rozplanować siew tak, by uprawy potrzebujące więcej wody trafiły na pola, które lepiej ją zatrzymują."),
    51: ("Przed sezonem można rozpisać, ile wody jest do dyspozycji i w których momentach będzie najbardziej potrzebna. "
         "Część zapasu można od razu przeznaczyć na późniejszy okres suszy."),
    52: ("Przed podlewaniem można sprawdzić sondą lub próbką gleby, ile wilgoci jest tam, gdzie sięgają korzenie. "
         "To pomaga zweryfikować obliczenia aplikacji lub to, co widać na zdjęciu satelitarnym."),
    53: ("Zdjęcie satelitarne może wskazać miejsce, gdzie rośliny wyglądają gorzej niż w podobnej fazie wzrostu. "
         "Wizyta na polu pomaga ustalić, czy przyczyną jest brak wody, czy inny problem."),
    54: ("Badanie próbki może pokazać, z jakich cząstek składa się gleba i ile wody potrafi zatrzymać. "
         "Pomaga dokładniej ocenić zapas dla roślin, gdy dane o polu są niepełne lub się różnią."),
    55: ("Gdy woda stoi lub spływa po suchej ziemi, warto sprawdzić, jak szybko wsiąka i czy pod powierzchnią nie ma ubitej warstwy. "
         "Te dwie obserwacje pomagają ustalić przyczynę problemu."),
    56: ("Nasiona potrzebują wilgoci w tej części ziemi, w której są wysiewane. "
         "Gdy ziemia jest tam za sucha, można poczekać, jeśli późniejszy siew nadal da roślinom dość czasu na wzrost."),
    57: ("Na mokrym polu koła łatwo robią koleiny i ubijają ziemię. "
         "Warto wstrzymać wjazd do czasu, aż pole obeschnie na tyle, żeby wytrzymać ciężar maszyny."),
    58: ("Upał może zmienić skuteczność oprysku i reakcję roślin. "
         "Jeżeli warunki wykraczają poza zalecenia na etykiecie środka, oprysk trzeba przesunąć na odpowiednią porę."),
    59: ("Ulewa tuż po nawożeniu może zmyć nawóz z pola albo przenieść go za głęboko, by korzenie mogły z niego skorzystać. "
         "Gdy prognoza zapowiada taki deszcz, warto przesunąć nawożenie na bezpieczniejszy termin."),
    60: ("Jeśli po podtopieniu woda długo stoi, po ustąpieniu zagrożenia można sprawdzić, czy odpływy są drożne. "
         "Ewentualne prace przy rowach i innych urządzeniach wodnych trzeba uzgodnić z ich zarządcą."),
    61: ("Nowy rów może odprowadzić wodę z miejsca regularnie podtapianego. "
         "Przed wykopem trzeba zweryfikować przebieg, odbiornik wody, wpływ na sąsiednie grunty i wymagane formalności. "
         "Sprawdź też, czy odpływ nie pogłębi niedoboru wody w suchych okresach."),
}
