"""Wspólne klocki PDF w barwach Pole Widzenia: czcionki, style, nagłówek/stopka, okładka, QR, wykresy."""
from datetime import datetime
from io import BytesIO
from xml.sax.saxutils import escape
from zoneinfo import ZoneInfo

from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import (
    Flowable,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from wodo import brand

FOREST, FIELD, LEAF, ORANGE = (colors.HexColor(c) for c in (brand.FOREST, brand.FIELD, brand.LEAF, brand.ORANGE))
IVORY, SOFT, BORDER, MUTED = (colors.HexColor(c) for c in (brand.IVORY, brand.SOFT, brand.BORDER, brand.MUTED))
PAGE_W, PAGE_H = A4
MARGIN = 52
CONTENT_W = PAGE_W - 2 * MARGIN
WARSAW = ZoneInfo("Europe/Warsaw")


def register_fonts():
    if "Wodo" not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(TTFont("Wodo", str(brand.FONTS / "DejaVuSans.ttf")))
        pdfmetrics.registerFont(TTFont("WodoBold", str(brand.FONTS / "DejaVuSans-Bold.ttf")))
        pdfmetrics.registerFontFamily("Wodo", normal="Wodo", bold="WodoBold", italic="Wodo", boldItalic="WodoBold")


def now_label():
    return datetime.now(WARSAW).strftime("%d.%m.%Y %H:%M")


def styles():
    register_fonts()
    base = getSampleStyleSheet()["BodyText"]
    body = ParagraphStyle("text", parent=base, fontName="Wodo", fontSize=9.5, textColor=FOREST,
                          leading=14, spaceAfter=5, splitLongWords=True)
    return {
        "body": body,
        "title": ParagraphStyle("title", parent=body, fontName="WodoBold", fontSize=24, leading=29,
                                textColor=FOREST, spaceAfter=2),
        "lead": ParagraphStyle("lead", parent=body, fontSize=10.5, leading=15, textColor=MUTED),
        "section": ParagraphStyle("section", parent=body, fontName="WodoBold", fontSize=14, leading=19,
                                  spaceBefore=14, spaceAfter=4, keepWithNext=True, textColor=FIELD),
        "sub": ParagraphStyle("sub", parent=body, fontName="WodoBold", fontSize=11, leading=15,
                              keepWithNext=True, spaceBefore=4),
        "tiny": ParagraphStyle("small", parent=body, fontSize=8, leading=11, textColor=MUTED),
        "reading": ParagraphStyle("reading", parent=body, fontSize=12, leading=18, spaceAfter=7),
        "cell": ParagraphStyle("cell", parent=body, fontSize=8.5, leading=11, spaceAfter=0),
        "cellhead": ParagraphStyle("cellhead", parent=body, fontName="WodoBold", fontSize=8.5, leading=11,
                                   spaceAfter=0, textColor=colors.white),
    }


def p(text, style):
    return Paragraph(escape(str(text)), style)


class Banner(Flowable):
    """Okładka: kremowa karta z logo i napisem, tytułem i pomarańczowym akcentem."""

    def __init__(self, title, subtitle, kind, width=CONTENT_W, height=118):
        super().__init__()
        self.title, self.subtitle, self.kind = title, subtitle, kind
        self.width, self.height = width, height

    def wrap(self, *_):
        return self.width, self.height

    def draw(self):
        c = self.canv
        c.setFillColor(IVORY)
        c.setStrokeColor(BORDER)
        c.roundRect(0, 0, self.width, self.height, 10, fill=1, stroke=1)
        c.setFillColor(ORANGE)
        c.rect(0, 0, 7, self.height, fill=1, stroke=0)
        logo_h = 64
        c.drawImage(ImageReader(str(brand.LOGO_WORDMARK)), 24, self.height - logo_h - 14,
                    width=logo_h * brand.LOGO_WORDMARK_ASPECT, height=logo_h, mask="auto")
        c.setFillColor(LEAF)
        c.setFont("WodoBold", 8)
        c.drawRightString(self.width - 16, self.height - 24, self.kind.upper())
        c.setFillColor(FOREST)
        c.setFont("WodoBold", 20)
        c.drawString(24, 34, self.title)
        c.setFillColor(MUTED)
        c.setFont("Wodo", 9.5)
        c.drawString(24, 16, self.subtitle)


def header_footer(doc_label):
    """Nagłówek i stopka każdej strony; numer „X z Y” dopisuje `NumberedCanvas`."""
    def draw(canvas, doc):
        canvas.saveState()
        if doc.page > 1:
            canvas.drawImage(ImageReader(str(brand.LOGO)), MARGIN, PAGE_H - 36, width=16 * brand.LOGO_ASPECT,
                             height=16, mask="auto")
            canvas.setFont("WodoBold", 8.5)
            canvas.setFillColor(FOREST)
            canvas.drawString(MARGIN + 22, PAGE_H - 30, brand.APP_NAME)
            canvas.setFont("Wodo", 8.5)
            canvas.setFillColor(MUTED)
            canvas.drawRightString(PAGE_W - MARGIN, PAGE_H - 30, doc_label)
            canvas.setStrokeColor(ORANGE)
            canvas.setLineWidth(1.2)
            canvas.line(MARGIN, PAGE_H - 40, PAGE_W - MARGIN, PAGE_H - 40)
        canvas.setStrokeColor(BORDER)
        canvas.setLineWidth(0.6)
        canvas.line(MARGIN, 38, PAGE_W - MARGIN, 38)
        canvas.setFont("Wodo", 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(MARGIN, 27, brand.DISCLAIMER[:118])
        canvas.drawString(MARGIN, 18, f"{brand.APP_NAME} · wygenerowano {now_label()}")
        canvas.restoreState()
    return draw


class NumberedCanvas(Canvas):
    """Numeruje strony jako „Strona X z Y” (liczba stron znana dopiero na końcu)."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved = []

    def showPage(self):  # noqa: N802
        self._saved.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._saved)
        for state in self._saved:
            self.__dict__.update(state)
            self.setFont("Wodo", 8)
            self.setFillColor(MUTED)
            self.drawRightString(PAGE_W - MARGIN, 18, f"Strona {self._pageNumber} z {total}")
            super().showPage()
        super().save()


def build(flows, title, doc_label, author="Pole Widzenia"):
    register_fonts()
    buf = BytesIO()
    document = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN, topMargin=54,
                                 bottomMargin=50, title=title, author=author, subject=doc_label,
                                 lang="pl-PL")
    draw = header_footer(doc_label)
    document.build(flows, onFirstPage=draw, onLaterPages=draw, canvasmaker=NumberedCanvas)
    return buf.getvalue()


def table(rows, widths, st, header=True, align_right=(), zebra=True):
    """Tabela w barwach marki. Komórki są tekstem (zamieniane na akapity), nagłówek zielony."""
    data = [[Paragraph(escape(str(cell)), st["cellhead"] if header and i == 0 else st["cell"]) for cell in row]
            for i, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("GRID", (0, 0), (-1, -1), 0.4, BORDER),
             ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]
    if header:
        style.append(("BACKGROUND", (0, 0), (-1, 0), FIELD))
    if zebra:
        style += [("BACKGROUND", (0, r), (-1, r), SOFT) for r in range(1 if header else 0, len(rows), 2)]
    for col in align_right:
        for r in range(len(rows)):
            data[r][col].style = ParagraphStyle("r", parent=data[r][col].style, alignment=2)
    t.setStyle(TableStyle(style))
    return t


def meta_table(pairs, st, qr=None, width=CONTENT_W):
    """Metryka dokumentu: pary „etykieta — wartość”, opcjonalnie kod QR po prawej."""
    rows = [[Paragraph(f'<font color="{brand.MUTED}">{escape(k)}</font>', st["cell"]), p(v, st["cell"])]
            for k, v in pairs if v not in (None, "")]
    left = Table(rows, colWidths=[88, width - 88 - (92 if qr else 0)])
    left.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -1), 0.3, BORDER),
                              ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3)]))
    if not qr:
        return left
    outer = Table([[left, qr]], colWidths=[width - 92, 92])
    outer.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    return outer


def qr_block(url, caption, st, size=76):
    """Kod QR z podpisem; `None`, gdy nie ma publicznego adresu (kod pod localhost nic by nie dał)."""
    if not url:
        return None
    widget = QrCodeWidget(url, barBorder=1, barFillColor=FOREST)
    x0, y0, x1, y1 = widget.getBounds()
    drawing = Drawing(size, size, transform=[size / (x1 - x0), 0, 0, size / (y1 - y0), 0, 0])
    drawing.add(widget)
    caption_style = ParagraphStyle("qrcap", parent=st["tiny"], fontSize=6.5, leading=8, alignment=1)
    block = Table([[drawing], [Paragraph(escape(caption), caption_style)]], colWidths=[88])
    block.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                               ("RIGHTPADDING", (0, 0), (-1, -1), 0), ("TOPPADDING", (0, 0), (-1, -1), 0),
                               ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
    return block


def callout(text, st, tone="info"):
    """Wyróżniony akapit (info: zieleń, uwaga: pomarańcz)."""
    color = ORANGE if tone == "warn" else LEAF
    t = Table([[p(text, st["body"])]], colWidths=[CONTENT_W])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), IVORY), ("LINEBEFORE", (0, 0), (0, -1), 3, color),
                           ("LEFTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 6),
                           ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    return t


def bar_chart(labels, series, names, title, width=CONTENT_W, height=150, unit="mm"):
    """Słupki grupowane w barwach marki (zieleń, pomarańcz). `series` to lista list liczb."""
    drawing = Drawing(width, height + 18)
    drawing.add(String(0, height + 6, title, fontName="WodoBold", fontSize=9, fillColor=FOREST))
    chart = VerticalBarChart()
    chart.x, chart.y, chart.width, chart.height = 38, 22, width - 50, height - 28
    chart.data = series
    chart.categoryAxis.categoryNames = labels
    chart.categoryAxis.labels.fontName = chart.valueAxis.labels.fontName = "Wodo"
    chart.categoryAxis.labels.fontSize = chart.valueAxis.labels.fontSize = 7.5
    chart.categoryAxis.labels.dy = -2
    chart.valueAxis.valueMin = min(0, min(min(s) for s in series)) if series and series[0] else 0
    chart.valueAxis.gridStrokeColor = BORDER
    chart.valueAxis.visibleGrid = True
    chart.categoryAxis.strokeColor = chart.valueAxis.strokeColor = BORDER
    chart.groupSpacing = 6
    chart.barSpacing = 1
    for i, fill in enumerate((FIELD, ORANGE, LEAF)[:len(series)]):
        chart.bars[i].fillColor = fill
        chart.bars[i].strokeColor = None
    drawing.add(chart)
    x = width - 8
    for i, name in reversed(list(enumerate(names))):
        w = pdfmetrics.stringWidth(name, "Wodo", 7.5)
        x -= w
        drawing.add(String(x, height + 6, name, fontName="Wodo", fontSize=7.5, fillColor=MUTED))
        drawing.add(String(x - 9, height + 6, "■", fontName="WodoBold", fontSize=8,
                           fillColor=(FIELD, ORANGE, LEAF)[i]))
        x -= 20
    drawing.add(String(0, 4, f"Jednostka: {unit}", fontName="Wodo", fontSize=7, fillColor=MUTED))
    return drawing


def spacer(h=6):
    return Spacer(1, h)
