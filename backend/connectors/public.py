import json
import os
import re
from datetime import date
from threading import Lock
from time import monotonic, sleep
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

BZP = "https://ezamowienia.gov.pl"
TED = "https://api.ted.europa.eu/v3/notices/search"
KINDS = {
    "ContractNotice": "procurement",
    "TenderResultNotice": "award",
    "AgreementUpdateNotice": "contract_change",
    "ContractPerformingNotice": "contract_execution",
}
PAGE_SIZE = 50
LOCK = Lock()
last_request = 0.0


class FetchError(Exception):
    def __init__(self, url, message):
        super().__init__(message)
        self.url = url


def read_json(url, body=None, paced=False):
    global last_request
    for attempt in range(2):
        try:
            if paced:
                with LOCK:
                    sleep(max(0, last_request + 2.1 - monotonic()))
                    last_request = monotonic()
            request = Request(
                url,
                data=json.dumps(body).encode() if body else None,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": "RiskMiner/0.1",
                },
            )
            with urlopen(request, timeout=7) as response:
                if response.headers.get("X-Mirror-Missing-Type"):
                    raise FetchError(
                        url, "Kopia BZP nie zawiera tego rodzaju ogłoszenia."
                    )
                data = response.read(12_000_001)
                if len(data) > 12_000_000:
                    raise FetchError(url, "Odpowiedź źródła przekracza limit rozmiaru.")
                return json.loads(data)
        except HTTPError as exc:
            if attempt == 0 and exc.code in {429, 500, 502, 503, 504}:
                sleep(1)
                continue
            raise FetchError(url, f"Źródło zwróciło HTTP {exc.code}.") from exc
        except (URLError, TimeoutError, OSError) as exc:
            if attempt == 0:
                sleep(0.5)
                continue
            raise FetchError(url, "Nie udało się połączyć ze źródłem.") from exc
        except (ValueError, UnicodeError) as exc:
            raise FetchError(url, "Źródło zwróciło niepoprawny JSON.") from exc


def bzp_pages(kind, **filters):
    base = os.getenv("RISK_MINER_BZP_URL", BZP).rstrip("/")
    endpoint = (
        base
        if base.endswith("/mo-board/api/v1/notice")
        else base + "/mo-board/api/v1/notice"
    )
    seen = set()
    for _ in range(8):
        url = (
            endpoint
            + "?"
            + urlencode({"NoticeType": kind, "PageSize": PAGE_SIZE, **filters})
        )
        rows = read_json(url, paced=urlsplit(base).hostname == "ezamowienia.gov.pl")
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise FetchError(url, "Niepoprawny format danych BZP.")
        yield url, rows
        if len(rows) < PAGE_SIZE:
            return
        cursor = rows[-1].get("objectId")
        if not cursor or cursor in seen:
            raise FetchError(url, "BZP powtórzył kursor paginacji.")
        seen.add(cursor)
        filters["SearchAfter"] = cursor
    raise FetchError(url, "Osiągnięto limit stron BZP.")


def bzp_search(project, references):
    seeds = {}
    for item in references:
        if item["scheme"] == "bzp":
            match = re.fullmatch(
                r"(\d{4})\s*/\s*BZP\s*(\d{8})(?:\s*/\s*(\d{2}))?", item["value"], re.I
            )
            if not match:
                yield FetchError(BZP, f"Niepoprawny numer BZP: {item['value']}")
                continue
            number = f"{match[1]}/BZP {match[2]}" + (f"/{match[3]}" if match[3] else "")
            for kind in KINDS:
                try:
                    for url, rows in bzp_pages(kind, NoticeNumber=number):
                        for item in rows:
                            if str(item.get("noticeNumber", "")).startswith(number):
                                if item.get("tenderId"):
                                    seeds[item["tenderId"]] = item
                                yield url, item, True
                    if seeds and any(
                        item["noticeNumber"].startswith(number)
                        for item in seeds.values()
                    ):
                        break
                except FetchError as exc:
                    yield exc
    if any(item["scheme"] == "kpo" for item in references) and not seeds:
        buyer = project.get("beneficiary", {}).get("name")
        tokens = re.findall(r"[^\W_]+", project["title"])
        topic = " ".join(tokens[:2]) if len(tokens) >= 2 else ""
        if buyer and topic:
            try:
                for url, rows in bzp_pages(
                    "ContractNotice",
                    OrganizationName=buyer.split(" – ")[0],
                    OrderObject=topic,
                    PublicationDateFrom="2023-01-01",
                ):
                    for row in rows[:5]:
                        yield url, row, False
                    if rows:
                        break
            except FetchError as exc:
                yield exc
    for tender_id, item in seeds.items():
        buyer, title = item.get("organizationName"), item.get("orderObject")
        if not buyer or not title:
            continue
        year = str(item.get("publicationDate") or date.today())[:4]
        for kind in KINDS:
            try:
                for url, rows in bzp_pages(
                    kind,
                    OrganizationName=buyer,
                    OrderObject=title[:60],
                    PublicationDateFrom=f"{max(2021, int(year) - 1)}-01-01",
                ):
                    for row in rows:
                        if row.get("tenderId") == tender_id and row.get(
                            "objectId"
                        ) != item.get("objectId"):
                            yield url, row, False
            except FetchError as exc:
                yield exc


def ted_text(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return ted_text(
            value.get("pol") or value.get("eng") or next(iter(value.values()), "")
        )
    if isinstance(value, list):
        return " / ".join(filter(None, map(ted_text, value)))
    return ""


def ted_search(project, references):
    address = os.getenv("RISK_MINER_TED_URL", TED)
    if not address:
        return
    explicit = [
        item["value"]
        for item in references
        if item["scheme"] == "ted" and re.fullmatch(r"\d{1,8}-\d{4}", item["value"])
    ]
    queries = [(f'publication-number = "{value}"', True) for value in explicit]
    if (
        not queries
        and project["kind"] == "historical"
        and os.getenv("RISK_MINER_TED_CONTEXT") == "1"
    ):
        words = re.findall(r"[^\W_]+", project["title"])[:12]
        buyer = re.findall(r"[^\W_]+", project.get("beneficiary", {}).get("name", ""))[
            :8
        ]
        if len(words) >= 2:
            clause = f'notice-title ~ "{" ".join(words)}" AND buyer-country = POL'
            if buyer:
                clause += f' AND buyer-name ~ "{" ".join(buyer)}"'
            queries.append((clause, False))
    for query, exact in queries:
        try:
            body = {
                "query": query,
                "fields": [
                    "publication-number",
                    "notice-title",
                    "buyer-name",
                    "publication-date",
                ],
                "page": 1,
                "limit": 10,
                "scope": "ALL",
                "paginationMode": "PAGE_NUMBER",
            }
            response = read_json(address, body)
            if not isinstance(response, dict) or not isinstance(
                response.get("notices"), list
            ):
                raise FetchError(address, "Niepoprawny format danych TED.")
            for row in response["notices"]:
                if isinstance(row, dict) and re.fullmatch(
                    r"\d{1,8}-\d{4}", str(row.get("publication-number", ""))
                ):
                    yield address, row, exact
        except FetchError as exc:
            yield exc
