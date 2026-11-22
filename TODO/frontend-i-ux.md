# TODO — frontend i UX

- [ ] **Tryb ciemny** (część zrobiona: commity d51a932, fd0484c, zrzuty w `docs/screenshots/dark-mode/`; zostaje przegląd wizualny karty działki i ramek ryzyka) — zgłoszone jako słaby (kontrast kart, przycisków i znaczników w kolorach `primary-50/200`); poprawiono stronę paszportów, reszta do przeglądu wizualnego (karta wybranej działki w panelu analizy, kolorowe ramki ryzyka w raporcie). Priorytet: P1. Właściciel: —.
- [x] ~~**Przepisać paszport**~~ — zrobione: brak `HttpClient`/`ngModel` w `features/`, dane przez `PassportStore` (WebSocket, etap 5 planu UI). Było: szablon i logika używają `HttpClient` w komponencie i `[(ngModel)]`, wbrew `docs/FRONTEND_GUIDE_LLM.md`. Zrobić przy przenoszeniu paszportu do szczegółów pola. Priorytet: P1. Właściciel: —.
- [x] ~~**Testy E2E nowego układu**~~ — `frontend/e2e/smoke.mjs` dostosowany (commit 9082e15, `npm run test:e2e`); ponowne uruchomienie przed prezentacją. Było — przepływ Mapa → Dane → Raport na telefonie i desktopie (Playwright). Priorytet: P1. Właściciel: —.
- [x] ~~**Sprawdzić raport z prawdziwymi danymi na telefonie**~~ — zrzuty `docs/screenshots/verification/mobile-05-raport.png`, kontrola QA w `docs/VERIFICATION.md`. Było — po przebudowie obejrzano tylko ekran startowy i stronę Metody. Priorytet: P0. Właściciel: —.
- [ ] **PWA** — instalacja na telefonie, praca offline dla zapisanych pól i raportów, baza pod Web Push. Priorytet: P2. Właściciel: —.
- [ ] **Wydajność mapy na telefonach** — lazy ładowanie kafelków, ograniczenie warstwy działek. Priorytet: P2. Właściciel: —.
- [ ] **Dostępność** — przegląd czytnikiem ekranu: przełączniki widoków, kreator pola, powiadomienia. Priorytet: P1. Właściciel: —.
