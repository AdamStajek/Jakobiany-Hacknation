"""Marka „Pole Widzenia”: kolory (te same co w `frontend/src/styles.css`), logo i adresy publiczne."""
import os
from pathlib import Path
from urllib.parse import urlparse

APP_NAME = "Pole Widzenia"
DISCLAIMER = "Wskazówki pomocnicze oparte na modelu i danych publicznych. Nie zastępują oceny na polu ani zalecenia zabiegu."

# Paleta marki (hex bez zależności od ReportLab, żeby korzystały z niej także maile HTML).
FOREST = "#0D2A00"
DEEP_GREEN = "#103101"
FIELD = "#385A15"
LEAF = "#778C12"
ORANGE = "#EE8106"
IVORY = "#F7F6EE"
SOFT = "#EEF1E8"
BORDER = "#D8DFCF"
MUTED = "#506047"
WHITE = "#FFFFFF"

ASSETS = Path(__file__).parent / "assets"
LOGO = ASSETS / "logo.png"
LOGO_WORDMARK = ASSETS / "logo-napis.png"
LOGO_ASPECT = 321 / 344
LOGO_WORDMARK_ASPECT = 722 / 344
FONTS = ASSETS / "fonts"

LOCAL_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "::1", ""}


def base_url():
    return os.environ.get("WODO_PUBLIC_URL", "http://localhost:4200").rstrip("/")


def is_public_url(url=None):
    """Czy adres da się otworzyć z telefonu. Pod `localhost` kod QR byłby bezużyteczny."""
    host = urlparse(url or base_url()).hostname or ""
    return host not in LOCAL_HOSTS and not host.endswith(".local")


def public_link(path=""):
    """Pełny link do aplikacji albo `None`, gdy publiczny adres nie jest ustawiony (wtedy bez kodu QR)."""
    return f"{base_url()}/{path.lstrip('/')}" if is_public_url() else None
