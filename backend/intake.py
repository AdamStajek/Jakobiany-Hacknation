import csv
import re
from datetime import date
from decimal import Decimal
from hashlib import sha256
from io import BytesIO, StringIO
from subprocess import CalledProcessError, TimeoutExpired, check_output
from tempfile import NamedTemporaryFile
from zipfile import BadZipFile, ZipFile

from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException
from openpyxl import load_workbook
from openpyxl.utils import get_column_letter
from openpyxl.utils.exceptions import InvalidFileException
from pypdf import PdfReader
from xlrd import XLRDError, open_workbook

from store import (
    API,
    Problem,
    asset,
    confidence,
    evidence,
    find,
    fingerprint,
    identifier,
    project,
    put,
    put_project,
    ref,
    review_fields,
    revision,
    source,
    unique,
    values,
)

RECORD_ID = "Identyfikator rekordu"
TITLE = "Nazwa przedsięwzięcia"
SCHEME = "Rodzaj identyfikatora publicznego"
PUBLIC_ID = "Identyfikator publiczny"
DESCRIPTION = "Adnotacja instytucji"
SCHEMES = {
    "ogłoszenie bzp": "bzp",
    "projekt kpo": "kpo",
    "ogłoszenie ted": "ted",
    "projekt cst": "cst",
    **{
        scheme: scheme
        for scheme in ("bzp", "kpo", "ted", "cst", "ocid", "nip", "regon")
    },
}
OLE = bytes.fromhex("d0cf11e0a1b11ae1")
DOC = "application/msword"
DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
WORD = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
MAX_EXPANDED = 40 * 1024 * 1024
MAX_TEXT = 1_000_000
MAX_ROWS = 10_000

