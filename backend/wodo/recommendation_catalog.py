"""KOWR action catalogue and the evidence required by each rule."""

from csv import DictReader
from pathlib import Path

# Keys shared by the rules, the optional farmer checklist and report evidence.
OBSERVATIONS = {
    "harvested": "Zbiór zakończony, a na odkrytej glebie są zdrowe resztki pożniwne",
    "cover_sowing": "Odkryta gleba między uprawami, z odpowiednią wilgocią i terminem na wschody międzyplonu",
    "mulch_fit": "Odkryta gleba; uprawa i dostępny materiał pozwalają na ściółkowanie",
    "less_tillage": "Przed siewem na tym stanowisku można ograniczyć orkę",
    "no_till_fit": "Gleba, okrywa i płodozmian pozwalają przejść na uprawę bezorkową lub pasową",
    "low_soc": "Badanie gleby i zalecenie agronomiczne potwierdzają potrzebę zwiększenia zawartości materii organicznej",
    "compact_dry": "Po zbiorze potwierdzono warstwę zagęszczoną i odpowiednio suchą glebę na głębokości pracy",
    "compaction_risk": "Gleba jest podatna na zagęszczenie, a planowane są przejazdy ciężkimi maszynami",
    "weeds": "W rosnącej uprawie stwierdzono konkurujące chwasty",
    "rotation_issue": "Monokultura lub pogarszająca się struktura gleby",
    "reservoir_site": "Rozpoznano zagłębienie i dopływ; potwierdzono wykonalność techniczną i formalną zbiornika",
    "pond_site": "Dawne oczko lub odpowiednie warunki terenowe; ocena przyrodnicza i formalna dopuszcza odtworzenie",
    "ditch_control": "Rów odprowadza za dużo wody; zarządca uzgodnił regulację i sprawdzono ryzyko podtopień",
    "windbreak_site": "Otwarty teren z częstym silnym wiatrem i erozją wietrzną; wybrano miejsce i odpowiednie gatunki",
    "buffer_site": "Obserwowany spływ powierzchniowy lub bezpośrednie sąsiedztwo cieku",
    "contour_safe": "Potwierdzony stok i możliwość bezpiecznej pracy maszyn w poprzek stoku",
    "terrace_site": "Ekspertyza potwierdza duże nachylenie, erozję i wykonalność tarasowania",
    "roof_site": "Jest dostępny dach oraz miejsce na magazynowanie deszczówki i możliwość jej wykorzystania",
    "drain_control": "Sieć drenarska jest odpowiednia do regulacji, a na polu występują sezonowe nadmiary i niedobory wody",
    "wetland": "Potwierdzone mokradło lub okresowo zalewany fragment o walorach przyrodniczych",
    "root_deficit": "Pomiar zapasu wody przy korzeniach potwierdza deficyt wymagający nawodnienia",
    "legal_water": "Potwierdzony legalny dostęp do wystarczającego źródła wody",
    "irrigation_planned": "Zaplanowano nawadnianie w oknie najbliższych trzech pełnych dób",
    "can_wait": "Pomiar przy korzeniach potwierdza zapas wystarczający na trzy kolejne pełne doby nawet bez deszczu",
    "rain_infiltrates": "Sprawdzono, że prognozowany deszcz może wsiąknąć i dotrzeć do korzeni",
    "sprinkler": "Zaplanowano deszczowanie",
    "cool_window": "Poranny lub wieczorny termin ma akceptowalny wiatr i ryzyko chorób",
    "small_dose": "Pomiar potwierdza niską pojemność wodną, płytkie korzenie lub przesiąkanie poniżej korzeni",
    "zone_irrigation": "Pomiary wskazują suchszy fragment pola, a instalacja pozwala nim sterować oddzielnie",
    "drip_fit": "Uprawa i warunki techniczne pozwalają na nawadnianie kropelkowe",
    "tolerant_cultivar": "Dostępna jest lokalnie sprawdzona odmiana bardziej odporna na suszę",
    "alternate_crop": "Możliwa jest mniej wodochłonna uprawa pasująca do stanowiska i mająca zapewniony zbyt",
    "sowing_fit": "Dla tej uprawy niedobory przypadają na fazę krytyczną, a warunki pozwalają zmienić termin siewu",
    "compaction_recurs": "Pomiary lub odkrywki potwierdzają powtarzające się zagęszczanie przez przejazdy",
    "low_ph": "Badanie potwierdza pH poniżej wymagań uprawy i potrzebę wapnowania",
    "terminate_cover": "Rośnie międzyplon, zapas wody maleje i zbliża się siew uprawy głównej",
    "extra_tillage": "Planowane są dodatkowe uprawki bez potwierdzonej potrzeby",
    "perennial_strip": "Na powtarzalnie erodującym fragmencie przydatność produkcyjna jest niska",
    "flow_path": "Potwierdzono skoncentrowany spływ i rozmywanie gleby w obniżeniu",
    "infiltration_site": "Jest dopływ z opadu, chłonny grunt i rozpoznano brak ryzyka zanieczyszczenia",
    "strip_fit": "Na regularnie nachylonym polu występuje erozja wodna, a płodozmian pozwala na uprawę pasową",
    "agroforestry_fit": "Występuje wieloletnia erozja; rozpoznano drzewa i rozstaw ograniczające konkurencję o wodę",
    "pond_leak": "Sztuczny zbiornik ma potwierdzone niepożądane przecieki; oceniono skutki uszczelnienia",
    "irrigation_leak": "Instalacja zużywa nietypowo dużo wody, traci ciśnienie lub ma widoczny wyciek",
    "sprinkler_uneven": "Pomiar deszczowania lub zróżnicowanie łanu wskazuje możliwy nierówny rozkład wody",
    "critical_priority": "Trwa deficyt, zapas wody jest ograniczony, a kilka upraw różni się wrażliwością w obecnych fazach",
    "density_fit": "Dla gatunku i odmiany jest uzasadniony agronomicznie zakres zmiany obsady",
    "late_drought": "Niedobory regularnie nasilają się późno w sezonie, a krótsza odmiana pasuje do stanowiska",
    "deep_roots": "Niedobory dotyczą warstwy powierzchniowej, a głębszy profil ma dostępną wodę i brak barier dla korzeni",
    "nitrogen_plan": "Deficyt już ogranicza oczekiwany plon i dostępny jest bilans składników",
    "split_n": "Warunki wodne są zmienne, a plan nawożenia i potrzeby uprawy pozwalają podzielić dawkę azotu",
    "farm_zones": "Pola gospodarstwa wyraźnie różnią się retencją i historyczną podatnością na suszę",
    "water_limited": "Zapas wody do nawadniania w gospodarstwie jest ograniczony",
    "check_water": "Zbliża się decyzja o nawadnianiu, a szacunek wilgotności lub obraz satelitarny budzi wątpliwości",
    "local_anomaly": "W tym punkcie stwierdzono spadek NDVI lub NDMI względem porównywalnej fazy; przyczyna jest nieznana",
    "soil_inconsistent": "Niepewne lub niespójne dane o glebie utrudniają ocenę deficytu",
    "infiltration_issue": "Zastoiska, spływ mimo suchej gleby lub podejrzenie zagęszczenia wymagają sprawdzenia",
    "seedbed_dry": "W warstwie siewnej brakuje wilgoci do wschodów, a termin można bezpiecznie przesunąć",
    "waterlogged": "Zastoiska lub bardzo mokra gleba grożą koleinami przy wjeździe",
    "spray_label": "Planowany oprysk przypada na temperaturę lub stres roślin poza warunkami etykiety środka",
    "fertilizer_planned": "Przed prognozowaną ulewą planowane jest nawożenie narażone na spływ lub wymywanie",
    "outlet_issue": "Po podtopieniu woda długo stoi lub istniejący odpływ może być niedrożny",
}

