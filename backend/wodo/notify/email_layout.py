"""Wspólny szkielet HTML maili Pole Widzenia (tabele i style inline, bo klienty poczty nie wspierają CSS z <style>)."""
from html import escape

from wodo import brand

LOGO_CID = "pwlogo"
LOGO_SRC = f"cid:{LOGO_CID}"
FONT = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"


def esc(text):
    return escape(str(text), quote=True)


def h2(text):
    return f'<h2 style="margin:22px 0 6px;font-size:16px;line-height:22px;color:{brand.FIELD};">{esc(text)}</h2>'


def para(text, muted=False):
    color = brand.MUTED if muted else brand.FOREST
    size = 13 if muted else 15
    return f'<p style="margin:0 0 12px;font-size:{size}px;line-height:22px;color:{color};">{esc(text)}</p>'


def bullets(items):
    lis = "".join(f'<li style="margin:0 0 6px;">{esc(item)}</li>' for item in items)
    return f'<ul style="margin:0 0 12px;padding-left:20px;font-size:15px;line-height:22px;color:{brand.FOREST};">{lis}</ul>'


def callout(text, warn=False):
    bar = brand.ORANGE if warn else brand.LEAF
    return (f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px;">'
            f'<tr><td style="background:{brand.IVORY};border-left:4px solid {bar};padding:10px 14px;'
            f'font-size:15px;line-height:22px;color:{brand.FOREST};">{esc(text)}</td></tr></table>')


def button(label, url):
    """Przycisk w ciemnej zieleni z białym tekstem (kontrast AA; pomarańcz zostaje akcentem)."""
    return (f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;"><tr>'
            f'<td style="background:{brand.FOREST};border-bottom:3px solid {brand.ORANGE};border-radius:6px;">'
            f'<a href="{esc(url)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:700;'
            f'color:{brand.WHITE};text-decoration:none;">{esc(label)}</a></td></tr></table>'
            f'<p style="margin:0 0 4px;font-size:12px;line-height:18px;color:{brand.MUTED};">'
            f'Jeśli przycisk nie działa, skopiuj adres: <a href="{esc(url)}" style="color:{brand.FIELD};">{esc(url)}</a></p>')


def shell(title, body, *, preheader="", note=None, logo_src=LOGO_SRC, settings_url=None):
    """Kompletny dokument HTML: logo, tytuł, treść, stopka z zastrzeżeniem i linkiem do ustawień."""
    settings = settings_url if settings_url is not None else f"{brand.base_url()}/powiadomienia"
    footer = note or brand.DISCLAIMER
    return (
        '<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<meta name="color-scheme" content="light"><title>{esc(title)}</title></head>'
        f'<body style="margin:0;padding:0;background:{brand.SOFT};font-family:{FONT};">'
        f'<span style="display:none;max-height:0;overflow:hidden;opacity:0;">{esc(preheader)}</span>'
        f'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{brand.SOFT};">'
        '<tr><td align="center" style="padding:24px 12px;">'
        f'<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;'
        f'background:{brand.WHITE};border:1px solid {brand.BORDER};border-radius:10px;overflow:hidden;">'
        f'<tr><td style="background:{brand.IVORY};padding:18px 28px;border-bottom:4px solid {brand.ORANGE};">'
        f'<img src="{esc(logo_src)}" alt="Pole Widzenia" width="150" height="72" '
        'style="display:block;border:0;height:auto;max-width:150px;"></td></tr>'
        f'<tr><td style="padding:26px 28px 8px;"><h1 style="margin:0 0 14px;font-size:22px;line-height:28px;'
        f'color:{brand.FOREST};">{esc(title)}</h1>{body}</td></tr>'
        f'<tr><td style="padding:14px 28px 22px;border-top:1px solid {brand.BORDER};font-size:12px;line-height:18px;'
        f'color:{brand.MUTED};">{esc(footer)}<br>Wiadomość wysłano automatycznie. '
        f'<a href="{esc(settings)}" style="color:{brand.FIELD};">Ustawienia powiadomień</a> · '
        f'<a href="{esc(brand.base_url())}" style="color:{brand.FIELD};">Pole Widzenia</a></td></tr>'
        '</table></td></tr></table></body></html>'
    )