SUBSECTORS = {
    "water_network": ("Sieć wodociągowa", r"wodociąg|wodociag"),
    "sanitary_sewer": (
        "Kanalizacja sanitarna",
        r"kanalizacj[aię] sanitarn|rurociąg\w* tłoczn",
    ),
    "wastewater_treatment": ("Oczyszczalnia ścieków", r"oczyszczalni"),
    "water_supply_treatment": (
        "Uzdatnianie i zaopatrzenie w wodę",
        r"uzdatnian|\bsuw\b",
    ),
    "stormwater_retention": ("Kanalizacja deszczowa i retencja", r"deszczow|retencj"),
    "other_water_and_sewerage": ("Inne obiekty wodno-kanalizacyjne", r"$^"),
}
CATEGORIES = [
    (
        "Niepełny lub niespójny zakres",
        r"niepełn\w* zakres|niespójn\w* zakres|brak\w* zakres",
    ),
    (
        "Niedostateczne rozpoznanie stanu istniejącego",
        r"niezinwentaryzowan|brak (?:inwentaryzacji|badań geotechnicznych)",
    ),
    (
        "Kolizje oraz prawa i dostęp do nieruchomości",
        r"kolizj\w* z|brak (?:dostępu|zgody właściciela|prawa do dysponowania)|nieuzyskan\w* zgod",
    ),
    (
        "Decyzje, pozwolenia i uzgodnienia",
        r"brak (?:pozwolenia|decyzji|uzgodnienia)|odmow\w* (?:wydania|uzgodnienia)",
    ),
    (
        "Podział odpowiedzialności",
        r"niejasn\w* (?:podział|odpowiedzialnoś)|brak podziału odpowiedzialności",
    ),
    ("Harmonogram i zależności", r"opóźni\w*|wydłuż\w* termin|przedłuż\w* termin"),
    (
        "Nieprzewidziane zmiany i roboty dodatkowe",
        r"robot\w* dodatkow|robot\w* zamienn|nieprzewidzian\w* robot",
    ),
    (
        "Niedopasowany model wynagrodzenia",
        r"niedopasowan\w* wynagrodzeni|ryzyko ryczałt",
    ),
    (
        "Niejednoznaczne wymagania techniczne",
        r"niejednoznaczn\w* wymagania|niemierzaln\w* wymagania",
    ),
    (
        "Próby, rozruch i odbiory",
        r"niezaliczon\w* prób|nieudan\w* rozruch|odmow\w* odbioru|brak prób",
    ),
    ("Odwołania i konkurencja", r"wniesiono odwołanie|ograniczeni\w* konkurencji"),
    (
        "Wykonawca i dostawy",
        r"brak dostaw|opóźni\w* dostaw|niewypłacalnoś\w* wykonawcy",
    ),
    (
        "Finansowanie, budżet i płatności",
        r"przekrocz\w* budżet|utrac\w* dofinansowanie|brak środków na",
    ),
    ("Eksploatacja i utrzymanie", r"nadmiern\w* koszt\w* (?:utrzymania|eksploatacji)"),
    (
        "Efekt technologiczny, użytkowy lub środowiskowy",
        r"nie osiągnięto|nieosiągnięci\w* efekt|nie spełni\w* parametr",
    ),
]
RISK_SIGNALS = {
    f"R{i:02}": (title, pattern) for i, (title, pattern) in enumerate(CATEGORIES, 1)
}
CHECKS = [
    (
        "need_and_outcome",
        "Jaki problem ma rozwiązać inwestycja i jaki jest oczekiwany efekt?",
        ["R01", "R15"],
        "Uzasadnienie inwestycji i oczekiwany efekt",
        r"celem|problem\w*|oczekiwan\w* efekt",
    ),
    (
        "service_area_and_users",
        "Gdzie i komu będzie świadczona usługa?",
        ["R15"],
        "Mapa zasięgu i liczba oraz rodzaj odbiorców",
        r"odbiorc\w*|gospodarstw\w*|mieszkańc\w*",
    ),
    (
        "uptake",
        "Kto podłączy się na początku i jak oszacowano kolejne przyłączenia?",
        ["R15"],
        "Lista deklaracji i założenia etapowania",
        r"deklaracj\w*|podłącz\w*|przyłączeni\w*",
    ),
    (
        "network_scope",
        "Jaki jest przebieg, długość i zakres przyłączy?",
        ["R01", "R07"],
        "Mapa trasy i zestawienie długości oraz przyłączy",
        r"\d[\d,. ]*\s*(?:km|m)\b|przebieg\w* sieci",
    ),
    (
        "supply",
        "Skąd będzie zasilana sieć i jakie jest stanowisko operatora?",
        ["R04", "R15"],
        "Warunki techniczne lub stanowisko operatora",
        r"zasilani\w*|stanowisk\w* operatora|warunk\w* techniczn",
    ),
    (
        "land_access",
        "Kto jest właścicielem gruntów i czy zapewniono dostęp?",
        ["R03"],
        "Mapa działek oraz wykaz praw do dysponowania",
        r"służebnoś\w*|własnoś\w* grunt|dostęp\w* do (?:grunt|teren)|zgod\w* właściciel",
    ),
    (
        "dependencies",
        "Jakie przeszkody i zależności uwzględniono?",
        ["R03", "R06"],
        "Mapa kolizji i uzgodniony harmonogram zależności",
        r"kolizj\w*|zależnoś\w*|przeszkod\w*",
    ),
    (
        "environment",
        "Czy rozpoznano wymagania środowiskowe i ochronę przyrody?",
        ["R04"],
        "Analiza środowiskowa i decyzje, jeśli mają zastosowanie",
        r"środowiskow\w*|natura 2000|ochron\w* przyrody",
    ),
    (
        "responsibilities",
        "Kto odpowiada za przygotowanie, decyzje i eksploatację?",
        ["R05"],
        "Podział odpowiedzialności inwestora, projektanta i operatora",
        r"odpowiada za|odpowiedzialnoś\w*",
    ),
]


def external(scheme, value):
    value = str(value).strip()
    normalized = re.sub(r"\s+", "", value).upper()
    if scheme in {"nip", "regon"}:
        normalized = re.sub(r"^(PL)|[.-]", "", normalized)
    if scheme == "ted":
        if match := re.fullmatch(r"(\d{1,8})-(\d{4})", normalized):
            normalized = f"{int(match[1])}-{match[2]}"
    return {
        "scheme": scheme,
        "value": value,
        "normalized": normalized,
    }


def infer_subsectors(text):
    return [
        code
        for code, (_, pattern) in SUBSECTORS.items()
        if re.search(pattern, text, re.I)
    ]


def check_zip(data):
    with ZipFile(BytesIO(data)) as archive:
        if (
            sum(info.file_size for info in archive.infolist()) > MAX_EXPANDED
            or len(archive.infolist()) > 4000
        ):
            raise Problem(
                413, "file_too_large", "Archiwum przekracza limit po rozpakowaniu."
            )
        return set(archive.namelist())


