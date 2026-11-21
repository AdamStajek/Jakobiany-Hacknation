# TODO — powiadomienia

Pierwsza wersja używa tylko sygnałów, które analiza już liczy (lista w sekcji 3.4 planu pulpitu). Tu zbieramy to, czego brakuje albo co warto dodać potem.

## Brakujące sygnały (wymagają nowych danych lub obliczeń)

- [ ] **Prognoza opadu** — „zapowiadany deszcz” jest w opisie metody, ale backend nie ma prognozy; powiadomienie „nie podlewaj, jutro opad” i „brak opadu w tygodniu” bez niej nie ruszy. Dane/źródło: darmowa prognoza (do wyboru: Open-Meteo, IMGW). Priorytet: P1. Właściciel: —.
- [ ] **Ostrzeżenia przymrozkowe i upały** — `T2M_MIN`/`T2M_MAX` są już pobierane z NASA POWER dla historii, ale nie są używane do alertów. Potrzebna prognoza temperatur i progi per uprawa i faza. Priorytet: P1. Właściciel: —.
- [ ] **Ostrzeżenia hydrologiczne i meteorologiczne IMGW** — wodowskaz jest tylko informacją w raporcie; ostrzeżenia IMGW (susza hydrologiczna, burze, ulewy) mogłyby być osobną kategorią. Priorytet: P2. Właściciel: —.
- [ ] **Wskaźnik suszy względem wielolecia (np. SPI)** — dziś mamy anomalię opadu względem mediany; wskaźnik znormalizowany dałby spójniejsze progi dla całej Polski. Priorytet: P2. Właściciel: —.
- [ ] **Trend NDVI/NDMI** — dziś porównanie sceny z medianą sezonową; alert na „spadek przez 2 kolejne sceny” wymaga zapisu serii per pole. Zależy od: migawek analiz pola. Priorytet: P2. Właściciel: —.
- [ ] **Wilgotność gleby (ERA5-Land)** — jest w warstwach P0 paszportu (`docs/PASSPORT_P0.md`), ale wymaga klucza CDS i nie jest w głównej analizie; percentyl wilgotności mógłby być sygnałem „sucho jak na tę porę roku”. Priorytet: P2. Właściciel: —.
- [ ] **Okna zabiegów z kalendarza uprawy** — przypomnienia typu „zbliża się faza wrażliwa na stres wodny” z faz uprawy (`stage`), bez nowych źródeł danych. Priorytet: P1. Właściciel: —.

## Reguły i jakość

- [ ] **Progi per uprawa i faza** — pierwsza wersja używa progów z modelu (RAW, bilans, susza). Warto je kalibrować na danych z pól i opiniach rolników. Priorytet: P1. Właściciel: —.
- [ ] **Ocena trafności alertów** — przycisk „to nie dotyczy mojego pola / pomocne” przy powiadomieniu, żeby zmniejszać fałszywe alarmy. Priorytet: P2. Właściciel: —.
- [ ] **Wyciszanie jednego pola / jednej kategorii** — oprócz ustawień globalnych. Priorytet: P2. Właściciel: —.
- [ ] **Powiadomienia grupowe** — gdy wiele pól zmienia stan naraz, jedno zbiorcze powiadomienie zamiast wielu. Priorytet: P2. Właściciel: —.

## Kanały

- [ ] **E-mail** — adres w koncie, SMTP (wdrożone: potwierdzenie, reset, „pole wymaga uwagi” z `python -m wodo.notify`), podsumowania dzienne/tygodniowe, link „wypisz się”. Zależy od: wyboru dostawcy (darmowy/open source). Priorytet: P1. Właściciel: —.
- [ ] **Web Push (PWA)** — manifest, service worker, klucze VAPID, zgoda przy pierwszym powiadomieniu. Priorytet: P2. Właściciel: —.
- [ ] **Godziny ciszy i strefa czasowa użytkownika.** Priorytet: P2. Właściciel: —.
- [ ] **Powiadomienia SMS/komunikatory** — tylko jeśli będzie zapotrzebowanie; wymaga płatnej bramki, więc poza zasadą „darmowe” bez osobnej decyzji. Priorytet: —. Właściciel: —.
