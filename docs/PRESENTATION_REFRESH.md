# Odświeżenie materiałów prezentacyjnych po zmianie układu

Frontend przebudowano na mobile-first: powłoka z paskiem bocznym (desktop) i dolną nawigacją (telefon), widoki Mapa / Dane / Raport przełączane segmentami (opis: [Przewodnik frontendu](FRONTEND_GUIDE_LLM.md), sekcja 3a). Materiały w `submission/` powstały na poprzednim układzie i pokazują stary wygląd. Ten dokument to lista do odświeżenia. Zakres sprawdzono przez lekturę kodu i skryptów, nie przez obejrzenie plików PDF i MP4 (w środowisku nie było `pdftotext` ani `ffprobe`), więc numery slajdów i sceny filmu potwierdź wzrokowo.

## Co dokładnie jest nieaktualne

Slajdy PDF (`submission/WodoStraznik-prezentacja.pdf`) są generowane skryptem `frontend/e2e/deck.mjs` z trzech zrzutów ekranu: `map.png`, `result.png`, `recommendations.png` (katalog `submission/.capture/chromium/`). Zrzuty robi `frontend/e2e/smoke.mjs` przy `WODO_CAPTURE=1`.

| Slajd (kolejność w `deck.mjs`) | Zrzut | Co odświeżyć |
|---|---|---|
| 1. Okładka | `map` | Zrzut mapy w starym układzie. Zrobić nowy: mapa z paskiem bocznym (desktop). |
| 3. Od granicy do decyzji | `map` | Podpis „formularz i granica” — teraz Mapa i Dane to osobne widoki. Zrzut i podpis do zmiany. |
| 6. Dlaczego na tej działce? | `recommendations` | Zrzut raportu w starym układzie. |
| 8. Gotowość do próby na żywo | `result` | Zrzut wyniku i historii w starym układzie. |
| 2, 4, 5, 7 | brak zrzutów | Treść liczbowa i opisowa; bez zmian z powodu układu. Tekst z liczbami pochodzi z `live-verification.json`. |

Dodatkowo:

- **Nowy slajd (opcjonalnie, mobilność)**: kolaż telefon (390 px: Mapa, Dane, Raport) + desktop. Regulamin wymienia mobilność jako atut (macierz wymagań, Opis 3.1–3.2, 5.4), a w obecnym PDF nie ma slajdu, który ją pokazuje. Limit PDF to do 10 slajdów (`SUBMISSION_CHECKLIST.md`); obecnie skrypt generuje 8, więc jest miejsce.
- **Film demonstracyjny (`submission/demo.mp4`, do 3 minut)**: nagrywany z `smoke.mjs` w oknie 1360×920 w starym układzie (formularz i mapa na jednym ekranie). Do nagrania od nowa. Dodać krótki fragment w widoku telefonu (390 px) i pokazać przełączanie Mapa → Dane → Raport oraz motyw ciemny. Zmieścić w 3 minutach.
- **Raporty PDF (`submission/reports/*.pdf`)**: generuje je backend (ReportLab), a nie frontend, więc układ aplikacji ich nie dotyczy. Nie odświeżać z tego powodu.
- **`submission/WodoStraznik-source.zip`**: zawiera źródła sprzed przebudowy; spakować ponownie po scaleniu.
- **`submission/PITCH.md`**: fragment „Pokaż aplikację” (rozwijam powód zalecenia, przechodzę do historii i pobieram PDF) opisuje kolejność kroków w starym interfejsie. Dopasować do nowego przepływu Mapa → Dane → Raport.
- **`submission/CAPTURE.md`**: opis „otwarcie aplikacji, wpisanie numeru działki…” jest aktualny co do przebiegu, ale zależy od działającego skryptu nagrywającego (patrz niżej).

## Blokada: skrypt nagrywający prawdopodobnie wymaga poprawek

`frontend/e2e/smoke.mjs` używa selektorów z poprzedniego układu (m.in. pole „Identyfikator działki”, przycisk „Szukaj”, nagłówek „Stan wody na Twojej działce”, kolejność kroków na jednym ekranie). W nowym układzie na telefonie część tych elementów jest w innym widoku (Mapa lub Dane), a po starcie analizy aplikacja sama przechodzi do Raportu. Skryptu nie uruchamiano po przebudowie, więc nie wiadomo, które kroki przestały działać. Na liście TODO jest już pozycja „Testy E2E nowego układu” (`TODO/frontend-i-ux.md`). Kolejność prac:

1. Dostosować `smoke.mjs` do nowego układu (osobna zmiana w kodzie, poza zakresem tego dokumentu).
2. Uruchomić go bez nagrywania i potwierdzić przejście.
3. Uruchomić z `WODO_CAPTURE=1`, wygenerować nowe `map.png`, `result.png`, `recommendations.png` i film.
4. Przebudować PDF (`deck.mjs`) i zamienić `submission/WodoStraznik-prezentacja.pdf` oraz `submission/demo.mp4`.

## Do sprawdzenia po scaleniu

- Wyniki weryfikacji nowego układu (przeglądarki, szerokość 390 px) znajdą się w `docs/VERIFICATION.md`. Stan: do uzupełnienia po scaleniu. Dotychczasowe zapisy tam i w macierzy wymagań dotyczą poprzedniego układu.
- Po wymianie materiałów sprawdzić, czy liczby na slajdach nadal zgadzają się z `submission/live-verification.json`.
- Zaktualizować `submission/README.md` tylko jeśli zmienią się nazwy plików.
