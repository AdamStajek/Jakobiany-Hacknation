# Długotrwałe procesy: postęp przez WebSocket i budżet czasu

## Zasada obowiązująca w projekcie

Każda operacja, która może trwać dłużej niż ok. 2 s (analiza działki, paszport pola, generowanie raportu, budowa indeksu itp.), **musi pokazywać użytkownikowi prawdziwy postęp przez WebSocket**. Sam spinner, pasek nieokreślony ani timer wymyślający „kroki” nie wystarczają. Zwykły endpoint HTTP zostaje jako zgodność wsteczna i fallback.

### Backend

1. Logikę procesu wydziel do funkcji z opcjonalnym callbackiem `on_progress(done, total, label)` (wzór: `wodo.analysis.run`, `main.execute_analysis`). Callback jest wołany z wątku roboczego po każdym ukończonym kroku.
2. Endpoint WS pod `/api/ws/<nazwa>` (wzór: `analysis_socket` w `backend/main.py`):
   - klient wysyła jeden JSON z parametrami (te same walidatory Pydantic co w POST, limit 650 kB);
   - serwer odsyła zdarzenia `{"type":"progress","done":n,"total":m,"label":"…"}`, a na koniec dokładnie jedno `{"type":"result","report":…}` albo `{"type":"error","status":<kod HTTP>,"detail":"…"}`;
   - praca blokująca idzie do wątku (`run_in_executor`), zdarzenia wracają przez `loop.call_soon_threadsafe` do `asyncio.Queue`;
   - te same limity współbieżności co HTTP (`analysis_slots`). Middleware HTTP (rozmiar, rate limit) **nie obejmuje WebSocketów**, więc limit rozmiaru i timeout odbioru wiadomości sprawdzaj w handlerze.
3. Test z `TestClient.websocket_connect` (wzór: `backend/tests/test_ws.py`): sekwencja `progress` → `result` oraz błąd walidacji.

### Frontend

- Klient WS tylko w `core/api/ApiService` (wzór: `analyzeWithProgress`), stan postępu w `core/state/*Store` (signal `progress` + `percent`), pasek w komponencie (`aria-live="polite"`).
- Gdy WS się nie połączy, klient automatycznie wraca do zwykłego POST (bez postępu).
- Dev: `proxy.conf.mjs` ma `ws: true`. Produkcja: front i API są pod tym samym originem (FastAPI serwuje SPA). Jeśli dodasz reverse proxy, włącz przekazywanie nagłówków `Upgrade`/`Connection`.

## Wymagania dotyczące maksymalnego czasu

Przeanalizowano [REQUIREMENTS_MATRIX.md](REQUIREMENTS_MATRIX.md) (wiersz „Opis 7”) i [VERIFICATION.md](VERIFICATION.md):

- **Twardego limitu czasu ładowania/analizy w regulaminie KOWR ani w opisie technicznym nie ma.** Jedyna wzmianka to „30 s” w opisie (kryteria oceny, sekcja 7) i zespół interpretuje ją jako **preferencję, nie wymóg**, mierzoną osobno na zimno i na ciepło. Nie znaleziono dodatkowego załącznika, który to zmieniałby.
- Praktyczny cel: **do 30 s na zimnym cache** (jury ocenia „prototyp” i „prostotę”, a dłuższe czekanie bez informacji wygląda na awarię).
- Stan obecny (VERIFICATION.md, 21.11.2026): zimny cache **5,1–10,6 s**, ciepły **ok. 0,1 s**. Mieści się w preferencji z zapasem ~3×.
- Zabezpieczenia w kodzie: źródła zewnętrzne są odpytywane równolegle z **budżetem 24 s** na całość (`wodo/analysis.py`); po przekroczeniu źródło trafia do listy braków, a analiza kończy się częściowym wynikiem. To daje górną granicę ok. 24 s + przetwarzanie, czyli poniżej 30 s.
- Pierwsze uruchomienie indeksu działek (35–40 min, zob. README) to osobny proces tła. Do czasu jego gotowości `/api/parcels/*` zwraca 503. Tu zalecane jest rozszerzenie o WS z postępem budowy indeksu, zgodnie z zasadą powyżej (jeszcze niezrealizowane).

Wniosek: bez WS spełniamy preferencję czasową, ale WS poprawia odbiór (użytkownik widzi, które źródło właśnie dotarło) i jest wymagane przez zasadę projektu dla wszystkich procesów > 2 s.
