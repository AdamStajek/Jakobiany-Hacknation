"""KOWR action catalogue and the evidence required by each rule."""

from csv import DictReader
from pathlib import Path

from wodo.recommendation_costs import cost_estimate
from wodo.recommendation_descriptions import DESCRIPTIONS

# Keys shared by the rules, the optional farmer checklist and report evidence.
OBSERVATIONS = {
    "harvested": "Zbiory się skończyły, a na odkrytej ziemi zostały zdrowe resztki roślin",
    "cover_sowing": "Ziemia między uprawami jest odkryta i jest dość wilgoci oraz czasu, by wysiane rośliny zdążyły wzejść",
    "mulch_fit": "Ziemia jest odkryta i można ją przykryć materiałem pasującym do uprawy, np. słomą",
    "less_tillage": "Warunki na polu pozwalają ograniczyć orkę przed siewem",
    "no_till_fit": ("Rodzaj gleby, osłona ziemi i kolejność upraw pozwalają zrezygnować z orki "
                    "lub przygotować ziemię tylko w pasach pod siew"),
    "low_soc": "Badanie gleby i zalecenie specjalisty potwierdzają, że gleba potrzebuje więcej materii organicznej, np. kompostu",
    "compact_dry": "Po zbiorach potwierdzono, że pod powierzchnią jest ubita warstwa ziemi i jest na tyle sucha, że można ją rozluźnić",
    "compaction_risk": "Koła łatwo ubijają tę ziemię, a na polu zaplanowano przejazdy ciężkimi maszynami",
    "weeds": "Wśród rosnącej uprawy widać chwasty, które konkurują z nią o wodę",
    "rotation_issue": "Na polu stale uprawia się ten sam gatunek albo pogarsza się struktura ziemi, np. ziemia tworzy twarde bryły",
    "reservoir_site": "Jest zagłębienie, do którego dopływa woda. Sprawdzono, że można tam zbudować zbiornik i spełnić formalności",
    "pond_site": "Było tu oczko wodne lub teren się do tego nadaje, a ocena przyrodnicza i sprawdzenie formalności pozwalają je odtworzyć",
    "ditch_site": "W tym miejscu regularnie stoi woda. Specjalista potwierdził potrzebę nowego rowu i wskazał możliwy odbiornik wody",
    "ditch_control": "Rów odprowadza za dużo wody. Zarządca zgodził się na regulację odpływu i sprawdzono ryzyko podtopień",
    "windbreak_site": "Na otwartym polu silny wiatr często wywiewa ziemię. Wybrano miejsce oraz odpowiednie drzewa lub krzewy",
    "buffer_site": "Widać, że woda płynie po powierzchni ziemi, lub pole bezpośrednio przylega do rowu lub strumienia",
    "contour_safe": "Pole leży na zboczu i potwierdzono, że maszyny mogą bezpiecznie pracować w poprzek spadku",
    "terrace_site": "Specjalista potwierdził, że zbocze jest strome, ziemia się wymywa i można tam wykonać tarasy",
    "roof_site": "Jest dostępny dach, miejsce na zbiornik i sposób na późniejsze wykorzystanie deszczówki",
    "drain_control": "Na polu czasem brakuje wody, a czasem jest jej za dużo. Istniejące rury odwadniające pozwalają regulować odpływ",
    "wetland": "Na miejscu potwierdzono mokradło lub część terenu, która okresowo jest pod wodą i ma wartość dla przyrody",
    "root_deficit": "Pomiar na głębokości korzeni pokazuje, że roślinom brakuje wody i trzeba je podlać",
    "legal_water": "Jest źródło, z którego można zgodnie z prawem pobrać wystarczającą ilość wody",
    "irrigation_planned": "Podlewanie zaplanowano w ciągu trzech pełnych dni po dniu analizy",
    "can_wait": "Pomiar pokazuje, że wody przy korzeniach wystarczy na trzy pełne dni po dniu analizy, nawet bez deszczu",
    "rain_infiltrates": "Sprawdzono, że zapowiadany deszcz może wsiąknąć do głębokości, na której są korzenie",
    "sprinkler": "Zaplanowano podlewanie zraszaczami",
    "cool_window": "Rano lub wieczorem wiatr pozwala na użycie zraszaczy, a ryzyko chorób roślin jest akceptowalne",
    "small_dose": "Pomiar potwierdza, że ziemia zatrzymuje mało wody, korzenie są płytkie lub woda przesiąka poniżej korzeni",
    "zone_irrigation": "Pomiary wskazują suchszy fragment pola, a instalacja pozwala podlewać go osobno",
    "drip_fit": "Rodzaj uprawy i dostępny sprzęt pozwalają podawać wodę kroplami przy korzeniach",
    "tolerant_cultivar": "Dostępna jest odmiana, która w miejscowych próbach lepiej znosiła suszę",
    "alternate_crop": "Można wybrać roślinę, która potrzebuje mniej wody, pasuje do pola i ma zapewnionego odbiorcę po zbiorze",
    "sowing_fit": "Wody brakuje wtedy, gdy uprawa jest na to najbardziej wrażliwa, a warunki pozwalają przesunąć siew",
    "compaction_recurs": "Pomiar lub zajrzenie pod powierzchnię ziemi potwierdza, że przejazdy maszyn regularnie ją ubijają",
    "low_ph": "Badanie wykazało, że gleba jest za kwaśna dla uprawy i potrzebuje wapnowania",
    "terminate_cover": "Rosną rośliny wysiane między głównymi uprawami, ziemia wysycha i zbliża się kolejny siew",
    "extra_tillage": "Zaplanowano dodatkowe prace przy glebie, choć ich potrzeby jeszcze nie potwierdzono",
    "perennial_strip": "Na części pola uprawa słabo się udaje, a woda lub wiatr regularnie zabiera wierzchnią warstwę ziemi",
    "flow_path": "Sprawdzono, że woda zbiera się w obniżeniu i płynie jednym szlakiem, wymywając tam ziemię",
    "infiltration_site": "Dopływa tu deszczówka, grunt ją chłonie i sprawdzono, że wsiąkanie nie grozi zanieczyszczeniem",
    "strip_fit": "Deszcz wymywa ziemię z równomiernie nachylonego pola, a kolejność upraw pozwala siać rośliny w naprzemiennych pasach",
    "agroforestry_fit": "Ziemia jest wymywana lub wywiewana od lat. Dobrano drzewa i odstępy, by ograniczyć ich konkurencję o wodę z uprawą",
    "pond_leak": "Potwierdzono, że sztuczny zbiornik traci wodę przez przecieki. Sprawdzono skutki uszczelnienia dla otoczenia",
    "irrigation_leak": "Instalacja zużywa więcej wody niż zwykle, traci ciśnienie lub widać wyciek",
    "sprinkler_uneven": "Pomiary lub różnice w wyglądzie roślin sugerują, że zraszacze mogą nierówno rozprowadzać wodę",
    "critical_priority": "Brakuje wody, zapas do podlewania jest ograniczony i niektóre uprawy są teraz wrażliwsze na suszę niż inne",
    "density_fit": "Dla danej rośliny i odmiany ustalono, o ile można zmienić liczbę roślin na metr kwadratowy",
    "late_drought": "Wody regularnie brakuje pod koniec sezonu, a odmiana dojrzewająca wcześniej pasuje do warunków pola",
    "deep_roots": "Ziemia przy powierzchni wysycha, ale głębiej jest dostępna woda i korzenie mogą do niej dotrzeć",
    "nitrogen_plan": "Brak wody już obniża spodziewane zbiory i wiadomo, ile składników odżywczych jest dostępnych dla uprawy",
    "split_n": "Ilość dostępnej wody się zmienia, a plan nawożenia i potrzeby roślin pozwalają podawać azot w kilku porcjach",
    "farm_zones": "Pola gospodarstwa wyraźnie różnią się tym, ile wody zatrzymują i jak często dotykała je susza",
    "water_limited": "W gospodarstwie jest ograniczony zapas wody do podlewania",
    "check_water": "Trzeba niedługo zdecydować o podlewaniu, a szacunek wilgotności lub zdjęcie satelitarne budzi wątpliwości",
    "local_anomaly": ("W tym miejscu wskaźnik zieleni roślin (NDVI) lub ich uwodnienia (NDMI) spadł względem porównania "
                      "z podobnego etapu wzrostu. Przyczyna jest jeszcze nieznana"),
    "soil_inconsistent": "Dane o glebie są niepewne lub się różnią, więc trudno ocenić, ile wody brakuje roślinom",
    "infiltration_issue": "Woda stoi lub spływa mimo suchej ziemi albo są oznaki, że pod powierzchnią jest ubita warstwa",
    "seedbed_dry": "Ziemia na głębokości siewu jest za sucha, by nasiona wykiełkowały, a siew można bezpiecznie opóźnić",
    "waterlogged": "Na polu stoi woda lub ziemia jest tak mokra, że wjazd grozi koleinami",
    "spray_label": "Temperatura lub stan roślin w planowanym terminie oprysku nie spełniają zaleceń z etykiety środka",
    "fertilizer_planned": "Nawożenie zaplanowano przed ulewą, która może zmyć nawóz z pola lub wymyć go poniżej korzeni",
    "outlet_issue": "Po podtopieniu woda długo stoi lub coś może blokować istniejący odpływ",
}

