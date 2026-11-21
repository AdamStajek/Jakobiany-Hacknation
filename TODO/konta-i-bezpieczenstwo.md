# TODO — konta i bezpieczeństwo

Decyzja: samodzielna rejestracja i logowanie e-mailem lub nazwą (backend wdrożony, `backend/wodo/auth`); brak kont domyślnych.

- [x] ~~Usunąć hasła domyślne `user/user` i `admin/admin`~~ — kont domyślnych nie ma, hasła tylko od użytkownika (min. 10 znaków).
- [x] ~~Samodzielna rejestracja i odzyskiwanie hasła e-mailem~~ — zrobione w backendzie (SMTP z env, Mailpit lokalnie).
- [ ] **Blokada po nieudanych próbach i powiadomienie admina** — dziś jest rosnące opóźnienie i limity (w pamięci procesu, znikają po restarcie i nie działają między wieloma procesami). Priorytet: P1. Właściciel: —.
- [ ] **Rola `admin` i `/api/admin/users`** (lista, wyłączenie konta, reset) — kolumna `role` istnieje, endpointów brak. Priorytet: P2. Właściciel: —.
- [ ] **Dziennik zdarzeń kont** (logowania, zmiany haseł, zakładanie kont). Priorytet: P2. Właściciel: —.
- [ ] **Retencja nieaktywnych kont** (np. 12 miesięcy) z ostrzeżeniem e-mailem. Priorytet: P2. Właściciel: —.
- [ ] **Zmiana adresu e-mail** z ponownym potwierdzeniem. Priorytet: P2. Właściciel: —.
- [ ] **Limity za proxy** — limity prób używają adresu klienta; za reverse proxy trzeba skonfigurować zaufane nagłówki (`--proxy-headers`). Priorytet: P1 przed wdrożeniem. Właściciel: —.
- [ ] **Regulamin i polityka prywatności** — dane lokalizacyjne i e-mail są danymi osobowymi; potrzebna informacja i zgody przed otwarciem kont. Priorytet: P0 przed publicznym startem. Właściciel: —.
- [ ] **SPF/DKIM i wybór dostawcy SMTP** na wdrożenie. Priorytet: P1. Właściciel: —.
- [ ] **Przegląd bezpieczeństwa** (`/security-review`) przed otwarciem kont dla zewnętrznych użytkowników. Priorytet: P1. Właściciel: —.