SIGNALS = {
    "recent_deficit": "Ujemny bilans opad − ETc w oknie 30 dni kończącym się w ostatnich maks. 10 dobach",
    "recurrent": "Niedobór prawie co roku lub co kilka lat według rolnika, albo ujemny bilans opad − ET₀ w co najmniej połowie z min. 3 sezonów, albo deficyt w co najmniej połowie sezonów w scenariuszu paszportu",
    "root_risk": "W co najmniej jednym wariancie bilansu ubytek wody przy korzeniach przekracza próg RAW",
    "available_irrigation": "Zadeklarowana możliwość nawadniania i brak deklaracji braku dostępu do wody",
    "active_crop": "Znany gatunek w aktywnej fazie wzrostu",
    "wet": "Rolnik ocenił glebę jako mokrą",
    "field_dry": "Rolnik ocenił glebę jako suchą",
    "drainage": "Zadeklarowana istniejąca melioracja lub drenaż",
    "runoff": "Rolnik obserwuje spływ często lub czasami",
    "slope": "Mediana nachylenia pola (w paszporcie średnia) z modelu wysokości wynosi co najmniej 3%",
    "ponding": "Rolnik obserwuje długie zastoiska często lub czasami",
    "point_recent_dry": "Punkt oznaczony jako przesuszenie w ostatnich 7 dobach, łącznie z dniem analizy",
    "point_ponding": "Punkt oznaczony przez rolnika jako zastoiska",
    "point_recent_ponding": "Punkt oznaczony jako zastoiska w ostatnich 3 dobach, łącznie z dniem analizy",
    "sat_anomaly": "Scena Sentinel-2 z ostatnich 14 dni ma NDVI lub NDMI niższy o co najmniej 0,10 od mediany min. 3 porównywalnych scen sezonowych (w paszporcie od średniej dla min. 3 sezonów tej uprawy i fazy)",
    "soil_missing": "Brak kompletnego modelu retencji na głębokość korzeni znanej uprawy przy sygnale deficytu",
    "water_uncertain": "Brak bilansu korzeni lub wynik względem RAW zależy od stanu początkowego",
    "evaporation": "W co najmniej jednej z kolejnych 3 pełnych dób prognozowane ET₀ wynosi co najmniej 4 mm",
    "dry_forecast": "W 3 kolejnych pełnych dobach opad ciekły brutto jest o ponad 0,1 mm niższy niż ETc",
    "rain_covers": "Przez 3 pełne doby 50% opadu ciekłego z dni o maks. prawdopodobieństwie opadu ≥70% pokrywa ETc; jeśli istnieje bilans korzeniowy, ubytek w suchszym wariancie mieści się w RAW nawet przed opadem",
    "wind": "W kolejnych 3 pełnych dobach prognozowana maksymalna prędkość wiatru na 10 m wynosi co najmniej 5 m/s",
    "heat": "W kolejnych 3 pełnych dobach prognozowana maksymalna temperatura wynosi co najmniej 30°C",
    "heavy_rain": "W kolejnych 3 pełnych dobach prognozowany jest opad co najmniej 10 mm w godzinę",
}