def input_rows(filename, data):
    try:
        if filename.lower().endswith(".xls") and data.startswith(OLE):
            with open_workbook(file_contents=data, on_demand=True) as workbook:
                sheet = workbook.sheet_by_name("Projekty")
                return tabular_rows(
                    sheet.row_values(i, end_colx=100) for i in range(sheet.nrows)
                )
        if filename.lower().endswith(".xlsx") and "xl/workbook.xml" in check_zip(data):
            with BytesIO(data) as stream:
                workbook = load_workbook(
                    stream, read_only=True, data_only=True, keep_links=False
                )
                try:
                    sheet = workbook["Projekty"]
                    sheet.reset_dimensions()
                    lines = sheet.iter_rows(max_col=100, values_only=True)
                    return tabular_rows(lines)
                finally:
                    workbook.close()
        if filename.lower().endswith(".csv") and b"\0" not in data:
            content = data.decode("utf-8-sig")
            header = content.partition("\n")[0]
            delimiter = ";" if header.count(";") > header.count(",") else ","
            return tabular_rows(
                csv.reader(
                    StringIO(content, newline=""), delimiter=delimiter, strict=True
                )
            )
    except (
        BadZipFile,
        XLRDError,
        InvalidFileException,
        DefusedXmlException,
        SyntaxError,
        UnicodeError,
        csv.Error,
        KeyError,
        ValueError,
    ) as exc:
        raise Problem(
            415,
            "unsupported_import",
            "Oczekiwano poprawnego XLS/XLSX z arkuszem Projekty lub CSV UTF-8.",
        ) from exc
    raise Problem(
        415,
        "unsupported_import",
        "Obsługiwane formaty importu to XLS, XLSX i CSV UTF-8.",
    )


def tabular_rows(lines):
    headers = [str(cell or "").strip() for cell in next(iter(lines), ())]
    used = [header for header in headers if header]
    if not {RECORD_ID, TITLE, SCHEME, PUBLIC_ID} <= set(used) or len(set(used)) != len(
        used
    ):
        raise Problem(
            422,
            "invalid_headers",
            "Uzupełnij wymagane, unikalne nagłówki arkusza Projekty.",
        )
    columns = {
        name: get_column_letter(index) for index, name in enumerate(headers, 1) if name
    }
    rows = []
    for number, line in enumerate(lines, 2):
        if number > MAX_ROWS + 1:
            raise Problem(
                413,
                "too_many_rows",
                f"Import obsługuje maksymalnie {MAX_ROWS} wierszy.",
            )
        if any(cell not in (None, "") for cell in line):
            rows.append(
                [
                    number,
                    {
                        key: cell.isoformat() if isinstance(cell, date) else cell
                        for key, cell in zip(headers, line, strict=False)
                        if key
                    },
                ]
            )
    if not rows:
        raise Problem(422, "empty_import", "Plik nie zawiera rekordów.")
    return columns, rows


