# Backend (FastAPI)

Uruchomienie: `uv run uvicorn main:app --reload`, testy: `uv run pytest`.

## Konta, pola i e-maile

Rdzeń (analiza, działki, paszport) działa bez konta. Konto dokłada zapisane pola i powiadomienia e-mail. Kod: `wodo/auth`, `wodo/fields`, `wodo/notify`, baza `wodo/db.py`.

Bezpieczeństwo: hasła `scrypt` z solą (min. 10 znaków), sesje po stronie serwera (w bazie tylko hash tokenu), ciasteczko `wodo_session` HttpOnly + SameSite=Lax (+ Secure poza `WODO_ENV=dev`), limity prób logowania z rosnącym opóźnieniem, nagłówek `X-Requested-With` wymagany dla żądań zmieniających stan. Brak kont domyślnych.

### Zmienne środowiskowe

| Zmienna | Znaczenie | Domyślnie |
|---|---|---|
| `WODO_ENV` | `dev` = ciasteczko bez Secure i e-maile do outboxu bez SMTP | produkcyjnie (Secure) |
| `WODO_DATA_DIR` | katalog danych (poza gitem) | `backend/.wodo-data` |
| `WODO_DB_PATH` | plik SQLite | `$WODO_DATA_DIR/app.sqlite` |
| `WODO_PUBLIC_URL` | adres aplikacji w linkach z e-maili (`/konto/potwierdz?token=`, `/konto/reset?token=`) | `http://localhost:4200` |
| `WODO_SMTP_HOST`, `WODO_SMTP_PORT` | serwer SMTP | brak / 587 (465 dla `ssl`) |
| `WODO_SMTP_USER`, `WODO_SMTP_PASSWORD`, `WODO_SMTP_FROM` | dane logowania i nadawca | brak |
| `WODO_SMTP_TLS` | `starttls` (domyślnie), `ssl` lub `none` | `starttls` |
| `WODO_MAX_FIELDS` | limit pól na konto | 50 |

### E-maile lokalnie (za darmo)

Bez `WODO_SMTP_HOST` i z `WODO_ENV=dev` wiadomości trafiają do logu i pliku `$WODO_DATA_DIR/outbox.jsonl` (tam jest link z tokenem). Wygodniej użyć [Mailpit](https://mailpit.axllent.org/) (open source, jeden plik binarny albo obraz Docker):

```
docker run -d -p 8025:8025 -p 1025:1025 axllent/mailpit
WODO_ENV=dev WODO_SMTP_HOST=localhost WODO_SMTP_PORT=1025 WODO_SMTP_TLS=none WODO_SMTP_FROM=wodo@localhost \
  uv run uvicorn main:app --reload
```

Skrzynka testowa: http://localhost:8025.

### E-maile we wdrożeniu (darmowy dostawca)

Wystarczy dowolny dostawca SMTP z darmowym limitem, np. Brevo (300 wiadomości dziennie), Mailjet albo Resend (limit dzienny w darmowym planie) — albo konto Gmail z hasłem aplikacji do małych pokazów. Ustaw `WODO_SMTP_HOST/PORT/USER/PASSWORD/FROM`, port 587 + `starttls`. Skonfiguruj SPF/DKIM dla domeny nadawcy, inaczej wiadomości trafią do spamu. Bez SMTP w produkcji e-maile nie są wysyłane (błąd w logu).

### Powiadomienie „pole wymaga uwagi”

Z cron-a (np. raz na dobę): `uv run python -m wodo.notify`. Wysyła jedną wiadomość na użytkownika (z potwierdzonym e-mailem i włączonym powiadomieniem) o polach, których ostatni raport (`PUT /api/fields/{id}/last-report`) spełnia: ryzyko „Podwyższone” lub „Sygnał niedoboru”, `dry_spell_days >= 7` albo `crop_balance_mm < 0`. Ten sam zestaw powodów dla pola nie jest wysyłany ponownie, dopóki pole nie wróci do normy lub nie zmienią się powody.

Ten sam przebieg wysyła też: **alerty pogodowe** (prognoza Open-Meteo na 3 dni: opad ≥ 20 mm na dobę lub ≥ 10 mm na godzinę albo upał ≥ 32 °C; raz na pole, rodzaj i dzień; wymaga `WODO_NONCOMMERCIAL_OPEN_METEO=1`) oraz **podsumowanie tygodniowe** (pola wymagające uwagi, bez raportu i z nieaktualnym raportem; najwyżej raz na 7 dni). Oba respektują godziny ciszy i zgodę na e-maile. Wiek raportu jest szacowany po ostatniej zmianie pola (`updated_at`), bo raport nie zapisuje daty. Przy cronie raz na dobę alert o pogodzie wyprzedza zdarzenie o 1–3 dni.

### E-maile o nowych rekomendacjach

To samo polecenie odświeża analizy zapisanych działek użytkowników z potwierdzonym adresem i włączonym ustawieniem „E-maile o nowych rekomendacjach” w `/konto`. Ustawienie jest domyślnie wyłączone. Zadanie korzysta z zapisanej geometrii i uprawy. Porady wymagające dodatkowych deklaracji z formularza analizy pojawią się tylko wtedy, gdy silnik ma wymagane dane.

Pierwszy przebieg po włączeniu zgody zapisuje punkt odniesienia. Później wiadomość dla działki zawiera wyłącznie porady, których ID pojawiło się w porównaniu z poprzednią analizą. Zmiana kolejności, uzasadnienia lub samo wygaśnięcie porady nie wyzwalają wysyłki. Jeżeli brakuje źródła danych uwzględnionego poprzednio, zadanie czeka na kolejny odczyt. Po błędzie SMTP ponawia próbę, jeżeli porada nadal jest aktualna.

Dodaj polecenie do crona na hoście wdrożenia. W Docker Compose uruchamiaj je z katalogu projektu, żeby skorzystać z tej samej bazy, cache i konfiguracji SMTP co API.

```sh
docker compose exec -T wodo /app/.venv/bin/python -m wodo.notify
```

Lokalnie, bez SMTP i z `WODO_ENV=dev`, wiadomości trafią do opisanego wyżej pliku `outbox.jsonl`. Zadanie korzysta z blokady plikowej na Linuksie, aby kolejne przebiegi się nie nakładały.

Przycisk „Wyślij wiadomość testową” w ustawieniach konta wysyła przykładową rekomendację na potwierdzony adres. Działa również przy wyłączonych powiadomieniach cyklicznych. Obowiązuje limit jednej próby na minutę na konto.
