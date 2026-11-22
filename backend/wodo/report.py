"""PDF analizy działki w barwach Pole Widzenia (dwa warianty: analiza z źródeł i raport z paszportu pola)."""
from math import floor, log10
from urllib.parse import quote

from reportlab.lib import colors
from reportlab.platypus import Flowable, KeepTogether, Table, TableStyle
from shapely import transform
from shapely.geometry import shape

from wodo import brand
from wodo.geo import TO_PL
from wodo.pdf_kit import (
    CONTENT_W,
    FIELD,
    FOREST,
    IVORY,
    LEAF,
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
from wodo.pdf_kit import SOFT as PAPER
from wodo.report_evidence import number, report_evidence
from wodo.science import CROPS


class ParcelMap(Flowable):
    def __init__(self, parcel, width=175, height=115):
        super().__init__()
        self.geometry = transform(shape(parcel["geometry"]), TO_PL, interleaved=False)
        self.width, self.height = width, height

    def draw(self):
        x0, y0, x1, y1 = self.geometry.bounds
        scale = min((self.width - 30) / (x1 - x0), (self.height - 24) / (y1 - y0))
        canvas = self.canv
        canvas.setFillColor(PAPER)
        canvas.roundRect(0, 0, self.width, self.height, 8, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor(brand.LEAF))
        canvas.setFillAlpha(0.45)
        canvas.setStrokeColor(FIELD)
        path = canvas.beginPath()
        polys = list(self.geometry.geoms) if self.geometry.geom_type == "MultiPolygon" else [self.geometry]
        for polygon in polys:
            for ring in [polygon.exterior, *polygon.interiors]:
                for i, (x, y) in enumerate(ring.coords):
                    draw = path.lineTo if i else path.moveTo
                    draw((x - (x0 + x1) / 2) * scale + self.width / 2,
                         (y - (y0 + y1) / 2) * scale + self.height / 2)
                path.close()
        canvas.drawPath(path, fill=1, stroke=1)
        canvas.setFillAlpha(1)
        canvas.setFillColor(FOREST)
        canvas.setFont("Wodo", 8)
        canvas.drawString(10, self.height - 14, "N ↑")
        metres = 10 ** int(floor(log10(55 / scale)))
        canvas.setStrokeColor(colors.HexColor(brand.ORANGE))
        canvas.setLineWidth(1.5)
        canvas.line(10, 10, 10 + metres * scale, 10)
        canvas.drawString(13 + metres * scale, 8, f"{metres:g} m")


def recommendation_details(rec, st):
    details = [p(rec["why"], st["body"]), p(rec["evidence"], st["body"]), p(rec["limits"], st["tiny"])]
    if impact := rec.get("area_impact"):
        details.append(p(f"Powierzchnia pod uprawę. {impact}", st["tiny"]))
    if estimate := rec.get("cost_estimate"):
        lower, upper = estimate["lower"], estimate["upper"]
        amount = f"{lower:g}" if lower == upper else f"{lower:g}–{upper:g}"
        details.append(p(f'Przykładowy koszt. {amount.replace(".", ",")} zł {estimate["unit"]}. {estimate["basis"]}', st["tiny"]))
        details += [p(f'{source["title"]} · {source["url"]}', st["tiny"]) for source in estimate["sources"]]
    for point in rec.get("points", ()):
        lon, lat = point["coordinates"]
        details.append(p(f'{point["type"]} · {point["date"]} · {lat:.5f}° N, {lon:.5f}° E. {point["description"]}', st["tiny"]))
        details.append(p(point["evidence"], st["tiny"]))
    details += [p(f'{source["title"]} · {source["url"]}', st["tiny"]) for source in rec.get("sources", ())]
    return details


def priority_tag(n, st):
    """Mała pomarańczowa plakietka z numerem priorytetu."""
    tag = Table([[p(f"Priorytet {n}", st["cellhead"])]], colWidths=[62])
    tag.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(brand.ORANGE)),
                             ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
    tag.hAlign = "LEFT"
    return tag


def appendix_notes(report, st):
    """Wspólny dopisek: jak czytać raport, czego dotyczą liczby."""
    return [p("Jak czytać ten raport", st["sub"]),
            p("Liczby pochodzą z modelu bilansu wody (FAO-56) i danych publicznych. "
              "Nie zastępują pomiaru wilgotności gleby na polu. Przed zabiegiem sprawdź warunki na działce.", st["tiny"])]


