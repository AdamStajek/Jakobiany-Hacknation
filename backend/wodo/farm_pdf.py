"""PDF „Raport o moich polach”: podsumowanie gospodarstwa i tabela pól w barwach Pole Widzenia."""
from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from wodo import brand
from wodo.pdf_kit import (
    CONTENT_W,
    Banner,
    bar_chart,
    build,
    callout,
    meta_table,
    now_label,
    p,
    qr_block,
    spacer,
    styles,
    table,
)
from wodo.report_evidence import number


class FarmRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(max_length=80)
    crop_label: str = Field(max_length=80)
    area_ha: float | None = Field(default=None, ge=0, le=1_000_000)
    parcels: int = Field(ge=0, le=1000)
    risk: str | None = Field(default=None, max_length=80)
    reasons: list[str] = Field(default_factory=list, max_length=10)
    report_date: str | None = Field(default=None, max_length=40)
    stale: bool = False


class FarmReportIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    rows: list[FarmRow] = Field(max_length=200)


def parse_date(value):
    try:
        return date.fromisoformat(value[:10]) if value else None
    except ValueError:
        return None


def total_area(rows):
    """Suma tylko wtedy, gdy powierzchnia jest znana dla każdego pola."""
    return sum(r.area_ha for r in rows) if rows and all(r.area_ha is not None for r in rows) else None


def by_crop(rows):
    groups = {}
    for row in rows:
        groups.setdefault(row.crop_label, []).append(row)
    return sorted(((label, items) for label, items in groups.items()), key=lambda g: (-len(g[1]), g[0].casefold()))


def farm_pdf(report: FarmReportIn):
    st = styles()
    rows = report.rows
    attention = [r for r in rows if r.reasons]
    dates = [d for d in (parse_date(r.report_date) for r in rows) if d]
    area = total_area(rows)
    qr = qr_block(brand.public_link("pola"), "Moje pola w aplikacji", st)
    flows = [Banner("Raport o moich polach", f"Stan na {now_label()}", "Raport gospodarstwa"), spacer(10),
             meta_table([("Pola", str(len(rows))), ("Działki", str(sum(r.parcels for r in rows))),
                         ("Powierzchnia", f"{number(round(area, 2))} ha" if area is not None else "Brak danych dla części pól"),
                         ("Wymaga uwagi", f"{len(attention)} z {len(rows)} pól"),
                         ("Ostatni raport", max(dates).strftime("%d.%m.%Y") if dates else None)], st, qr),
             spacer(6)]
    if not rows:
        flows.append(p("Nie masz jeszcze zapisanych pól. Dodaj pole w aplikacji, aby zobaczyć tu podsumowanie.", st["body"]))
        return build(flows, "Pole Widzenia — raport o moich polach", "Raport gospodarstwa")

    flows.append(p("Od czego zacząć", st["section"]))
    if attention:
        flows.append(callout("Najpierw sprawdź: " + "; ".join(
            f'{r.name} ({", ".join(r.reasons)})' for r in attention[:5]) + ".", st, "warn"))
    else:
        flows.append(callout("Według ostatnich raportów żadne pole nie wymaga pilnej uwagi.", st))
    missing = [r.name for r in rows if not r.report_date]
    stale = [r.name for r in rows if r.stale]
    if missing:
        flows.append(p(f'Bez raportu: {", ".join(missing)}. Uruchom analizę, aby poznać ich stan.', st["body"]))
    if stale:
        flows.append(p(f'Nieaktualny raport: {", ".join(stale)}. Warto odświeżyć analizę.', st["body"]))

    crops = by_crop(rows)
    flows.append(p("Uprawy", st["section"]))
    flows.append(bar_chart([label for label, _ in crops], [[len(items) for _, items in crops]], ["pola"],
                           "Liczba pól według uprawy", height=120, unit="pola"))
    flows.append(table([["Uprawa", "Pola", "Powierzchnia"]] + [
        [label, str(len(items)), f"{number(round(a, 2))} ha" if (a := total_area(items)) is not None else "brak danych"]
        for label, items in crops], [CONTENT_W - 190, 70, 120], st, align_right=(1, 2)))

    flows.append(p("Pola", st["section"]))
    flows.append(table([["Pole", "Uprawa", "Pow.", "Dz.", "Status", "Powody uwagi", "Raport z"]] + [
        [r.name, r.crop_label, f"{number(round(r.area_ha, 2))} ha" if r.area_ha is not None else "brak",
         str(r.parcels), (r.risk or "Brak raportu") + (" (nieaktualny)" if r.stale else ""),
         "; ".join(r.reasons) or "—", (d.strftime("%d.%m.%Y") if (d := parse_date(r.report_date)) else "—")]
        for r in rows], [78, 62, 44, 26, 78, CONTENT_W - 358, 58], st, align_right=(2, 3)))
    flows.append(spacer(6))
    flows.append(p("Status i powody pochodzą z ostatnich zapisanych raportów. To wskazówki, nie wyrok. "
                   + brand.DISCLAIMER, st["tiny"]))
    return build(flows, "Pole Widzenia — raport o moich polach", "Raport gospodarstwa")