SIGNALS = {
    "recent_deficit": ("W ciągu 30 dni spadło mniej deszczu, niż według obliczeń potrzebowała uprawa na tym etapie wzrostu. "
                       "Koniec tego okresu przypada najwyżej 10 dni przed dniem analizy"),
    "recurrent": ("Rolnik zgłasza niedobory wody prawie co roku lub co kilka lat. Aplikacja może też porównać co najmniej "
                  "trzy sezony i sprawdzić, czy w połowie z nich lub częściej opad był niższy od wzorcowego zapotrzebowania "
                  "na wodę obliczonego z danych pogodowych (ET₀). Warunek spełnia też wynik paszportu pola, jeśli wykazuje "
                  "niedobór w co najmniej połowie sprawdzonych sezonów"),
    "root_risk": ("W co najmniej jednym wariancie obliczeń ubyło więcej wody przy korzeniach, "
                  "niż rośliny mogą pobrać bez odczuwania niedoboru. Ten próg nazywa się RAW"),
    "available_irrigation": "Rolnik podał, że może podlewać pole, i nie zgłosił braku dostępu do wody",
    "active_crop": "Wiadomo, jaka roślina jest uprawiana, a termin analizy przypada w czasie jej wzrostu",
    "wet": "Rolnik ocenił ziemię jako mokrą",
    "field_dry": "Rolnik ocenił ziemię jako suchą",
    "drainage": "Rolnik zgłosił, że na całym polu lub jego części są urządzenia odprowadzające wodę, np. rowy lub rury pod ziemią",
    "runoff": "Rolnik czasami lub często widzi, że woda spływa po powierzchni pola",
    "slope": ("Według mapy wysokości nachylenie pola wynosi co najmniej 3%, czyli 3 m różnicy wysokości na 100 m w poziomie. "
              "W analizie używamy środkowej wartości pomiarów, a w paszporcie pola średniej"),
    "ponding": "Rolnik czasami lub często widzi miejsca, w których woda długo stoi",
    "point_recent_dry": "To miejsce oznaczono jako przesuszone w dniu analizy lub w ciągu 6 poprzednich dni",
    "point_ponding": "Rolnik oznaczył to miejsce jako takie, w którym stoi woda",
    "point_recent_ponding": "To miejsce oznaczono jako zalane stojącą wodą w dniu analizy lub w ciągu 2 poprzednich dni",
    "sat_anomaly": ("Na zdjęciu satelitarnym Sentinel-2 z dnia analizy lub do 14 dni wcześniej wskaźnik zieleni roślin (NDVI) "
                    "lub ich uwodnienia (NDMI) jest niższy o co najmniej 0,10 punktu. Punktem odniesienia jest środkowa wartość "
                    "z co najmniej 3 porównywalnych zdjęć. W paszporcie pola porównujemy do średniej z co najmniej 3 sezonów "
                    "tej samej uprawy na podobnym etapie wzrostu"),
    "soil_missing": ("Wiadomo, jaka roślina rośnie, a ostatnie obliczenia wskazują niedobór wody. Brakuje jednak pełnych danych "
                     "o tym, ile wody gleba zatrzymuje na głębokości korzeni"),
    "water_uncertain": ("Nie da się obliczyć zapasu wody przy korzeniach lub ocena, czy roślinom brakuje wody, "
                        "zależy od tego, jak mokra była ziemia na początku obliczeń"),
    "evaporation": ("W co najmniej jednym z trzech pełnych dni po dniu analizy prognoza wskazuje utratę co najmniej 4 mm wody "
                    "na dobę przez parowanie z ziemi i rośliny wzorcowej (ET₀)"),
    "dry_forecast": ("Aplikacja porównuje deszcz prognozowany na trzy pełne dni po dniu analizy z ilością wody, "
                     "której uprawa potrzebuje na obecnym etapie wzrostu. Warunek jest spełniony, gdy zabraknie więcej niż 0,1 mm"),
    "rain_covers": ("W prognozie na trzy pełne dni po dniu analizy liczymy połowę deszczu z dni, w których prognozowana "
                    "szansa opadu sięga co najmniej 70%. Suma musi być większa od zera i wystarczyć na potrzeby uprawy. Jeśli da się obliczyć "
                    "zapas przy korzeniach, również w suchszym wariancie ziemia musi mieć dość łatwo dostępnej wody "
                    "dla roślin przed deszczem każdego dnia"),
    "wind": "W co najmniej jednym z trzech pełnych dni po dniu analizy wiatr na wysokości 10 m ma osiągnąć co najmniej 5 m/s",
    "heat": "W co najmniej jednym z trzech pełnych dni po dniu analizy temperatura ma osiągnąć co najmniej 30°C",
    "heavy_rain": "W ciągu trzech pełnych dni po dniu analizy ma wystąpić ulewa z opadem co najmniej 10 mm w godzinę",
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
    "melioration": ("Wody Polskie, melioracje wodne", "https://www.wody.gov.pl/images/Melioracje/melioracje_wodne-A5-4_kwietnia_2022.pdf"),
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
    61: ("point", "ditch_site", "melioration ditch", "Rów może odprowadzić nadmiar wody z podtapianego miejsca. Projekt powinien ograniczyć przesuszenie pola i ryzyko podtopień poniżej odpływu."),
}

