# TODO — katalog pomysłów i braków

Jedno miejsce na rzeczy, które warto dodać, ale nie są jeszcze w zakresie. Każdy plik dotyczy jednego obszaru. Plan wdrożenia pulpitu pól: [`docs/FIELDS_DASHBOARD_PLAN.md`](../docs/FIELDS_DASHBOARD_PLAN.md).

## Jak dodawać wpis

Jedna pozycja = jeden punkt listy w odpowiednim pliku, w formacie:

```
- [ ] **Krótki tytuł** — po co to jest (1–2 zdania). Dane/źródło: …. Zależy od: … . Priorytet: P0/P1/P2. Właściciel: imię lub „—”.
```

Zasady:
- Zacznij od dowodu, że problem jest prawdziwy (skąd wiesz: sygnał w kodzie, uwaga użytkownika, ograniczenie z `docs/DATA_LIMITATIONS.md`).
- Nie dopisuj pozycji bez opisu „po co”. TODO bez właściciela dostaje „—” i trafia do przeglądu.
- Zrobione: odhacz `[x]` i dopisz link do commita lub PR, a po tygodniu usuń.
- Dane i biblioteki wyłącznie darmowe/open source, bez kluczy API (zasada z `AGENTS.md`).

## Pliki

| Plik | Zakres |
|---|---|
| [`powiadomienia.md`](powiadomienia.md) | Sygnały, reguły i kanały powiadomień o wymaganych akcjach na polach |
| [`pola-i-pulpit.md`](pola-i-pulpit.md) | Pulpit „Moje pola”, zadania, dane pól |
| [`konta-i-bezpieczenstwo.md`](konta-i-bezpieczenstwo.md) | Logowanie, role, hasła startowe, dane osobowe |
| [`analiza-i-dane.md`](analiza-i-dane.md) | Nowe źródła danych i wskaźniki, ulepszenia modelu |
| [`frontend-i-ux.md`](frontend-i-ux.md) | Dostępność, tryb ciemny, PWA, wydajność, testy |
