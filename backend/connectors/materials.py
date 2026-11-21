"""Bounded downloads from the public pages used by procurement and BIP."""

import re
from html.parser import HTMLParser
from http.cookiejar import CookieJar
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urljoin, urlsplit
from urllib.request import (
    HTTPCookieProcessor,
    HTTPRedirectHandler,
    Request,
    build_opener,
)

from connectors.public import FetchError

PLATFORMS = frozenset(
    {"platformazakupowa.pl", "www.platformazakupowa.pl", "ezamowienia.gov.pl"}
)
PROCUREMENT = re.compile(
    r"https://(?:www\.)?platformazakupowa\.pl/transakcja/\d+|https://ezamowienia\.gov\.pl/mp-client/search/list/ocds-148610-[0-9a-f-]{36}",
    re.I,
)
DOCUMENT_TYPES = {
    "STWIORB": r"stwi?or?b|specyfikacj\w+ techniczn",
    "PFU": r"\bpfu\b|funkcjonalno.użytkowy",
    "OPZ": r"\bopz\b|opis przedmiotu",
    "PPU": r"\bppu\b|wzór umowy|projektowane postanowienia",
    "modification": r"modyfikacj|zmian\w+.*swz",
    "qa": r"odpowiedzi na pytania|odpowiedź na pytani|wyjaśnieni",
    "SWZ": r"\bswz\b|warunków zamówienia",
}


def allowed(url, hosts):
    try:
        parsed = urlsplit(url)
        return (
            parsed.scheme == "https"
            and parsed.hostname in hosts
            and parsed.port in (None, 443)
            and parsed.username is None
            and not any(char.isspace() or char == "\\" for char in url)
        )
    except ValueError:
        return False


class HostRedirect(HTTPRedirectHandler):
    def __init__(self, hosts):
        self.hosts = hosts

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if not allowed(newurl, self.hosts):
            raise FetchError(req.full_url, "Przekierowanie poza zatwierdzone źródło.")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def download(url, hosts, limit=10_485_760, *, opener=None, body=None):
    if not allowed(url, hosts):
        raise FetchError(url, "Adres musi należeć do zatwierdzonego źródła HTTPS.")
    try:
        request = Request(url, data=body, headers={"User-Agent": "RiskMiner/0.2"})
        with (opener or build_opener(HostRedirect(hosts))).open(
            request, timeout=12
        ) as response:
            data = response.read(limit + 1)
            if len(data) > limit:
                raise FetchError(url, "Materiał przekracza limit pobierania.")
            filename = response.headers.get_filename()
            if filename:
                try:
                    filename = filename.encode("latin-1").decode("utf-8")
                except UnicodeError:
                    pass
            charset = response.headers.get_content_charset() or "utf-8"
            return data, filename, charset
    except HTTPError as exc:
        if exc.code in {404, 410}:
            return b"", None, "utf-8"
        raise FetchError(url, f"Źródło zwróciło HTTP {exc.code}.") from exc
    except (OSError, URLError, TimeoutError, ValueError) as exc:
        raise FetchError(url, "Nie udało się pobrać materiału publicznego.") from exc


class Page(HTMLParser):
    def __init__(self, body):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.text = []
        self.current = None
        self.hidden = False
        self.row = None
        self.first_cell = False
        self.inputs = {}
        self.feed(body)

    def handle_starttag(self, tag, attrs):
        fields = dict(attrs)
        if tag == "tr":
            self.row = []
            self.first_cell = True
        if tag == "input" and fields.get("name"):
            self.inputs[fields["name"]] = fields.get("value", "")
        if tag == "a" and fields.get("href"):
            self.current = [
                fields["href"],
                fields.get("title") or " ".join(self.row or ()),
            ]
        if tag in {"script", "style"}:
            self.hidden = True

    def handle_endtag(self, tag):
        if tag == "a" and self.current:
            address, title = self.current
            self.links.append((address, " ".join(title.split())))
            self.current = None
        if tag in {"script", "style"}:
            self.hidden = False
        if tag == "td":
            self.first_cell = False
        if tag == "tr":
            self.row = None

    def handle_data(self, data):
        if not self.hidden:
            self.text.append(data)
            if self.first_cell and self.row is not None:
                self.row.append(data)
            if self.current:
                self.current[1] += f" {data}"


def document_type(filename):
    return next(
        (
            kind
            for kind, pattern in DOCUMENT_TYPES.items()
            if re.search(pattern, filename, re.I)
        ),
        "other",
    )


def attachment_name(url, text, headers=None):
    for value in (headers, text, unquote(urlsplit(url).path.rsplit("/", 1)[-1])):
        if value and (
            name := re.search(r"([^/\\<>\r\n]+?\.(?:docx?|pdf))\b", value, re.I)
        ):
            return name[1].strip()
    return None


def page_materials(url, hosts, *, procurement=False, limit=6):
    redirect_hosts = hosts
    if urlsplit(url).hostname in {"platformazakupowa.pl", "www.platformazakupowa.pl"}:
        redirect_hosts = hosts | {"accounts.opennexus.com"}
    opener = build_opener(
        HostRedirect(redirect_hosts), HTTPCookieProcessor(CookieJar())
    )
    content, filename, charset = download(url, hosts, opener=opener)
    if not content:
        return
    if content.startswith(b"%PDF-") or filename and attachment_name(url, "", filename):
        yield url, attachment_name(url, "", filename) or "dokument.pdf", content
        return
    try:
        page = Page(content.decode(charset, errors="replace"))
    except LookupError as exc:
        raise FetchError(url, "Nieznane kodowanie strony.") from exc
    if not procurement:
        # Preserve page context as well as available document versions.
        yield url, None, " ".join(" ".join(page.text).split())[:32000]
    candidates = {}
    for href, title in page.links:
        address = urljoin(url, href)
        if not allowed(address, hosts):
            continue
        name = attachment_name(address, title)
        path = urlsplit(address).path
        kio_pdf = re.fullmatch(r"/Home/PdfContent/\d+", path, re.I)
        if urlsplit(url).hostname == "orzeczenia.uzp.gov.pl" and not kio_pdf:
            continue
        if name or kio_pdf or re.fullmatch(r"/attachment/[\da-f-]+", path):
            kind = document_type(name or title)
            relevant = kind != "other" and (
                kind != "SWZ"
                or not re.search(
                    r"załącznik|formularz|oświadczenie", name or title, re.I
                )
            )
            if relevant or not procurement:
                candidates.setdefault(
                    address, name or ("Orzeczenie KIO.pdf" if kio_pdf else None)
                )
    for address, name in list(candidates.items())[:limit]:
        try:
            file_data, header, _ = download(address, hosts, opener=opener)
            name = attachment_name(address, name or "", header)
            if name and file_data:
                yield address, name, file_data
        except FetchError as exc:
            yield exc
