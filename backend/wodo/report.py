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


class Timeline(Flowable):
    def __init__(self, seasons):
        super().__init__()
        self.seasons = seasons
        self.width, self.height = 487, 105

    def draw(self):
        canvas = self.canv
        values = [s["balance_mm"] for s in self.seasons]
        magnitude = max((abs(x) for x in values), default=1) or 1
        offset, usable = 12, self.width - 24
        step = usable / max(len(values), 1)
        canvas.setStrokeColor(colors.HexColor("#a8b9b0"))
        canvas.line(offset, 60, offset + usable, 60)
        canvas.setFont("Wodo", 8)
        for i, (season, value) in enumerate(zip(self.seasons, values, strict=True)):
            x = offset + step * (i + .5)
            height = value / magnitude * 33
            canvas.setFillColor(GREEN if value >= 0 else colors.HexColor("#bc6843"))
            canvas.rect(x - 10, min(60, 60 + height), 20, abs(height), fill=1, stroke=0)
            canvas.setFillColor(INK)
            canvas.drawCentredString(x, 12, str(season["year"]))
            canvas.drawCentredString(x, 62 + max(height, 0), f"{value:+g}")


def pdf(report):
    if "Wodo" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("Wodo", str(FONT_DIR / "DejaVuSans.ttf")))
        pdfmetrics.registerFont(TTFont("WodoBold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))
    styles = getSampleStyleSheet()
    body = ParagraphStyle("text", parent=styles["BodyText"], fontName="Wodo", fontSize=9.5,
                          textColor=INK, leading=14, spaceAfter=5, splitLongWords=True)
    title = ParagraphStyle("title", parent=body, fontName="WodoBold", fontSize=24, leading=30)
    section = ParagraphStyle("section", parent=body, fontName="WodoBold", fontSize=14, leading=19, spaceBefore=13)
    sub = ParagraphStyle("sub", parent=body, fontName="WodoBold", fontSize=11, leading=15)
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

    parcel, metrics = report["parcel"], report["metrics"]
    flows = [p("WODOSTRAŻNIK / RAPORT DZIAŁKI", tiny), p("Stan wody na Twojej działce", title),
             p(f"Analiza {report['date']} · {metrics['crop']['label']} · {metrics['stage']}"), Spacer(1, 8)]
    context = [p(parcel["id"], sub), p(f'{parcel["area_ha"]:g} ha · {parcel["commune"] or "wskazana geometria"}'),
               p(f'Źródło granicy: {parcel["source"]}.', tiny), p(f'Ryzyko: {metrics["risk"]}', sub),
               p(f'Pewność oceny: {report["confidence"].lower()}')]
    table = Table([[ParcelMap(parcel), context]], colWidths=[185, 300])
    table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    flows.append(table)
    if recent := metrics["recent"]:
        flows.extend([p("Sytuacja wodna", section),
                      p(f'{recent["start"]} – {recent["end"]}. Opad {recent["rain_mm"]:g} mm. ET₀ {recent["et0_mm"]:g} mm. '
                        f'Zapotrzebowanie uprawy ETc {recent["etc_mm"]:g} mm. Bilans opad − ETc {recent["crop_balance_mm"]:+g} mm. '
                        f'Najdłuższy ciąg z opadem <1 mm: {recent["dry_spell_days"]} dni. Dni z kompletem danych: {recent["samples"]}/{recent["days"]}.')])
    if root := metrics["root"]:
        flows.append(p(f'Woda dostępna w strefie korzeni: {root["taw_mm"]:g} mm. Próg łatwej dostępności: {root["raw_mm"]:g} mm. '
                       f'Ubytek w dwóch wariantach początkowych: {root["initially_wet"]["depletion_mm"]:g}–'
                       f'{root["initially_dry"]["depletion_mm"]:g} mm.'))
    history = metrics["history"]
    if history["seasons"]:
        flows.extend([p("Historia suszy", section), p("Bilans opad − ET₀ w okresie kwiecień–wrzesień [mm]."),
                      Timeline(history["seasons"]),
                      p(f'Ujemny bilans w {history["negative_seasons"]} z {len(history["seasons"])} sezonów. '
                        f'Miesiące o najniższym typowym bilansie: {", ".join(history["riskiest_months"]) or "brak"}.')])
    flows.append(p("Gleba, roślinność i otoczenie", section))
    for src in report["sources"]:
        if src["key"] == "satellite" and src.get("scene"):
            scene = src["scene"]
            flows.append(p(f'Sentinel-2 ({scene["date"]}) · NDVI {scene["ndvi"]} · NDMI {scene["ndmi"]} · NDWI {scene["ndwi"]}. '
                           f'Użyteczne piksele: {scene["clear_share"]:.0%}. Wskaźniki opisują sygnał spektralny powierzchni.'))
        if src["key"] == "soil":
            depth = src["layer_depths"]
            values = [f"{d}: {layer[0]:g}/{layer[1]:g}" for d, layer in zip(depth, src["layers"], strict=True) if layer]
            flows.append(p("SoilGrids, retencja przy 33/1500 kPa [mm/m] · " + ", ".join(values)))
        if src["key"] == "terrain":
            flows.append(p(f'Wysokość {src["elevation_m"]} m. Nachylenie: {src["slope_pct"] if src["slope_pct"] is not None else "brak wiarygodnego odczytu"} %.'))
        if src["key"] == "land":
            water = src["nearest_water_m"]
            flows.append(p("Pokrycie 2021 · " + ", ".join(f'{c["class"]} {c["percent"]:g}%' for c in src["classes"])
                           + (f". Wykryta stała woda ~{water} m od granicy." if water is not None else
                              f'. W promieniu {src["search_m"]} m nie wykryto pikseli stałej wody.')))
        if src["key"] == "gauge":
            flows.append(p(f'Wodowskaz {src["station"]}, {src["river"]}: {src["gauge_cm"]:g} cm. '
                           f'Odległość {src["distance_km"]:g} km. Punktowy odczyt kontekstowy.'))
    flows.append(p("Co możesz zrobić?", section))
    if not report["recommendations"]:
        flows.append(p("Brak wystarczających podstaw do zaleceń dla wybranych danych i użytkowania."))
    for rec in report["recommendations"]:
        flows.append(KeepTogether([p(rec["title"], sub), p(rec["action"]), p(rec["why"]),
                                    p(rec["evidence"]), p(f'{rec["when"]} · Pewność {rec["confidence"]}. {rec["limits"]}', tiny)]))
    if scenario := report["scenario"]:
        low, high = scenario["depletion_reduction_mm"]
        flows.extend([p("Co jeśli? Symulacja", section), p(f'Dodatkowe {scenario["input_mm"]:g} mm: zmniejszenie ubytku o {low:g}–{high:g} mm. {scenario["note"]}')])
    flows.extend([p("Źródła, metody i ograniczenia", section), p("ET₀ wg FAO-56, z uproszczeniem Hargreavesa przy oznaczonych brakach. Bilans opadu i ewapotranspiracji pokazuje "
        "warunki modelowe. Gleba jest predykcją przestrzenną. Nawadnianie, spływ, poziom wód gruntowych i stan rowów "
        "mogą odbiegać od obliczeń. Przed pracami terenowymi sprawdź warunki na działce.", tiny)])
    for key, reason in report["missing"].items():
        flows.append(p(f"{key} · {reason}", tiny))
    for src in report["sources"]:
        coverage = ", ".join(str(d) for d in src.get("coverage", []) if d)
        flows.extend([p(f'{src["name"]} · {src["kind"]} · {src["resolution"]}', sub),
                      p(f'Pobrano {src["retrieved_at"]} · Zasięg: {coverage or "punkt/produkt statyczny"} · '
                        f'Publikacja: {src.get("publication_date") or "brak daty w metadanych"}', tiny),
                      p(src["url"], tiny)])
        if src.get("attribution"):
            flows.append(p(src["attribution"], tiny))
    flows.append(p(f'Realizacja: {report["created_at"]} · Metoda {report["model_version"]} · {report["analysis_id"]}', tiny))
    document.build(flows, onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