def import_row(db, filename, columns, row, fields):
    def field(key):
        raw = fields.get(key)
        if isinstance(raw, float) and raw.is_integer():
            return str(int(raw))
        return str(raw if raw is not None else "").strip()

    project_id, title, number = field(RECORD_ID), field(TITLE), field(PUBLIC_ID)
    scheme = SCHEMES.get(field(SCHEME).casefold())
    if (
        not project_id
        or len(project_id) > 128
        or any(ch in project_id for ch in "/?#%")
        or project_id in {".", ".."}
        or not title
        or not scheme
        or not number
    ):
        raise Problem(
            422,
            "invalid_row",
            "Wymagane są poprawny identyfikator rekordu, tytuł oraz typ i wartość identyfikatora publicznego.",
        )
    try:
        previous = project(db, project_id)
    except Problem as exc:
        if exc.status != 404:
            raise
        previous = None
    if previous and previous["kind"] != "historical":
        raise Problem(
            409, "record_conflict", "Identyfikator należy do projektu planowanego."
        )
    raw_id = identifier("input", project_id, fingerprint(fields))
    imported = find(db, "input", raw_id)
    if imported:
        return project_id
    refs = [external("rm", project_id), external(scheme, number)]
    status = {
        "zakończone": "completed",
        "w realizacji": "in_progress",
        "anulowane": "cancelled",
    }.get(field("Status przedsięwzięcia").casefold(), "unknown")
    value = {
        "id": project_id,
        "revision": (previous or {}).get("revision", 0) + 1,
        "kind": "historical",
        "status": status,
        "title": title,
        "sector_code": "water_and_sewerage",
        "external_ids": refs,
        "evidence_ids": [],
        "enrichment_status": "unmatched",
        "counts": {"procedures": 0, "risks": 0, "links": 0},
    }
    if subsectors := infer_subsectors(title):
        value["primary_subsector_codes"] = subsectors
    construction = bool(re.search(r"\b(?:budow|rozbudow)", title, re.I))
    renewal = bool(re.search(r"przebudow|modernizacj|renowacj", title, re.I))
    if construction or renewal:
        value["work_type"] = (
            "mixed"
            if construction and renewal
            else (
                "construction_or_extension"
                if construction
                else "reconstruction_or_renovation"
            )
        )
    if field(DESCRIPTION):
        value["description"] = field(DESCRIPTION)
    if part := re.search(r"część\s+(\d+)", field("Zakres rekordu"), re.I):
        value["seed_scope"] = {"level": "part", "part_number": part[1]}
    else:
        value["seed_scope"] = {"level": "procedure"}
    if name := field("Nazwa odbiorcy"):
        seat = {
            key: field(label)
            for key, label in [
                ("country", "Kraj"),
                ("region", "Województwo"),
                ("region_code", "Kod województwa (TERYT)"),
                ("locality", "Siedziba odbiorcy"),
            ]
            if field(label)
        }
        if "region_code" in seat:
            seat["region_code"] = seat["region_code"].zfill(2)
        value["beneficiary"] = {"name": name, "seat": seat}
        if field("Typ odbiorcy"):
            value["beneficiary"]["type"] = field("Typ odbiorcy")
        if field("Identyfikator odbiorcy"):
            code = field("Rodzaj identyfikatora odbiorcy").lower()
            value["beneficiary"]["identifiers"] = [
                external(
                    code if code in {"nip", "regon"} else "other",
                    field("Identyfikator odbiorcy"),
                )
            ]
    put_project(db, value)
    origin = source(
        db,
        "contest_xlsx"
        if filename.lower().endswith((".xls", ".xlsx"))
        else "uploaded_file",
        f"{filename}/{project_id}",
        raw_id,
        project_id,
        raw=fields,
        name=filename,
    )
    put(db, "input", {"id": raw_id, "row": row, "fields": fields}, project_id)
    for key, text in fields.items():
        if text not in (None, "") and key in {
            TITLE,
            PUBLIC_ID,
            DESCRIPTION,
            "Status przedsięwzięcia",
            "Identyfikator odbiorcy",
            "Nazwa odbiorcy",
            "Zakres rekordu",
        }:
            ev = evidence(
                db,
                project_id,
                origin,
                {
                    "kind": "table",
                    "sheet": "Projekty",
                    "row": row,
                    "column": columns[key],
                },
                str(text),
            )
            value["evidence_ids"].append(ev["id"])
            if key in {TITLE, DESCRIPTION}:
                extract(db, value, str(text), ev)
            if key == DESCRIPTION and field("Waluta rozliczeń") == "PLN":
                for label, kind in [
                    ("Wartość przedsięwzięcia", "project_value"),
                    ("dofinansowanie", "financing"),
                ]:
                    if amount := re.search(
                        label + r":\s*([\d \u00a0]+,\d{2}) zł", str(text), re.I
                    ):
                        put(
                            db,
                            "amount",
                            {
                                "id": identifier("amount", raw_id, kind),
                                "kind": kind,
                                "value": re.sub(r"\s", "", amount[1]).replace(",", "."),
                                "currency": "PLN",
                                "vat": "unknown",
                                "evidence_ids": [ev["id"]],
                            },
                            project_id,
                            input_id=raw_id,
                        )
    put(db, "import_state", {"id": project_id, "current_input_id": raw_id}, project_id)
    put_project(db, value)
    revision(db, "project", value, project_id)
    return project_id


def register_description(db, value):
    if text := value.get("description", "").strip():
        origin = source(
            db,
            "user_description",
            value["id"],
            value["revision"],
            value["id"],
            raw={"description": value["description"]},
        )
        ev = evidence(
            db,
            value["id"],
            origin,
            {"kind": "record_field", "field": "description"},
            value["description"],
        )
        value["evidence_ids"] = [ev["id"]]
        extract(db, value, text, ev)


