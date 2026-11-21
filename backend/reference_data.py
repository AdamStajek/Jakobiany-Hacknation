"""Import versioned public files into the same database used by the API."""

import argparse
import csv
import re
from contextlib import nullcontext
from hashlib import sha256
from http.cookiejar import CookieJar
from io import BytesIO, StringIO
from pathlib import Path
from urllib.parse import unquote, urlencode, urlsplit
from urllib.request import HTTPCookieProcessor, build_opener
from zipfile import ZipFile

from openpyxl import load_workbook
from pypdf import PdfReader
from xlrd import open_workbook

from connectors.materials import HostRedirect, Page, download
from connectors.public import FetchError
from connectors.registers import BDL_CODES, bdl
from intake import seed_rules
from store import (
    connect,
    find,
    fingerprint,
    identifier,
    new_database,
    projects,
    put,
    source,
    target_path,
    verify_database,
)

TERYT = "https://eteryt.stat.gov.pl/eTeryt/rejestr_teryt/udostepnianie_danych/baza_teryt/uzytkownicy_indywidualni/pobieranie/pliki_pelne.aspx"
KPOSK = "https://www.gov.pl/attachment/b303fb7a-9689-4228-b9b6-3d18e4a7321e"
FUNDING = "https://funduszeeuropejskie.gov.pl/projekty/"
PRICES = "https://stat.gov.pl/obszary-tematyczne/ceny-handel/wskazniki-cen/"
FUNDING_ID = re.compile(
    r"\b[A-Z]{4}\.\d{2}\.\d{2}-[A-Z0-9]{2}\.\d{2}-[A-Z0-9]{4}/\d{2}\b", re.I
)


def key_for(value):
    return re.sub(r"\s+", "", str(value)).upper()


def table(sheet, row):
    return {"kind": "table", "sheet": sheet, "row": row}


def download_teryt():
    hosts = {"eteryt.stat.gov.pl"}
    opener = build_opener(HostRedirect(hosts), HTTPCookieProcessor(CookieJar()))
    content, _, charset = download(TERYT, hosts, opener=opener)
    fields = Page(content.decode(charset, errors="replace")).inputs
    keys = {"__VIEWSTATE", "__VIEWSTATEGENERATOR", "ctl00$body$TBData"}
    if not keys <= fields.keys():
        raise FetchError(TERYT, "Nie rozpoznano formularza pobierania TERC.")
    data = {key: fields[key] for key in keys}
    data["__EVENTTARGET"] = "ctl00$body$BTERCUrzedowyPobierz"
    data["__EVENTARGUMENT"] = ""
    if "__EVENTVALIDATION" in fields:
        data["__EVENTVALIDATION"] = fields["__EVENTVALIDATION"]
    return download(TERYT, hosts, opener=opener, body=urlencode(data).encode())[0]


def parse_teryt(content):
    if content.startswith(b"PK"):
        with ZipFile(BytesIO(content)) as zipped:
            file = next(
                (
                    item
                    for item in zipped.infolist()
                    if re.search(r"TERC.*\.csv$", item.filename, re.I)
                ),
                None,
            )
            if not file or file.file_size > 5_000_000:
                raise ValueError("Oczekiwano archiwum TERC CSV.")
            content = zipped.read(file)
    try:
        data = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        data = content.decode("cp1250")
    rows = csv.DictReader(StringIO(data), delimiter=";")
    fields = set(rows.fieldnames or [])
    type_column = "NAZWA_DOD" if "NAZWA_DOD" in fields else "NAZDOD"
    if not {"WOJ", "POW", "GMI", "RODZ", "NAZWA", type_column, "STAN_NA"} <= fields:
        raise ValueError("Nagłówki TERC nie pasują do formatu GUS.")
    for n, row in enumerate(rows, 2):
        code = "".join(row[field].strip() for field in ("WOJ", "POW", "GMI", "RODZ"))
        name = row["NAZWA"]
        if re.fullmatch(r"\d{2}(?:\d{2}(?:\d{3})?)?", code) and name:
            yield (
                code,
                name,
                {
                    "kod": code,
                    "nazwa": name,
                    "typ": row[type_column],
                    "stan_na": row["STAN_NA"],
                },
                table("TERC", n),
            )


def sheets(content, *, columns=144):
    if content.startswith(bytes.fromhex("d0cf11e0a1b11ae1")):
        with open_workbook(file_contents=content, on_demand=True) as book:
            for sheet in book.sheets():
                yield (
                    sheet.name,
                    (sheet.row_values(n, end_colx=columns) for n in range(sheet.nrows)),
                )
    else:
        with ZipFile(BytesIO(content)) as zipped:
            if sum(file.file_size for file in zipped.infolist()) > 900_000_000:
                raise ValueError("Rozpakowany arkusz przekracza dopuszczalną wielkość.")
        book = load_workbook(
            BytesIO(content), read_only=True, data_only=True, keep_links=False
        )
        try:
            for sheet in book.worksheets:
                yield sheet.title, sheet.iter_rows(max_col=columns, values_only=True)
        finally:
            book.close()


