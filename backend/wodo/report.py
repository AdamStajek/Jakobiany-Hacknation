from io import BytesIO
from math import floor, log10
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from shapely import transform
from shapely.geometry import shape

from wodo.geo import TO_PL
from wodo.report_evidence import number, report_evidence
from wodo.science import CROPS

FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
INK = colors.HexColor("#153b30")
GREEN = colors.HexColor("#286b53")
MUTED = colors.HexColor("#567168")
PAPER = colors.HexColor("#edf4ed")


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
        canvas.setFillColor(colors.HexColor("#a7d6bb"))
        canvas.setStrokeColor(GREEN)
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
        canvas.setFillColor(INK)
        canvas.setFont("Wodo", 8)
        canvas.drawString(10, self.height - 14, "N ↑")
        metres = 10 ** int(floor(log10(55 / scale)))
        canvas.line(10, 10, 10 + metres * scale, 10)
        canvas.drawString(13 + metres * scale, 8, f"{metres:g} m")


def pdf(report):
    if "Wodo" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("Wodo", str(FONT_DIR / "DejaVuSans.ttf")))
        pdfmetrics.registerFont(TTFont("WodoBold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))
    styles = getSampleStyleSheet()
    body = ParagraphStyle("text", parent=styles["BodyText"], fontName="Wodo", fontSize=9.5,
                          textColor=INK, leading=14, spaceAfter=5, splitLongWords=True)
    title = ParagraphStyle("title", parent=body, fontName="WodoBold", fontSize=24, leading=30)
    section = ParagraphStyle("section", parent=body, fontName="WodoBold", fontSize=14, leading=19, spaceBefore=13, keepWithNext=True, textColor=GREEN)
    sub = ParagraphStyle("sub", parent=body, fontName="WodoBold", fontSize=11, leading=15, keepWithNext=True)
    tiny = ParagraphStyle("small", parent=body, fontSize=8, leading=11, textColor=MUTED)
    buf = BytesIO()
    document = SimpleDocTemplate(buf, pagesize=A4, leftMargin=52, rightMargin=52, topMargin=48,
                                 bottomMargin=45, title="WodoStrażnik — raport analizy")

    def p(s, style=body):
        return Paragraph(escape(str(s)), style)

    def footer(canvas, doc):
        canvas.setFont("Wodo", 8)
        canvas.setFillColor(MUTED)
        canvas.drawString(52, 25, "WodoStrażnik  •  Raport działki")
        canvas.drawRightString(543, 25, str(doc.page))

    def recommendation_details(rec):
        details = [p(rec["why"]), p(rec["evidence"]), p(rec["limits"], tiny)]
        if estimate := rec.get("cost_estimate"):
            lower, upper = estimate["lower"], estimate["upper"]
            amount = f"{lower:g}" if lower == upper else f"{lower:g}–{upper:g}"
            details.append(p(f'Przykładowy koszt. {amount.replace(".", ",")} zł {estimate["unit"]}. {estimate["basis"]}', tiny))
            for source in estimate["sources"]:
                details.append(p(f'{source["title"]} · {source["url"]}', tiny))
        for point in rec.get("points", ()):
            lon, lat = point["coordinates"]
            details.append(p(f'{point["type"]} · {point["date"]} · {lat:.5f}° N, {lon:.5f}° E. {point["description"]}', tiny))
            details.append(p(point["evidence"], tiny))
        for source in rec.get("sources", ()):
            details.append(p(f'{source["title"]} · {source["url"]}', tiny))
        return details

    reading = ParagraphStyle("reading", parent=body, fontSize=12, leading=18, spaceAfter=7)
    if "field_id" in report and "farmer_report" in report:
        plan = report["farmer_report"]
        crop = CROPS.get(report["crop_context"]["crop"])
        flows = [p("Woda na Twoim polu", title), p(f"Działka {report['field_id']} · {report['analysis_date']}"),
                 p(crop.label, sub) if crop else Spacer(1, 4), p(plan["situation"], reading)]
        if plan["next_check"]:
            flows.append(p(plan["next_check"], reading))
        for step in plan["steps"]:
            if step.get("id"):
                flows.extend([p(step["title"], section), p(step["when"]), *recommendation_details(step)])
            else:
                flows.append(KeepTogether([p(step["when"], section), p(step["action"], reading),
                                           p(step["why"], reading), p(step.get("condition", ""))]))
        document.build(flows, onFirstPage=footer, onLaterPages=footer)
        return buf.getvalue()

    parcel, metrics = report["parcel"], report["metrics"]
    evidence = report.get("evidence") or report_evidence(report)
    flows = [p("Analiza działki", title),
             p(f'Działka {parcel["id"]} · {report["date"]} · {metrics["crop"]["label"]} · {number(parcel["area_ha"])} ha'),
             p("1. Analiza", section)]
    verdict = [p(evidence["headline"], sub), p(evidence["reason"]), p(evidence["confidence_note"], tiny)]
    table = Table([[ParcelMap(parcel), verdict]], colWidths=[185, 300])
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                               ("BACKGROUND", (1, 0), (-1, -1), PAPER)]))
    flows.extend([table, Spacer(1, 8), p("Czy deszcz pokrył potrzeby uprawy?", sub), p(evidence["balance"])])
    if recent := metrics["recent"]:
        flows.append(p(f'{recent["start"]} – {recent["end"]} · Opad {number(recent["rain_mm"])} mm · '
                       f'Potrzeby uprawy {number(recent["etc_mm"])} mm · Dane z {recent["samples"]} z {recent["days"]} dni.', tiny))
    flows.append(p("Ile wody może zatrzymać gleba przy korzeniach?", sub))
    if report["agricultural"] and (root := metrics["root"]):
        flows.append(p(f'Modelowana pojemność strefy korzeni wynosi {number(root["taw_mm"])} mm. '
                       f'Szacowany ubytek to {number(root["initially_wet"]["depletion_mm"])} mm przy wilgotnej glebie '
                       f'na początku i {number(root["initially_dry"]["depletion_mm"])} mm przy suchej.'))
    else:
        flows.append(p("Dla tej daty nie ma oceny zapasu przy korzeniach."))
    history = metrics["history"]
    count = len(history["seasons"])
    flows.extend([p("Co widać na zdjęciu satelitarnym?", sub), p(evidence["satellite"]),
                  p("Czy woda może spływać z pola?", sub), p(evidence["runoff"]),
                  p("Czy takie warunki często się tu powtarzają?", sub),
                  p(f'W {history["negative_seasons"]} z {count} ocenionych sezonów opad był niższy niż parowanie referencyjne.'
                    if count else "Za mało danych, żeby ustalić, jak często powracał niedobór opadów.")])

    flows.append(p("2. Eksperymenty", section))
    if not report.get("experiments"):
        flows.append(p("Dla tej analizy nie zaproponowano eksperymentów."))
    for check in report.get("experiments", ()):
        slug = check["slug"]
        value = report.get("experiment_results", {}).get(slug)
        label = next((o["label"] for o in check["options"] if o["value"] == value),
                     "Brak wyniku lub próba niejednoznaczna")
        flows.extend([p(check["title"], sub), p(check["impact"]), p(f"Wynik próby: {label}.")])
        if conclusion := report.get("experiment_conclusions", {}).get(slug):
            flows.append(p(f"Wniosek z próby: {conclusion}"))

    flows.append(p("3. Co możesz zrobić?", section))
    if not report["recommendations"]:
        flows.append(p("Brak wystarczających podstaw do zaleceń dla wybranej działki i daty."))
    for rec in report["recommendations"]:
        flows.append(p(rec["title"], sub))
        if rec["action"] != rec["title"]:
            flows.append(p(rec["action"]))
        scope = rec.get("location") or {"field": "Całe pole", "point": "Zaznaczone miejsca"}.get(rec.get("scope"))
        flows.append(p(f'Kiedy? {rec["when"]}' + (f" · {scope}" if scope else "")))
        if rec.get("cost") and not rec.get("cost_estimate"):
            flows.append(p(f'Koszt: {rec["cost"]}'))
        for n, step in enumerate(rec.get("steps", ()), start=1):
            flows.append(p(f"{n}. {step}"))
        flows.extend(recommendation_details(rec))
    document.build(flows, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