SOURCES = {
    "residue": ("Mitchell i in. (2012), doświadczenia z parowaniem pod okrywą pożniwną", "https://escholarship.org/uc/item/4cg3g2cf"),
    "cover": ("Nielsen i in. (2015), doświadczenia polowe nad zużyciem wody przez międzyplony", "https://doi.org/10.2134/agronj15.0186"),
    "termination": ("Mubvumba i in. (2021), dynamika wilgotności gleby pod międzyplonem", "https://www.ars.usda.gov/ARSUserFiles/60663500/Publications/Mubvumba/2021/Mubvumba%20et%20al%202021_STR_206-104823-8pgs.pdf"),
    "till": ("Pittelkow i in. (2015), metaanaliza uprawy bezorkowej, resztek i zmianowania", "https://doi.org/10.1038/nature13809"),
    "carbon": ("Rawls i in. (2003), wpływ węgla organicznego i tekstury na retencję", "https://www.sciencedirect.com/science/article/pii/S0016706103000946"),
    "ripping": ("Raper i in. (2005), głęboszowanie dopasowane do warstwy zagęszczonej", "https://www.ars.usda.gov/ARSUserFiles/60100500/csr/ResearchPubs/raper/raper_05j.pdf"),
    "compaction": ("Trautner i Arvidsson (2003), ruch maszyn przy różnych wilgotnościach gleby", "https://www.sciencedirect.com/science/article/abs/pii/S0167198703001041"),
    "weeds": ("Berger i in. (2010), konkurencja chwastów o wodę w kukurydzy", "https://www.sciencedirect.com/science/article/abs/pii/S0378429010002030"),
    "rotation": ("Bowles i in. (2020), wieloletnie doświadczenia z różnorodnością płodozmianu", "https://www.sciencedirect.com/science/article/pii/S2590332220300889"),
    "nwrm": ("Komisja Europejska (2015), dobór i projektowanie naturalnych działań retencyjnych", "https://op.europa.eu/en/publication-detail/-/publication/a6de1b15-d277-4753-bc37-3b746b09ef9f"),
    "pond": ("Badanie projektowania i bilansowania dopływu do zbiornika rolniczego (2025)", "https://www.mdpi.com/2073-4441/17/21/3034"),
    "wetlands": ("Ockenden i in. (2014), wyniki monitoringu mokradeł na polach rolnych", "https://pubmed.ncbi.nlm.nih.gov/24509365/"),
    "ditch": ("Badanie modelowe sterowanego drenażu w otwartych rowach (1990)", "https://www.sciencedirect.com/science/article/pii/037837749090013O"),
    "drain": ("Badanie reżimu wodnego drenażu swobodnego i regulowanego (2018)", "https://www.sciencedirect.com/science/article/abs/pii/S037837741831672X"),
    "drain_standard": ("USDA NRCS, praktyki projektowania i utrzymania urządzeń wodnych", "https://www.nrcs.usda.gov/sites/default/files/2024-01/587_NHCP_CPS_Structure_for_Water_Control_2023_0.pdf"),
    "windbreak": ("Doświadczenie polowe nad wiatrem i erozją w systemie rolno-leśnym (2026)", "https://doi.org/10.3390/land15030412"),
    "buffer": ("Borin i in. (2005), doświadczenie polowe z pasami buforowymi", "https://www.sciencedirect.com/science/article/pii/S016788090400177X"),
    "contour": ("USDA NRCS, warunki stosowania uprawy konturowej, praktyka 330", "https://efotg.sc.egov.usda.gov/api/CPSFile/15153/330_MD_CPS_%28Con%29tour_Farming_2018"),
    "terrace": ("Zhang i in. (2008), pomiary strat gleby i wody na tarasach", "https://doi.org/10.1007/s11629-008-0189-6"),
    "roof": ("Badanie niezawodności magazynowania deszczówki z dachów (2016)", "https://doi.org/10.1080/02626667.2015.1061195"),
    "fao56": ("Allen i in. (1998), FAO-56, rozdział 8, bilans strefy korzeniowej i próg RAW", "https://www.fao.org/4/x0490e/x0490e0e.htm"),
    "fao66": ("Steduto i in. (2012), FAO-66, odpowiedź plonu na wodę zależnie od uprawy i fazy", "https://www.fao.org/4/i2800e/i2800e.pdf"),
    "rain": ("FAO, potrzeby nawadniania i opad efektywny", "https://www.fao.org/4/s2022e/s2022e08.htm"),
    "sprinkle": ("Playán i in. (2005), pomiary strat na parowanie i znoszenie przy deszczowaniu", "https://www.sciencedirect.com/science/article/pii/S037837740500048X"),
    "uniformity": ("Doświadczenie z równomiernością deszczowania przy różnych warunkach pracy (2022)", "https://doi.org/10.3390/w14172641"),
    "irrigation_audit": ("British Columbia, Irrigation System Assessment Guide, rozdział 3", "https://www2.gov.bc.ca/assets/gov/farming-natural-resources-and-industry/agriculture-and-seafood/agricultural-land-and-environment/water/irrigation/irrigation-system-assessment-guide/chapter_03_basic_irrig_system_assessment.pdf"),
    "vri": ("Badanie dawek zmiennych na glebach o różnej retencji (2020)", "https://www.sciencedirect.com/science/article/pii/S0378377420321880"),
    "drip": ("Lamm i Trooien (2003), wieloletnie doświadczenia z nawadnianiem kroplowym", "https://doi.org/10.1007/s00271-003-0085-3"),
    "cultivar": ("Campos i in. (2004), selekcja kukurydzy pod kątem odporności na niedobór wody", "https://www.sciencedirect.com/science/article/pii/S0378429004001571"),
    "species": ("Farré i Faci (2006), porównanie reakcji sorga i kukurydzy na niedobór wody", "https://www.sciencedirect.com/science/article/abs/pii/S0378377405003598"),
    "sowing": ("Flohr i in. (2017), zależność optymalnego terminu kwitnienia pszenicy od stresu", "https://www.sciencedirect.com/science/article/pii/S0378429017306895"),
    "sensors": ("Evett i in. (2020), pomiary wilgotności przy planowaniu nawadniania", "https://www.sciencedirect.com/science/article/pii/S0378377419308170"),
    "traffic": ("Carranza i in. (2019), zależność przejezdności pola od wilgotności", "https://www.sciencedirect.com/science/article/pii/S0378377419304585"),
    "controlled_traffic": ("Doświadczenie ze stałymi ścieżkami przejazdu i strukturą gleby (2008)", "https://www.sciencedirect.com/science/article/abs/pii/S0167198708001992"),
    "bare_soil": ("Doświadczenie z wpływem uprawek na obieg wody i parowanie z odkrytej gleby (2010)", "https://www.sciencedirect.com/science/article/abs/pii/S0167198710001480"),
    "strip": ("Doświadczenie nad spływem i stratami gleby na stokach uprawianych pasowo (1983)", "https://www.sciencedirect.com/science/article/pii/S0021863483710474"),
    "seedbed": ("Doświadczenie nad potencjałem wody w glebie potrzebnym do kiełkowania pszenicy (2013)", "https://doi.org/10.2136/sssaj2012.0110"),
    "outlet": ("USDA NRCS, projektowanie i utrzymanie wylotów drenarskich, praktyka 606", "https://www.nrcs.usda.gov/sites/default/files/2022-10/Subsurface_Drain_606_NHCP_CPS_2022.pdf"),
    "lining": ("Porównanie materiałów uszczelniających zbiorniki retencyjne (2026)", "https://doi.org/10.1007/s13201-026-03023-5"),
    "ph": ("Tang i in. (2003), doświadczenie z wapnowaniem gleby kwaśnej w uprawie zbóż", "https://research-repository.uwa.edu.au/en/publications/responses-of-wheat-and-barley-to-liming-on-a-sandy-soil-with-subs/"),
    "prairie": ("Schulte i in. (2017), doświadczenie ze stałą okrywą na części pól", "https://doi.org/10.1073/pnas.1620229114"),
    "waterway": ("Fiener i Auerswald (2003), pomiary działania zadarnionej drogi spływu", "https://doi.org/10.1111/j.1475-2743.2003.tb00281.x"),
    "infiltration": ("Monitoring jakości wód pod niecką infiltracyjną (2004)", "https://pubmed.ncbi.nlm.nih.gov/15262168/"),
    "agroforestry": ("Doświadczenie w klimacie umiarkowanym nad konkurencją drzew i uprawy o wodę (2026)", "https://doi.org/10.1016/j.agwat.2025.109782"),
    "seepage": ("FAO, rozpoznawanie i ograniczanie strat wody ze zbiorników", "https://www.fao.org/fishery/docs/CDrom/FAO_Training/FAO_Training/General/x6709e/x6709e03.htm"),
    "allocate": ("Martin i in. (1988), harmonogram nawadniania przy ograniczonej podaży wody", "https://www.sciencedirect.com/science/article/pii/0378377488901096"),
    "density": ("Lyon i in. (2003), doświadczenia z obsadą kukurydzy w uprawie bez nawadniania", "https://digitalcommons.unl.edu/panhandleresext/9/"),
    "roots": ("Kirkegaard i in. (2007), pomiary wykorzystania wody z podglebia przez pszenicę", "https://doi.org/10.1071/AR06285"),
    "nitrogen": ("Kim i in. (2008), doświadczenia nad poborem azotu w zależności od dostępności wody", "https://doi.org/10.2134/agronj2007.0064"),
    "split": ("Clark i in. (2020), wpływ gleby i pogody na skuteczność dzielenia nawożenia azotem", "https://doi.org/10.1002/agj2.20446"),
    "spectral": ("Gao (1996), czułość wskaźnika NIR–SWIR na wodę w roślinności", "https://doi.org/10.1016/S0034-4257(96)00067-3"),
    "s2_validation": ("Badanie terenowe kondycji kukurydzy w warunkach suszy na podstawie Sentinel-2 (2023)", "https://doi.org/10.3390/rs15051281"),
    "texture": ("Saxton i Rawls (2006), zależność retencji od tekstury i materii organicznej", "https://doi.org/10.2136/sssaj2005.0117"),
    "spray": ("Doświadczenie nad wpływem temperatury na działanie glifosatu (2022)", "https://pmc.ncbi.nlm.nih.gov/articles/PMC9737009/"),
    "fertilizer": ("Kleinman i Sharpley (2003), pomiary strat fosforu w kolejnych zdarzeniach opadowych", "https://pubmed.ncbi.nlm.nih.gov/12809308/"),
    "drought": ("Doroszewski i in. (2012), podstawy monitoringu suszy rolniczej w Polsce", "https://www.itp.edu.pl/old/wydawnictwo/woda/zeszyt_38_2012/artykuly/Doroszewski%20i%20in.pdf"),
}

