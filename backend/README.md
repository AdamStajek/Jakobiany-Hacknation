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