with (Path(__file__).resolve().parent / "catalogs/baza_60_rekomendacji_KOWR.csv").open(encoding="utf-8-sig", newline="") as file:
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


# Opis dodatkowej powierzchni wyłączanej z uprawy po wdrożeniu działania.
AREA_IMPACT = {
    11: "Odejmij obrys zbiornika wraz ze skarpami i pasem obsługi na dotychczas uprawianym gruncie.",
    12: "Odejmij część obrysu odtwarzanego oczka i jego pasa obsługi, która jest obecnie uprawiana.",
    13: "Zastawkę montuje się w istniejącym rowie. Odejmij tylko nowy pas obsługi, jeśli zajmie uprawiany grunt.",
    14: "Odejmij powierzchnię pasa nasadzeń w obrębie uprawy. Przy stałej szerokości pomnóż długość pasa przez szerokość.",
    15: "Odejmij powierzchnię nowego pasa trawy na uprawianym gruncie. Przy stałej szerokości pomnóż długość pasa przez szerokość.",
    17: "Odejmij powierzchnię nowych skarp i dojazdów wyłączonych z uprawy. Powierzchnie uprawne tarasów pozostają w bilansie.",
    18: "Jeśli zbiornik stanie na uprawianym gruncie, odejmij jego obrys wraz z wydzielonym miejscem obsługi.",
    19: "Odejmij powierzchnię nowych elementów nadziemnych i stałego dostępu, jeśli wyłączą grunt z uprawy.",
    20: "Ubytek obejmuje tylko część mokradła lub jego otoczenia, która jest dziś uprawiana i ma zostać wyłączona z uprawy.",
    26: "Odejmij miejsce zajęte przez nowe stałe elementy instalacji, jeżeli zostaną ustawione na uprawianej części pola.",
    30: "Odejmij powierzchnię trwale wyłączoną z uprawy wokół stacji pomiarowej, jeśli jej montaż tego wymaga.",
    31: "Jeśli stałe ścieżki pozostają bez zasiewu, odejmij powierzchnię tylko nowo wyłączonych pasów.",
    35: "Odejmij obrys uprawianego fragmentu przeznaczonego pod trwałą okrywę.",
    36: "Odejmij część zadarnionej drogi spływu, która zajmie uprawiany grunt. Przy stałej szerokości pomnóż długość przez szerokość.",
    37: "Odejmij obrys niecki wraz ze skarpami i pasem obsługi na dotychczas uprawianym gruncie.",
    39: "Odejmij powierzchnię pasów drzew wyłączonych z uprawy. Uprawiane przestrzenie między pasami pozostają w bilansie.",
    40: "Odejmij tylko ewentualne rozszerzenie istniejącego obiektu lub pasa obsługi na uprawiany grunt.",
    61: "Odejmij powierzchnię rowu ze skarpami i pasem obsługi na uprawianym gruncie. Przy stałej szerokości pomnóż długość odcinka przez łączną szerokość. Pozostała powierzchnia to dotychczasowy areał pomniejszony o ten ubytek.",
}