# ID z arkusza: zasięg, alternatywy (w każdej wymagane są wszystkie przesłanki), źródła, uzasadnienie.
RULES = {
    1: ("field", "harvested field_dry | harvested recent_deficit | harvested recurrent", "residue drought", "Resztki osłaniają odkrytą glebę i ograniczają parowanie, gdy zapas wody łatwo się wyczerpuje."),
    2: ("field", "cover_sowing recurrent", "cover drought", "Żywa okrywa chroni glebę, ale zużywa wodę. Wilgoć do wschodów i właściwy termin są potrzebne, żeby okrywa się przyjęła."),
    3: ("both", "mulch_fit evaporation", "residue fao56", "Osłona ogranicza parowanie z odkrytej gleby przy dużym zapotrzebowaniu atmosfery na wodę."),
    4: ("field", "less_tillage recurrent", "till drought", "Ograniczenie orki może pomagać w suchych warunkach, jeżeli pasuje do uprawy i towarzyszy mu okrywa gleby."),
    5: ("field", "no_till_fit recurrent", "till drought", "Korzyści bezorkowej uprawy w warunkach suchych zależą od okrywy i zmianowania."),
    6: ("both", "low_soc", "carbon texture", "Wpływ materii organicznej na retencję zależy od tekstury. Wynik badania pomaga rozpoznać stanowiska wymagające poprawy."),
    7: ("both", "compact_dry", "ripping compaction", "Głęboszowanie jest celowe tam, gdzie narzędzie rozluźni rozpoznaną warstwę, a wilgotność pozwala na jej kruszenie."),
    8: ("both", "wet | compaction_risk | point_recent_ponding | waterlogged", "compaction traffic", "Wilgotna gleba ma mniejszą nośność, a ciężkie przejazdy mogą trwale zagęścić profil."),
    9: ("both", "weeds active_crop recent_deficit | weeds active_crop root_risk", "weeds fao56", "Przy niedoborze wody zachwaszczenie może zwiększać pobór wody ze strefy korzeni."),
    10: ("field", "rotation_issue | recurrent", "rotation drought", "Doświadczenia wieloletnie wskazują, że zróżnicowanie zmianowania może stabilizować plon w trudnych sezonach."),
    11: ("point", "reservoir_site", "pond nwrm", "Możliwość magazynowania zależy od ukształtowania terenu, bilansu dopływu i warunków lokalnych."),
    12: ("point", "pond_site", "wetlands nwrm", "Małe zbiorniki przechwytują wodę i osad. Wybór miejsca zależy od dawnej lub obecnej hydrologii oraz oceny przyrodniczej."),
    13: ("point", "ditch_control", "ditch drain_standard", "Piętrzenie zmienia poziom wody w rowie i jego otoczeniu, dlatego potrzebna jest ocena odpływu i ryzyka zalania."),
    14: ("point", "windbreak_site", "windbreak nwrm", "Pasy drzew i krzewów spowalniają wiatr i ograniczają transport cząstek gleby na terenach odsłoniętych."),
    15: ("both", "buffer_site | runoff", "buffer nwrm", "Trawa przechwytuje osad i spowalnia rozproszony spływ przed dopływem do wody."),
    16: ("field", "contour_safe runoff | contour_safe slope", "contour terrace", "Prowadzenie rzędów wzdłuż warstwic ogranicza spływ w dół stoku, o ile nachylenie i warunki pozwalają bezpiecznie pracować."),
    17: ("point", "terrace_site", "terrace nwrm", "Tarasy skracają drogę spływu na stromym stoku. Projekt musi uwzględnić stabilność i odprowadzanie wody."),
    18: ("field", "roof_site", "roof", "Potencjał wykorzystania opadu z dachu zależy od powierzchni zlewni, pojemności magazynu i potrzeb odbiorcy."),
    19: ("field", "drain_control drainage", "drain drain_standard", "Sterowany odpływ pozwala zatrzymywać wodę w okresie niedoboru i odprowadzać jej nadmiar w innym terminie."),
    20: ("both", "wetland", "wetlands nwrm", "Mokradła i okresowo zalewane obniżenia spowalniają odpływ. Zastoiska wymagają rozpoznania charakteru siedliska."),
    21: ("field", "active_crop root_deficit dry_forecast legal_water available_irrigation", "fao56 rain", "Decyzja wymaga potwierdzonego ubytku przy korzeniach i sprawdzenia, czy deszcz może pokryć zapotrzebowanie."),
    22: ("field", "active_crop irrigation_planned available_irrigation can_wait rain_infiltrates rain_covers", "fao56 rain", "Nawadnianie można odłożyć, gdy zapas pokryje potrzeby do nadejścia deszczu i opad efektywny uzupełni zużycie."),
    23: ("field", "sprinkler available_irrigation evaporation cool_window", "sprinkle fao56", "Straty przy deszczowaniu zależą od pory doby i wiatru. Wilgotny łan może zwiększać ryzyko chorób."),
    24: ("field", "irrigation_planned available_irrigation small_dose", "fao56 texture", "Mały zapas dostępny przy korzeniach zwiększa ryzyko odpływu dużej jednorazowej dawki w głąb profilu."),
    25: ("point", "zone_irrigation legal_water available_irrigation active_crop dry_forecast", "vri fao56", "Zróżnicowanie zapasu wody uzasadnia sterowanie dawką po pomiarze w danej strefie."),
    26: ("field", "drip_fit legal_water recurrent", "drip drought", "Aplikacja wody w pobliżu korzeni bywa wydajniejsza przy powtarzających się niedoborach i odpowiedniej technologii."),
    27: ("field", "tolerant_cultivar recurrent", "cultivar drought", "Różnice między odmianami ujawniają się w doświadczeniach prowadzonych przy niedoborach wody."),
    28: ("field", "alternate_crop recurrent", "species fao66", "Gatunki różnie reagują na ten sam deficyt. Zmiana ma sens po dopasowaniu do gleby, klimatu i zbytu."),
    29: ("field", "sowing_fit recurrent", "sowing fao66", "Zmiana siewu przesuwa fazę krytyczną względem okresów suszy, z uwzględnieniem ryzyka innych stresów."),
    30: ("both", "active_crop root_risk | active_crop recurrent water_uncertain | zone_irrigation", "sensors fao56", "Pomiary w strefie korzeni pomagają śledzić zapas wody i sprawdzić niepewny lub zróżnicowany wynik modelu."),
    31: ("field", "compaction_recurs", "compaction controlled_traffic", "Skupienie ruchu na tych samych ścieżkach ogranicza powierzchnię narażoną na powtarzające się ugniatanie."),
    32: ("both", "low_ph", "ph", "Kwaśna gleba może ograniczać korzenienie. Właściwy cel pH i dawkę określa wynik badania dla stanowiska i uprawy."),
    33: ("field", "terminate_cover", "cover termination", "Rosnący międzyplon zużywa wodę. Termin zakończenia wpływa na zapas przy siewie następnej uprawy."),
    34: ("field", "extra_tillage field_dry | extra_tillage recent_deficit | extra_tillage root_risk", "residue bare_soil", "Zachowanie okrywy i ograniczenie przemieszania suchej gleby może ograniczać straty wody przez parowanie."),
    35: ("point", "perennial_strip", "prairie", "Trwała okrywa na podatnych fragmentach zatrzymuje osad i część wody spływającej z pola."),
    36: ("point", "flow_path", "waterway", "Zadarniony szlak ogranicza rozmywanie gleby w miejscu skoncentrowanego przepływu."),
    37: ("point", "infiltration_site", "infiltration nwrm", "Efekt zależy od infiltracji i jakości dopływu, ponieważ rozpuszczone substancje mogą docierać do wód gruntowych."),
    38: ("field", "strip_fit", "contour strip", "Naprzemienne pasy wzdłuż warstwic przerywają drogę spływu dzięki różnej osłonie gleby."),
    39: ("both", "agroforestry_fit recurrent", "agroforestry terrace", "Drzewa mogą ograniczać erozję i parowanie, ale skala konkurencji korzeniowej zależy od gatunku i rozstawu."),
    40: ("point", "pond_leak", "seepage lining", "Uszczelnienie ma sens, gdy straty wynikają z niepożądanego przesiąkania, po uwzględnieniu roli infiltracji w otoczeniu."),
    41: ("field", "irrigation_leak", "irrigation_audit uniformity", "Pomiary ciśnienia i przepływu pomagają wykryć straty wody i odróżnić je od innych usterek instalacji."),
    42: ("field", "sprinkler_uneven", "uniformity irrigation_audit", "Test z pojemnikami pozwala odróżnić wpływ dysz, ciśnienia i wiatru od glebowych przyczyn różnic w łanie."),
    43: ("field", "critical_priority", "allocate fao66", "Przy małym zapasie większy efekt daje podanie wody uprawie, której plon jest obecnie najbardziej wrażliwy."),
    44: ("field", "sprinkler available_irrigation wind can_wait", "sprinkle fao56", "Wiatr zwiększa znoszenie i nierównomierność, ale odłożenie deszczowania zależy od aktualnego zapasu wody."),
    45: ("field", "density_fit recurrent", "density fao66", "Optymalna obsada zmienia się wraz z dostępną wodą i reakcją gatunku lub odmiany."),
    46: ("field", "late_drought", "sowing fao66", "Wcześniej dojrzewająca odmiana może minąć powtarzalny okres późnego niedoboru, jeśli pasuje do całego sezonu."),
    47: ("field", "deep_roots recurrent", "roots texture", "Głębsze ukorzenienie daje korzyść, gdy profil pozwala korzeniom dotrzeć do wilgotnego podglebia."),
    48: ("field", "nitrogen_plan", "nitrogen fao66", "Niedobór wody może ograniczać plon i pobieranie azotu. Korekta potrzebuje bilansu składników dla realnego plonu."),
    49: ("field", "split_n", "split nitrogen", "Przewaga dzielonych dawek zależy od tekstury, rozkładu opadów i pobrania azotu przez uprawę."),
    50: ("field", "farm_zones", "vri texture fao66", "Różnice retencji i reakcji gatunków na niedobór uzasadniają dopasowanie rozmieszczenia upraw do stanowiska."),
    51: ("field", "water_limited recurrent", "allocate drought", "Harmonogram wykorzystania skończonego zapasu powinien uwzględniać zapotrzebowanie w kolejnych fazach sezonu."),
    52: ("both", "check_water | active_crop root_risk | active_crop recent_deficit water_uncertain | active_crop available_irrigation water_uncertain | active_crop available_irrigation point_recent_dry", "fao56 sensors", "Pomiar na głębokości korzeni sprawdza, czy model lub sygnał z powierzchni oddaje zapas dostępny roślinom."),
    53: ("both", "sat_anomaly | local_anomaly", "spectral s2_validation", "Wskaźniki spektralne pomagają wskazać anomalię. Lustracja odróżnia niedobór wody od innych przyczyn słabej kondycji."),
    54: ("both", "soil_inconsistent | soil_missing", "texture", "Zmierzone uziarnienie i retencja zmniejszają niepewność szacunku zapasu dostępnego dla roślin."),
    55: ("both", "infiltration_issue | ponding | point_ponding", "compaction texture ripping", "Porównanie infiltracji i zagęszczenia pomaga ustalić przyczynę zastoisk lub spływu."),
    56: ("field", "seedbed_dry", "seedbed sowing", "Wilgoć warstwy siewnej warunkuje wschody, a opóźnienie zmienia warunki dalszego wzrostu."),
    57: ("both", "waterlogged | wet | point_recent_ponding", "traffic compaction", "Po nadmiernym uwilgotnieniu rośnie ryzyko kolein i zagęszczania do czasu odzyskania nośności."),
    58: ("field", "spray_label heat", "spray", "Wpływ temperatury na działanie środka zależy od substancji, rośliny i warunków. O terminie decyduje etykieta konkretnego środka."),
    59: ("field", "fertilizer_planned heavy_rain", "fertilizer split", "Silny opad po aplikacji może przenosić składniki poza strefę wykorzystania. Znaczenie ma czas między aplikacją a opadem."),
    60: ("both", "outlet_issue | drainage ponding", "drain outlet", "Długie zastoiska przy istniejącym odwodnieniu uzasadniają oględziny drożności i konsultację z zarządcą."),
}