def media_type(filename, content):
    if filename.lower().endswith(".doc") and content.startswith(OLE):
        return DOC
    if filename.lower().endswith(".pdf") and content.startswith(b"%PDF-"):
        return "application/pdf"
    if filename.lower().endswith(".docx"):
        try:
            if {"[Content_Types].xml", "word/document.xml"} <= check_zip(content):
                with ZipFile(BytesIO(content)) as archive:
                    types = ElementTree.fromstring(archive.read("[Content_Types].xml"))
                if any(
                    item.get("PartName") == "/word/document.xml"
                    and item.get("ContentType")
                    == "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
                    for item in types
                ):
                    return DOCX
        except (BadZipFile, DefusedXmlException, SyntaxError):
            pass
    raise Problem(
        415, "unsupported_document_type", "Oczekiwano pliku PDF, DOC lub DOCX."
    )


def document_text(media, content):
    if media == DOC:
        with NamedTemporaryFile(suffix=".doc") as document:
            document.write(content)
            document.flush()
            try:
                text = check_output(
                    ["antiword", "-m", "UTF-8.txt", "-w", "0", document.name],
                    timeout=10,
                    stderr=-1,
                ).decode("utf-8")
            except FileNotFoundError as exc:
                raise ValueError("Odczyt DOC wymaga programu antiword.") from exc
            except (CalledProcessError, TimeoutExpired, UnicodeError) as exc:
                raise ValueError(
                    "Nie można odczytać warstwy tekstowej pliku DOC."
                ) from exc
        return [
            ({"kind": "doc", "paragraph": f"p{index}"}, paragraph)
            for index, paragraph in enumerate(text.strip().split("\n\n"), 1)
        ]
    if media == "application/pdf":
        reader = PdfReader(BytesIO(content))
        if reader.is_encrypted or len(reader.pages) > 300:
            raise ValueError("PDF jest zaszyfrowany lub przekracza limit 300 stron.")
        return [
            ({"kind": "pdf", "page": index}, page.extract_text() or "")
            for index, page in enumerate(reader.pages, 1)
        ]
    with ZipFile(BytesIO(content)) as archive:
        root = ElementTree.fromstring(archive.read("word/document.xml"))
    return [
        (
            {"kind": "docx", "paragraph": f"p{index}"},
            "".join(node.text or "" for node in paragraph.iter(WORD + "t")),
        )
        for index, paragraph in enumerate(root.iter(WORD + "p"), 1)
    ]


def save_document(db, project_id, filename, content, media, document_id, document_type):
    digest = sha256(content).hexdigest()
    document_id = document_id or identifier("doc", project_id, filename, document_type)
    existing = find(db, "document", document_id)
    if existing and existing[1] != project_id:
        raise Problem(404, "not_found", "Dokument nie należy do projektu.")
    document = (
        existing[0]
        if existing
        else {
            "id": document_id,
            "document_type": document_type,
            "related_to": [ref("project", project_id)],
        }
    )
    version_id = identifier("ver", document_id, digest)
    if find(db, "document_version", version_id):
        return version_id
    versions = [
        item
        for item in values(db, "document_version", project_id)
        if item["document_id"] == document_id
    ]
    origin = source(
        db,
        "uploaded_file",
        f"{document_id}/{filename}",
        digest,
        project_id,
        name=filename,
    )
    previous = document.get("current_version_id")
    version = {
        "id": version_id,
        "document_id": document_id,
        "revision": len(versions) + 1,
        "media_type": media,
        "sha256": digest,
        "source": origin,
        "extraction_status": "queued",
        "supersedes_version_ids": [previous] if previous else [],
        "content_url": f"{API}/documents/{document_id}/versions/{version_id}/content",
    }
    asset(db, version_id, content)
    put(db, "document_version", version, project_id)
    document["current_version_id"] = version_id
    put(db, "document", document, project_id)
    return version_id