def sources_rows(report):
    from wodo.analysis import SOURCE_LABELS

    present = {s["key"]: s for s in report.get("sources", ())}
    missing = report.get("missing", {})
    rows = [["Źródło", "Stan", "Uwagi"]]
    for key, label in SOURCE_LABELS.items():
        if key in present:
            source = present[key]
            note = missing.get(label, "")
            if key == "weather" and source.get("coverage"):
                first, last = source["coverage"]
                note = (f"Zakres {first} – {last}, dni z danymi: {source.get('days', '—')}. " + note).strip()
            if key == "terrain" and source.get("slope_pct") is not None:
                note = (f"Nachylenie {number(source['slope_pct'])}%. " + note).strip()
            rows.append([label, "dostępne", note])
        elif label in missing:
            rows.append([label, "brak", missing[label]])
    rows += [[label, "brak", reason] for label, reason in missing.items()
             if label not in SOURCE_LABELS.values()]
    return rows


def farmer_pdf(report, st):
    plan = report["farmer_report"]
    crop = CROPS.get(report["crop_context"]["crop"])
    link = brand.public_link(f"dzialka/{quote(str(report['field_id']), safe='')}")
    qr = qr_block(link, "Otwórz działkę w aplikacji", st)
    flows = [Banner("Woda na Twoim polu", f"Działka {report['field_id']} · stan na {report['analysis_date']}",
                    "Raport dla rolnika"), spacer(10),
             meta_table([("Działka", report["field_id"]), ("Data analizy", report["analysis_date"]),
                         ("Uprawa", crop.label if crop else "Nie podano"),
                         ("Status wody", report.get("water_status")),
                         ("Wersja schematu", report.get("schema_version"))], st, qr),
             spacer(8), p(plan["situation"], st["reading"])]
    if plan["next_check"]:
        flows.append(callout(plan["next_check"], st, "warn"))
    soil = report.get("soil_water_availability") or {}
    if soil.get("taw_mm") is not None:
        flows += [p("Ile wody mieści strefa korzeni", st["section"]),
                  table([["Wskaźnik", "Wartość", "Co to znaczy"],
                         ["Pojemność strefy korzeni (TAW)", f'{number(soil["taw_mm"])} mm',
                          "Tyle wody gleba może maksymalnie udostępnić roślinom."],
                         ["Próg łatwo dostępnej wody (RAW)", f'{number(soil["raw_mm"])} mm' if soil.get("raw_mm") is not None else "—",
                          "Po przekroczeniu tego ubytku roślinom trudniej pobierać wodę."]],
                        [160, 70, CONTENT_W - 230], st)]
    months = (report.get("historical_analysis") or {}).get("complete_months_p_minus_et0_mm") or {}
    if months:
        flows += [p("Bilans wody w ostatnich miesiącach", st["section"]),
                  bar_chart(list(months), [[round(v, 1) for v in months.values()]], ["Opad − ET₀"],
                            "Opad minus parowanie referencyjne (ET₀)"),
                  p("Wartość poniżej zera oznacza, że parowanie przewyższało opad.", st["tiny"])]
    steps = plan["steps"]
    if steps:
        flows.append(p("Co możesz zrobić", st["section"]))
    n = 0
    for step in steps:
        if step.get("id"):
            n += 1
            flows.extend([priority_tag(n, st), p(step["title"], st["sub"]), p(step["when"], st["body"]),
                          *recommendation_details(step, st)])
        else:
            flows.append(KeepTogether([p(step["when"], st["section"]), p(step["action"], st["reading"]),
                                       p(step["why"], st["reading"]), p(step.get("condition", ""), st["body"])]))
    flows.append(p("Niepewność i ograniczenia", st["section"]))
    if report.get("uncertainty"):
        flows.append(p(report["uncertainty"], st["body"]))
    flows += [p(f"• {item}", st["body"]) for item in report.get("limitations", ())]
    quality = report.get("data_quality") or {}
    if quality.get("passport_rows"):
        flows.append(p(f'Paszport pola: przyjęto {quality.get("accepted_fields", 0)} z {quality["passport_rows"]} pozycji danych.', st["tiny"]))
    flows += appendix_notes(report, st)
    return build(flows, "Pole Widzenia — raport dla rolnika", "Raport dla rolnika")