def parse_kposk(content):
    for sheet, rows in sheets(content):
        for n, row in enumerate(rows, 1):
            code = str(row[0]).strip().upper()
            if not re.fullmatch(r"PL[A-Z]{2}\d{3,4}[A-Z]{0,2}", code) or not row[1]:
                continue
            fields = {
                "aglomeracja": row[1],
                "województwo": row[2],
                "gmina wiodąca": row[6],
                "gminy w aglomeracji": row[7],
                "uchwała": row[9],
                "RLM": row[11],
                "km kanalizacji": row[19],
            }
            yield code, str(row[1]), fields, table(sheet, n)


def parse_funding(content):
    if content.startswith(b"%PDF-"):
        doc = PdfReader(BytesIO(content))
        for page, leaf in enumerate(doc.pages, 1):
            text = leaf.extract_text() or ""
            matches = list(FUNDING_ID.finditer(text))
            for i, item in enumerate(matches):
                start = text.rfind("\n", 0, item.start()) + 1
                next_id = matches[i + 1].start() if i + 1 < len(matches) else len(text)
                end = (
                    text.rfind("\n", item.end(), next_id)
                    if i + 1 < len(matches)
                    else next_id
                )
                nearby = text[
                    start : max(
                        item.end(), min(end if end >= 0 else next_id, item.end() + 400)
                    )
                ]
                yield (
                    key_for(item[0]),
                    item[0],
                    {"fragment": nearby.strip()},
                    {"kind": "pdf_page", "page": page},
                )
        return
    if content.lstrip()[:32].lower().startswith((b"<!doctype", b"<html")):
        page = Page(content.decode("utf-8", errors="replace"))
        text = " ".join(" ".join(page.text).split())
        for item in FUNDING_ID.finditer(text):
            yield (
                key_for(item[0]),
                item[0],
                {"fragment": text[max(0, item.start() - 140) : item.end() + 520]},
                {"kind": "record_field", "field": "Treść strony"},
            )
        return
    if content.startswith((b"PK", bytes.fromhex("d0cf11e0a1b11ae1"))):
        groups = sheets(content, columns=75)
    else:
        raw = content.decode("utf-8-sig")
        delimiter = (
            ";"
            if raw.partition("\n")[0].count(";") > raw.partition("\n")[0].count(",")
            else ","
        )
        groups = [("Eksport", csv.reader(StringIO(raw), delimiter=delimiter))]
    for sheet, rows in groups:
        headers = ()
        for n, row in enumerate(rows, 1):
            cells = [str(value or "").strip() for value in row]
            found = next(
                (value for value in cells if FUNDING_ID.fullmatch(value)), None
            )
            if not found:
                if not headers and any(
                    "beneficjent" in cell.casefold()
                    or "tytuł projektu" in cell.casefold()
                    for cell in cells
                ):
                    headers = cells
                continue
            fields = {}
            for i, value in enumerate(cells):
                if not value:
                    continue
                label = headers[i] if i < len(headers) else ""
                if value == found or re.search(
                    r"beneficjent|tytuł|dofinansow|finansow|wartość|data |gmina|program",
                    label,
                    re.I,
                ):
                    fields[label or "Numer projektu"] = value
            yield key_for(found), found, fields, table(sheet, n)


def parse_prices(content, period):
    for sheet, rows in sheets(content, columns=30):
        columns = None
        for n, row in enumerate(rows, 1):
            if row and str(row[0]).strip() == "WYSZCZEGÓLNIENIE":
                year, month = period.split("-")
                columns = next(
                    (
                        i
                        for i, r in enumerate(row)
                        if str(r).strip() == f"{month} {year}"
                    ),
                    None,
                )
                continue
            if columns is None or len(row) <= columns + 1:
                continue
            label = " ".join(str(row[0]).split())
            if not re.search(
                r"obiektów inżynierii lądowej i wodnej|^ogółem$", label, re.I
            ):
                continue
            if not label:
                continue
            try:
                year_value, month_value = (
                    float(str(v).rstrip("*").replace(",", "."))
                    for v in row[columns : columns + 2]
                )
            except ValueError:
                continue
            fields = {
                "okres": period,
                "kategoria": label,
                "wskaźnik (poprzedni miesiąc = 100)": month_value,
                "wskaźnik (analogiczny miesiąc = 100)": year_value,
            }
            yield (
                f"{period}:{'inzynieria' if 'inżynierii' in label.lower() else 'ogolem'}",
                label,
                fields,
                table(sheet, n),
            )