def extract(db, value, text, ev, observed=False):
    project_id = value["id"]
    facts = [("source_text", text, None)]
    if re.search(r"wodociąg|kanalizacj|sieć|sieci", text, re.I):
        for match in re.finditer(r"\b(\d+(?:[,.]\d+)?)\s*(km|mb?)(?!\w)", text, re.I):
            meters = Decimal(match[1].replace(",", ".")) * (
                1000 if match[2].casefold() == "km" else 1
            )
            facts.append(("network_length_m", format(meters.normalize(), "f"), "m"))
    for key, result, unit in unique(facts):
        fact_id = (
            identifier("fact", ev["id"])
            if key == "source_text"
            else identifier("fact", ev["id"], key, result)
        )
        if find(db, "fact", fact_id):
            continue
        value = {
            **review_fields(fact_id),
            "subject": ref("project", project_id),
            "key": key,
            "value": result,
            "claim_type": "SOURCE_FACT",
            "evidence_ids": [ev["id"]],
            "confidence": confidence(
                "high", "Wartość bezpośrednio wskazana w materiale źródłowym."
            ),
        }
        if unit:
            value["unit"] = unit
        put(db, "fact", value, project_id)
    matches = []
    for code, (title, pattern) in RISK_SIGNALS.items():
        for match in re.finditer(pattern, text, re.I):
            start = (
                max(
                    text.rfind("\n", 0, match.start()),
                    text.rfind(". ", 0, match.start()),
                )
                + 1
            )
            tail = text[match.end() : match.end() + 500]
            end = re.search(r"\n|[.!?](?=\s|$)", tail)
            boundary = match.end() + (end.end() if end else len(tail))
            line = text[max(start, match.start() - 400) : boundary].strip()
            if match.group().casefold() not in line.casefold():
                line = text[max(0, match.start() - 100) : match.end() + 160].strip()
            happened = observed and bool(
                re.search(
                    r"stwierdzono|wystąpienie|wystąpił|ujawniono|wykonano|przedłużono|wydłużono|opóźnił|odmówiono|wniesiono|przekroczono",
                    line,
                    re.I,
                )
            )
            if happened and re.search(
                r"nie (?:stwierdzono|wystąpił|ujawniono|wykonano|opóźnił)", line, re.I
            ):
                happened = False
            matches.append((code, title, line, happened))
            break
    return [
        save_risk(db, project_id, code, title, line, ev, happened)
        for code, title, line, happened in matches
    ]


def save_risk(db, project_id, code, title, line, ev, happened=False):
    if ev["locator"]["kind"] in {"pdf", "doc", "docx"} and ev.get("quote") != line:
        quote = ev["quote"]
        position = quote.index(line) + ev["char_offsets"]["start"]
        ev = evidence(
            db,
            project_id,
            ev["source"],
            ev["locator"],
            line,
            document_id=ev["document_id"],
            document_version_id=ev["document_version_id"],
            char_offsets={"start": position, "end": position + len(line)},
        )
    risk_id = identifier("risk", ev["id"], code, happened)
    previous = find(db, "risk", risk_id)
    if previous:
        return previous[0]
    impacts = []
    if happened and (
        delay := re.search(
            r"(?:przedłużono|wydłużono|opóźnił\w*)[^.\n]{0,90}?\bo (\d+) dni",
            line,
            re.I,
        )
    ):
        impacts.append(
            {
                "dimension": "time",
                "kind": "observed",
                "description": delay[0],
                "value": delay[1],
                "unit": "days",
                "evidence_ids": [ev["id"]],
            }
        )
    if happened and (
        cost := re.search(
            r"(?:zwiększon\w*|podniesion\w*|wzros\w*)[^.\n]{0,90}?\bo ([\d \u00a0]+(?:,\d{1,2})?)\s*(zł|PLN)(?!\w)",
            line,
            re.I,
        )
    ):
        impacts.append(
            {
                "dimension": "cost",
                "kind": "observed",
                "description": cost[0],
                "value": re.sub(r"\s+", "", cost[1]).replace(",", "."),
                "unit": "PLN",
                "evidence_ids": [ev["id"]],
            }
        )
    causes, measures = [], []
    if happened and (
        cause := re.search(
            r"\b(?:z powodu|w związku z|z uwagi na) ([^.;\n]+)", line, re.I
        )
    ):
        causes.append(
            {"status": "confirmed", "description": cause[0], "evidence_ids": [ev["id"]]}
        )
    if happened and (
        measure := re.search(
            r"\b(?:zaradczo|w ramach działań naprawczych) ([^.;\n]+)", line, re.I
        )
    ):
        measures.append(
            {
                "kind": "applied",
                "description": measure[1],
                "effectiveness": "unknown",
                "evidence_ids": [ev["id"]],
            }
        )
    return put(
        db,
        "risk",
        {
            **review_fields(risk_id),
            "project_id": project_id,
            "risk_code": code,
            "title": title,
            "kind": "OBSERVED_EVENT" if happened else "POTENTIAL_RISK",
            "claim_type": "MODEL_INFERENCE",
            "signal": line,
            "event": line if happened else title,
            "causes": causes,
            "impacts": impacts,
            "measures": measures,
            "related_to": [ref("project", project_id)],
            "evidence_ids": [ev["id"]],
            "confidence": confidence(
                "low", "Klasyfikacja fragmentu do weryfikacji przez eksperta."
            ),
        },
        project_id,
    )