def area_impact(key):
    return AREA_IMPACT.get(key, "0 m² bezpośredniego ubytku. Samo działanie nie wyłącza gruntu z uprawy.")


def catalog():
    return [
        {"id": key, "title": row["dzialanie"], "group": row["kategoria"], "when": row["termin_realizacji"],
         "cost": row["koszt"], "cost_details": row["skladniki_kosztu"], "conditions": row["warunki_rekomendacji"],
         "description": DESCRIPTIONS[key], "cost_estimate": cost_estimate(key), "area_impact": area_impact(key),
         "triggers": {location: [[LABELS[fact] for fact in alternative] for alternative in alternatives]
                      for location, alternatives in TRIGGERS[key].items() if alternatives},
         "sources": references(key), "why": RULES[key][3],
         "exclusion": ("Aplikacja pomija tę podpowiedź, gdy rolnik zgłosił mokrą ziemię, stojącą wodę lub ryzyko kolein z powodu wilgoci."
                       if key in WET_FIELD_EXCLUSIONS else
                       "Aplikacja pomija podpowiedź dla tego miejsca, jeśli zgłoszono tam stojącą wodę w dniu analizy lub w dwóch poprzednich dniach albo ryzyko kolein z powodu wilgoci."
                       if key == 25 else None)}
        for key, row in ACTIONS.items()
    ]


def references(key):
    return [{"title": SOURCES[source][0], "url": SOURCES[source][1]} for source in RULES[key][2].split()]


def observation_options(local=False):
    location = "point" if local else "field"
    keys = {fact for rule in TRIGGERS.values() for alternative in rule.get(location, ()) for fact in alternative}
    return [{"key": key, "label": label} for key, label in OBSERVATIONS.items() if key in keys and (not local or key != "legal_water")]