with (Path(__file__).resolve().parents[2] / "docs/baza_60_rekomendacji_KOWR.csv").open(encoding="utf-8-sig", newline="") as file:
    ACTIONS = {int(row["id"]): row for row in DictReader(file, delimiter=";")}

LABELS = OBSERVATIONS | SIGNALS
REGIONAL_SIGNALS = {"recent_deficit", "recurrent", "active_crop", "available_irrigation", "evaporation", "dry_forecast"}
POINT_ONLY = {"point_recent_dry", "point_ponding", "point_recent_ponding", "zone_irrigation", "local_anomaly"}
TRIGGERS = {
    key: {
        location: [alternative.split() for alternative in expression.split(" | ")
                   if (location == "point" and set(alternative.split()) <= OBSERVATIONS.keys() | REGIONAL_SIGNALS | POINT_ONLY)
                   or (location == "field" and not POINT_ONLY.intersection(alternative.split()))]
        for location in ("field", "point") if scope in (location, "both")
    }
    for key, (scope, expression, _, _) in RULES.items()
}
WET_FIELD_EXCLUSIONS = (21, 23, 24, 44)


def catalog():
    return [
        {"id": key, "title": row["dzialanie"], "group": row["kategoria"], "when": row["termin_realizacji"],
         "cost": row["koszt"], "cost_details": row["skladniki_kosztu"], "conditions": row["warunki_rekomendacji"],
         "triggers": {location: [[LABELS[fact] for fact in alternative] for alternative in alternatives]
                      for location, alternatives in TRIGGERS[key].items() if alternatives},
         "sources": references(key), "why": RULES[key][3],
         "exclusion": ("Zaobserwowana mokra gleba lub zastoiska na polu wstrzymują tę sugestię."
                       if key in WET_FIELD_EXCLUSIONS else
                       "Zastoiska w tym punkcie w ostatnich trzech dobach lub ryzyko kolein wstrzymują tę sugestię."
                       if key == 25 else None)}
        for key, row in ACTIONS.items()
    ]


def references(key):
    return [{"title": SOURCES[source][0], "url": SOURCES[source][1]} for source in RULES[key][2].split()]


def observation_options(local=False):
    location = "point" if local else "field"
    keys = {fact for rule in TRIGGERS.values() for alternative in rule.get(location, ()) for fact in alternative}
    return [{"key": key, "label": label} for key, label in OBSERVATIONS.items() if key in keys and (not local or key != "legal_water")]