def extract_document(db, version, project_id, sections, findings):
    value = project(db, project_id)
    document = find(db, "document", version["document_id"])[0]
    observed = value["kind"] == "historical" and document["document_type"] in {
        "signed_contract",
        "annex",
        "acceptance_report",
    }
    evidence_ids = []
    for index, (locator, text) in enumerate(sections):
        if text.strip():
            quote = text.strip()
            start = text.index(quote)
            ev = evidence(
                db,
                project_id,
                version["source"],
                locator,
                quote,
                document_id=document["id"],
                document_version_id=version["id"],
                char_offsets={"start": start, "end": start + len(quote)},
            )
            evidence_ids.append(ev["id"])
            extract(db, value, quote, ev, observed)
            for section, code, title, cited in findings:
                if section == index:
                    save_risk(db, project_id, code, title, cited, ev)
    return evidence_ids


def seed_rules(db):
    if values(db, "sector_rules"):
        return
    requirements = [
        {
            "code": code,
            "question": question,
            "rationale": f"Źródło do zweryfikowania: {expected}.",
            "weight": 2 if code in {"land_access", "supply"} else 1,
            "risk_codes": codes,
            "expected_evidence": [expected],
        }
        for code, question, codes, expected, _ in CHECKS
    ]
    put(
        db,
        "sector_rules",
        {
            **review_fields("water_and_sewerage_v1", "approved"),
            "sector_code": "water_and_sewerage",
            "description": "Katalog ryzyk i lista kontrolna inwestycji wodociągowych MFiPR.",
            "subsectors": [
                {"code": code, "label": label}
                for code, (label, _) in SUBSECTORS.items()
            ],
            "risk_categories": [
                {"code": code, "label": title, "description": title}
                for code, (title, _) in RISK_SIGNALS.items()
            ],
            "checklists": [
                {
                    "subsector_code": "water_network",
                    "phase": phase,
                    "requirements": requirements,
                }
                for phase in ("planning", "preparation")
            ],
            "comparison_weights": {
                "subsector": 4,
                "work_type": 2,
                "technical": 2,
                "function": 1,
                "organization": 1,
                "cost": 1,
                "schedule": 1,
                "location": 1,
                "text": 3,
            },
            "rules": [],
        },
    )


def mock_seed(db):
    seed_rules(db)
    project_id = "mock-water-network"
    text = (
        "Rozbudowa sieci wodociągowej o 2 km. W trakcie robót stwierdzono brak zgody właściciela "
        "na dostęp do terenu. Przedłużono termin o 30 dni."
    )
    value = {
        "id": project_id,
        "title": "Rozbudowa sieci wodociągowej (demo)",
        "description": text,
        "kind": "historical",
        "status": "completed",
        "revision": 1,
        "sector_code": "water_and_sewerage",
        "primary_subsector_codes": ["water_network"],
        "work_type": "construction_or_extension",
        "external_ids": [],
        "evidence_ids": [],
        "enrichment_status": "matched",
        "counts": {"procedures": 0, "risks": 0, "links": 0},
    }
    put_project(db, value)
    origin = source(
        db,
        "mock",
        project_id,
        1,
        project_id,
        raw={"description": text},
        name="Dane demonstracyjne",
    )
    ev = evidence(
        db, project_id, origin, {"kind": "record_field", "field": "description"}, text
    )
    value["evidence_ids"] = [ev["id"]]
    put_project(db, value)
    revision(db, "project", value, project_id)
    extract(db, value, text, ev, observed=True)
