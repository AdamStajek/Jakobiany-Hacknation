# TODO — analiza i dane

Szczegółowe ograniczenia źródeł: [`docs/DATA_LIMITATIONS.md`](../docs/DATA_LIMITATIONS.md).

- [ ] **Walidacja modelu na pomiarach polowych** — dokumentacja przyznaje, że dokładność na konkretnych działkach wymaga porównania z pomiarami (`docs/KOWR-Podstawy-naukowe.md`). Priorytet: P1. Właściciel: —.
- [ ] **Uwzględnienie opadu lokalnego** — NASA POWER ma rozdzielczość kilkudziesięciu kilometrów; rozważyć stacje IMGW lub dane radarowe. Priorytet: P1. Właściciel: —.
- [ ] **Własne obserwacje wilgotności gleby w modelu** — pole `soil_observation` jest już w formularzu; uwzględnić serię obserwacji z notatek pola. Priorytet: P2. Właściciel: —.
- [ ] **Pokrycie terenu nowsze niż 2021** — źródło WorldCover jest z 2021 r. i pomija małe rowy i wody okresowe. Priorytet: P2. Właściciel: —.
- [ ] **Cache i limity źródeł przy odświeżaniu wielu pól** — wspólny budżet zapytań do NASA, IMGW, Sentinel. Zależy od: nocnego zadania powiadomień. Priorytet: P1. Właściciel: —.
