# Frontend – zasady dla agenta

Plan prac: [docs/implementation/frontend-plan.md](../docs/implementation/frontend-plan.md). Pracujemy etapami i zatrzymujemy się po każdym. Zasady architektury i commitów są w sekcjach „Architektura i higiena kodu” oraz „Commity” tego planu. Obowiązują zawsze.

Najważniejsze:
- Warstwy i kierunek zależności: `features/*` → `shared/` → `core/`. Nigdy odwrotnie, a feature nie importuje innego feature'a.
- Komponent odpowiada za prezentację i stan widoku. HTTP wyłącznie przez serwisy z `core/api/`, nigdy `HttpClient` w komponencie.
- Typy z `core/api/schema.d.ts` (generowany, nie edytować ręcznie). Zakaz `any` poza fixtures mocka.
- Żadnych plików „god”: komponent > ~250 linii albo szablon z kilkoma odpowiedzialnościami rozbij na podkomponenty w katalogu feature'a.
- Nowy kod ma przejść `npm run build` bez ostrzeżeń, zanim zgłosisz zakończenie kroku.