def analysis_pdf(report, st):
    parcel, metrics = report["parcel"], report["metrics"]
    evidence = report.get("evidence") or report_evidence(report)
    link = None
    if report.get("analysis_id"):
        link = brand.public_link(f"dzialka/{quote(str(parcel['id']), safe='')}/analiza/{report['analysis_id']}")
    qr = qr_block(link, "Raport w aplikacji (ważny 14 dni)", st)
    flows = [Banner("Analiza działki", f'Działka {parcel["id"]} · {report["date"]} · {number(parcel["area_ha"])} ha',
                    "Raport z analizy"), spacer(10),
             meta_table([("Działka", parcel["id"]), ("Data analizy", report["date"]),
                         ("Uprawa", metrics["crop"]["label"]), ("Faza uprawy", metrics.get("stage")),
                         ("Powierzchnia", f'{number(parcel["area_ha"])} ha'),
                         ("Pewność oceny", report.get("confidence")),
                         ("Model", f'wersja {report["model_version"]}' if report.get("model_version") else None),
                         ("Numer analizy", report.get("analysis_id")), ("Wygenerowano", now_label())], st, qr),
             p("1. Analiza", st["section"])]
    if metrics.get("stage"):
        flows.append(p(f'Faza uprawy: {metrics["stage"]}.', st["tiny"]))
    verdict = [p(evidence["headline"], st["sub"]), p(evidence["reason"], st["body"]),
               p(evidence["confidence_note"], st["tiny"])]
    verdict_table = Table([[ParcelMap(parcel), verdict]], colWidths=[185, 300])
    verdict_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                                       ("BACKGROUND", (1, 0), (-1, -1), IVORY),
                                       ("LINEBEFORE", (1, 0), (1, -1), 3, LEAF)]))
    flows.extend([verdict_table, spacer(8), p("Czy deszcz pokrył potrzeby uprawy?", st["sub"]),
                  p(evidence["balance"], st["body"])])
    if recent := metrics["recent"]:
        flows.append(p(f'{recent["start"]} – {recent["end"]} · Dane z {recent["samples"]} z {recent["days"]} dni.', st["body"]))
        values = [("Opad", "rain_mm"), ("Parowanie referencyjne (ET₀)", "et0_mm"),
                  ("Potrzeby uprawy (ETc)", "etc_mm"), ("Bilans uprawy", "crop_balance_mm")]
        flows.append(p(" · ".join(f"{label}: {number(recent[key])} mm" for label, key in values
                                  if recent.get(key) is not None), st["body"]))
        if all(recent.get(key) is not None for _, key in values):
            flows.append(bar_chart(["Opad", "ET₀", "ETc", "Bilans"], [[round(recent[key], 1) for _, key in values]],
                                   ["ostatnie dni"], "Bilans wody w ostatnim okresie", height=120))
        if recent.get("dry_spell_days") is not None:
            flows.append(p(f'Najdłuższa seria dni z opadem poniżej 1 mm: {recent["dry_spell_days"]}.', st["body"]))
        flows.append(p("Bilans uprawy to różnica między opadem a potrzebami wodnymi uprawy. "
                       "Korzenie mogą też korzystać z zapasu w glebie.", st["tiny"]))
    flows.append(p("Ile wody może zatrzymać gleba przy korzeniach?", st["sub"]))
    if report["agricultural"] and (root := metrics["root"]):
        flows.append(p(f'Modelowana pojemność strefy korzeni wynosi {number(root["taw_mm"])} mm. '
                       f'Szacowany ubytek to {number(root["initially_wet"]["depletion_mm"])} mm przy wilgotnej glebie '
                       f'na początku i {number(root["initially_dry"]["depletion_mm"])} mm przy suchej.', st["body"]))
    else:
        flows.append(p("Dla tej daty nie ma oceny zapasu przy korzeniach.", st["body"]))
    if report["agricultural"] and (root := metrics["root"]) and root.get("raw_mm") is not None:
        flows.append(p(f'Próg łatwo dostępnej wody (RAW) wynosi {number(root["raw_mm"])} mm. '
                       "Po przekroczeniu tego ubytku roślinom może być trudniej pobierać wodę.", st["body"]))
        if start := evidence.get("root_start"):
            flows.append(p(f'Okres modelowania: {start} – {report["date"]} ({root["days"]} dni).', st["tiny"]))
    if scenario := report.get("scenario"):
        low, high = scenario["depletion_reduction_mm"]
        flows.extend([p("Symulacja dodatkowej wody", st["sub"]),
                      p(f'Przy dodatkowych {number(scenario["input_mm"])} mm wody ubytek zmniejszyłby się '
                        f'o {number(low)}–{number(high)} mm.', st["body"]),
                      p(scenario["note"], st["tiny"])])
    history = metrics["history"]
    count = len(history["seasons"])
    flows.extend([p("Co widać na zdjęciu satelitarnym?", st["sub"]), p(evidence["satellite"], st["body"]),
                  p("Czy woda może spływać z pola?", st["sub"]), p(evidence["runoff"], st["body"]),
                  p("Czy takie warunki często się tu powtarzają?", st["sub"]),
                  p(f'W {history["negative_seasons"]} z {count} ocenionych sezonów opad był niższy niż parowanie referencyjne.'
                    if count else "Za mało danych, żeby ustalić, jak często powracał niedobór opadów.", st["body"])])
    if count:
        rows = [["Sezon", "Opad (mm)", "ET₀ (mm)", "Opad − ET₀ (mm)", "Dni z danymi"]]
        rows.extend([str(s["year"]), number(s["rain_mm"]), number(s["et0_mm"]),
                     number(s["balance_mm"]), f'{s["samples"]}/{s["days"]}'] for s in history["seasons"])
        flows.extend([p("Porównanie sezonów od kwietnia do września", st["sub"]),
                      bar_chart([str(s["year"]) for s in history["seasons"]],
                                [[round(s["rain_mm"], 1) for s in history["seasons"]],
                                 [round(s["et0_mm"], 1) for s in history["seasons"]]],
                                ["Opad", "ET₀"], "Opad i parowanie w kolejnych sezonach"),
                      table(rows, [65, 95, 95, 115, 115], st, align_right=(1, 2, 3, 4))])

    flows.append(p("2. Eksperymenty", st["section"]))
    if not report.get("experiments"):
        flows.append(p("Dla tej analizy nie zaproponowano eksperymentów.", st["body"]))
    for check in report.get("experiments", ()):
        slug = check["slug"]
        value = report.get("experiment_results", {}).get(slug)
        label = next((o["label"] for o in check["options"] if o["value"] == value),
                     "Brak wyniku lub próba niejednoznaczna")
        flows.extend([p(check["title"], st["sub"]), p(check["impact"], st["body"]), p(f"Wynik próby: {label}.", st["body"])])
        if conclusion := report.get("experiment_conclusions", {}).get(slug):
            flows.append(p(f"Wniosek z próby: {conclusion}", st["body"]))

    flows.append(p("3. Co możesz zrobić?", st["section"]))
    if not report["recommendations"]:
        flows.append(p("Brak wystarczających podstaw do zaleceń dla wybranej działki i daty.", st["body"]))
    elif len(report["recommendations"]) > 1:
        flows.append(table([["Priorytet", "Działanie", "Kiedy?", "Koszt"]] + [
            [str(n), rec["title"], rec["when"], _cost_label(rec)] for n, rec in enumerate(report["recommendations"], 1)],
            [50, CONTENT_W - 230, 100, 80], st))
    for n, rec in enumerate(report["recommendations"], 1):
        flows.extend([spacer(4), priority_tag(n, st), p(rec["title"], st["sub"])])
        if rec["action"] != rec["title"]:
            flows.append(p(rec["action"], st["body"]))
        scope = rec.get("location") or {"field": "Całe pole", "point": "Zaznaczone miejsca"}.get(rec.get("scope"))
        flows.append(p(f'Kiedy? {rec["when"]}' + (f" · {scope}" if scope else ""), st["body"]))
        if rec.get("cost") and not rec.get("cost_estimate"):
            flows.append(p(f'Koszt: {rec["cost"]}', st["body"]))
        for k, step in enumerate(rec.get("steps", ()), start=1):
            flows.append(p(f"{k}. {step}", st["body"]))
        flows.extend(recommendation_details(rec, st))

    flows.append(p("4. Źródła danych i ograniczenia", st["section"]))
    rows = sources_rows(report)
    if len(rows) > 1:
        flows.append(table(rows, [130, 55, CONTENT_W - 185], st))
    flows += appendix_notes(report, st)
    return build(flows, "Pole Widzenia — raport z analizy", "Raport z analizy")


def _cost_label(rec):
    if estimate := rec.get("cost_estimate"):
        lower, upper = estimate["lower"], estimate["upper"]
        amount = f"{lower:g}" if lower == upper else f"{lower:g}–{upper:g}"
        return f'{amount.replace(".", ",")} zł {estimate["unit"]}'
    return rec.get("cost") or "—"


def pdf(report):
    st = styles()
    if "field_id" in report and "farmer_report" in report:
        return farmer_pdf(report, st)
    return analysis_pdf(report, st)