def reference(db, provider, key):
    value = find(db, "reference_data", identifier("reference", provider, key))
    return value[0] if value else None


def save_reference(db, provider, origin, rows):
    count = 0
    for key, label, value, locator in rows:
        rid = identifier("reference", provider, key)
        prior = find(db, "reference_data", rid)
        if prior and prior[0]["source"]["id"] != origin["id"]:
            old = prior[0]
            put(
                db,
                "reference_revision",
                {
                    **old,
                    "id": identifier("reference_revision", rid, old["source"]["id"]),
                },
            )
            if old["source"]["retrieved_at"] > origin["retrieved_at"]:
                count += 1
                continue
        put(
            db,
            "reference_data",
            {
                "id": rid,
                "provider": provider,
                "key": key,
                "label": label,
                "value": value,
                "locator": locator,
                "source": origin,
            },
        )
        count += 1
    return count


def ingest(db, provider, content, url, name, period=None, selected=None):
    parsers = {"teryt": parse_teryt, "funding": parse_funding, "kposk": parse_kposk}
    rows = (
        parse_prices(content, period)
        if provider == "prices"
        else parsers[provider](content)
    )
    digest = sha256(content).hexdigest()
    origin = source(db, provider, name, digest, original_url=url, name=name)
    return save_reference(
        db,
        provider,
        origin,
        (item for item in rows if selected is None or item[0] in selected),
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "provider", choices=("teryt", "funding", "kposk", "prices", "bdl")
    )
    parser.add_argument("input", nargs="?", type=Path)
    parser.add_argument(
        "--source-url", help="Kanoniczny URL pliku lub publikacji urzędowej."
    )
    parser.add_argument("--period", help="Miesiąc tablicy GUS (RRRR-MM).")
    parser.add_argument(
        "--unit",
        action="append",
        default=[],
        help="Jednostka BDL. Można podać wielokrotnie.",
    )
    parser.add_argument("--db", type=Path, default=target_path())
    args = parser.parse_args()
    provider = args.provider
    if provider == "prices" and (
        not args.period or not re.fullmatch(r"20\d{2}-(0[1-9]|1[0-2])", args.period)
    ):
        parser.error("Podaj --period RRRR-MM dla wskaźników cen.")
    url = args.source_url or {
        "teryt": TERYT,
        "kposk": KPOSK,
        "funding": FUNDING,
        "prices": PRICES,
    }.get(provider)
    records, content, name = [], b"", ""
    if provider == "bdl":
        if (
            not args.unit
            or args.input
            or any(not re.fullmatch(r"\d{12}", unit) for unit in args.unit)
        ):
            parser.error("Wskaż jednostki BDL, np. --unit 011212001063.")
        for unit in dict.fromkeys(args.unit):
            records.extend(bdl(unit, BDL_CODES))
    elif args.input:
        content, name = args.input.read_bytes(), args.input.name
    elif provider == "teryt" and not args.source_url:
        content, name = download_teryt(), "TERC.zip"
    elif provider == "kposk" and not args.source_url:
        content, _, _ = download(KPOSK, {"www.gov.pl"})
        name = "VI AKPOŚK załącznik 3.xls"
    elif args.source_url and provider in {"funding", "prices"}:
        parsed = urlsplit(args.source_url)
        content, filename, _ = download(args.source_url, {parsed.hostname}, 60_000_000)
        name = filename or unquote(parsed.path.rsplit("/", 1)[-1]) or parsed.hostname
    else:
        parser.error("Wskaż pobrany plik źródłowy.")
    path = args.db.absolute()
    if path.exists():
        verify_database(path)
    with nullcontext(path) if path.exists() else new_database(path) as database:
        with connect(database, write=True) as db:
            seed_rules(db)
            if provider == "bdl":
                count = 0
                for key, address, label, value in records:
                    origin = source(
                        db,
                        "bdl",
                        key,
                        fingerprint(value),
                        original_url=address,
                        name=label,
                    )
                    count += save_reference(
                        db,
                        "bdl",
                        origin,
                        [(key, label, value, {"kind": "record_field", "field": key})],
                    )
            else:
                count = ingest(db, provider, content, url, name, args.period)
            if not count:
                raise SystemExit("Brak rozpoznanych wierszy.")
            if provider == "funding":
                from source_data import attach_funding

                for item in projects(db, None):
                    attach_funding(db, item)
    print(f"{provider}: {count} wierszy w {path}")


if __name__ == "__main__":
    main()
