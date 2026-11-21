"""Look up a selected company or statistical unit in public registers."""

import json
import os
from datetime import date
from email import policy
from email.parser import BytesParser
from urllib.parse import urlencode
from urllib.request import Request, build_opener
from xml.sax.saxutils import escape

from defusedxml import ElementTree

from connectors.materials import HostRedirect, download
from connectors.public import FetchError

KRS = "https://api-krs.ms.gov.pl/api/krs"
BDL = "https://bdl.stat.gov.pl/api/v1"
BDL_CODES = {
    1612162: ("Długość eksploatowanej sieci wodociągowej", "km"),
    490: ("Przyłącza wodociągowe do budynków mieszkalnych", "szt."),
    9152: ("Ludność korzystająca z wodociągu", "osoba"),
    396249: ("Zużycie wody w gospodarstwach na mieszkańca", "m³"),
    494: ("Długość czynnej sieci kanalizacyjnej", "km"),
    495: ("Przyłącza kanalizacyjne do budynków mieszkalnych", "szt."),
    9153: ("Ludność korzystająca z kanalizacji", "osoba"),
    475707: ("Ścieki bytowe odprowadzone siecią kanalizacyjną", "dam³"),
}
BIR = "https://wyszukiwarkaregon.stat.gov.pl/wsBIR/UslugaBIRzewnPubl.svc"
BIR_NS = "http://CIS/BIR/PUBL/2014/07"


def get_json(url):
    from urllib.parse import urlsplit

    data, _, _ = download(url, {urlsplit(url).hostname}, 2_000_000)
    try:
        return json.loads(data) if data else {}
    except ValueError as exc:
        raise FetchError(url, "Źródło zwróciło niepoprawny JSON.") from exc


def krs(number):
    for register in ("P", "S"):
        url = f"{KRS}/OdpisAktualny/{number}?rejestr={register}&format=json"
        value = get_json(url).get("odpis")
        if not value:
            continue
        header = value.get("naglowekA") or value.get("naglowekB") or {}
        data = value.get("dane", {})
        entity = data.get("dzial1", {}).get("danePodmiotu", {})
        if header.get("numerKRS") != number or not entity.get("nazwa"):
            raise FetchError(url, "Numer lub nazwa podmiotu w odpisie jest niezgodna.")
        legal_status = data.get("dzial6", {})
        details = {
            "KRS": number,
            "nazwa": entity["nazwa"],
            "forma": entity.get("formaPrawna"),
            "stan na dzień": header.get("stanZDnia"),
            "data rejestracji": header.get("dataRejestracjiWKRS"),
            "rejestr": register,
            "rubryki działu 6": sorted(key for key, val in legal_status.items() if val),
            **{
                key.upper(): val
                for key, val in entity.get("identyfikatory", {}).items()
                if key in {"nip", "regon"}
            },
        }
        return url, entity["nazwa"], details
    return None


def bir_call(method, payload, session=None, *, url=BIR):
    action = f"{BIR_NS}/IUslugaBIRzewnPubl/{method}"
    envelope = (
        f'<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" '
        f'xmlns:a="http://www.w3.org/2005/08/addressing" xmlns:b="{BIR_NS}" '
        f'xmlns:d="http://CIS/BIR/PUBL/2014/07/DataContract">'
        f'<s:Header><a:Action s:mustUnderstand="1">{action}</a:Action>'
        f'<a:To s:mustUnderstand="1">{url}</a:To></s:Header>'
        f"<s:Body><b:{method}>{payload}</b:{method}></s:Body></s:Envelope>"
    ).encode()
    headers = {
        "Content-Type": f'application/soap+xml; charset=utf-8; action="{action}"'
    }
    if session:
        headers["sid"] = session
    from urllib.parse import urlsplit

    try:
        with build_opener(HostRedirect({urlsplit(url).hostname})).open(
            Request(url, data=envelope, headers=headers),
            timeout=9,
        ) as response:
            data = response.read(2_000_001)
            content_type = response.headers["Content-Type"]
        if len(data) > 2_000_000:
            raise ValueError
        if content_type.startswith("multipart/"):
            mail = BytesParser(policy=policy.default).parsebytes(
                f"Content-Type: {content_type}\r\n\r\n".encode() + data
            )
            data = next(mail.iter_parts()).get_payload(decode=True)
        tree = ElementTree.fromstring(data)
        return tree.findtext(f".//{{{BIR_NS}}}{method}Result")
    except Exception as exc:
        raise FetchError(
            "https://api.stat.gov.pl/Home/RegonApi",
            "Usługa BIR nie zwróciła poprawnej odpowiedzi.",
        ) from exc


def regon(number):
    credential = os.getenv("RISK_MINER_BIR_KEY")
    public_url = "https://api.stat.gov.pl/Home/RegonApi"
    if not credential:
        raise FetchError(public_url, "Ustaw klucz RISK_MINER_BIR_KEY usługi GUS BIR.")
    code = {9: "Regon", 10: "Nip", 14: "Regon14zn"}[len(number)]
    session = bir_call(
        "Zaloguj", f"<b:pKluczUzytkownika>{escape(credential)}</b:pKluczUzytkownika>"
    )
    if not session:
        raise FetchError(public_url, "GUS BIR odrzucił logowanie.")
    try:
        result = bir_call(
            "DaneSzukajPodmioty",
            f"<b:pParametryWyszukiwania><d:{code}>{number}</d:{code}></b:pParametryWyszukiwania>",
            session,
        )
    finally:
        try:
            bir_call(
                "Wyloguj",
                f"<b:pIdentyfikatorSesji>{escape(session)}</b:pIdentyfikatorSesji>",
                session,
            )
        except FetchError:
            pass
    if not result:
        return None
    lines = ElementTree.fromstring(result).findall(".//dane")
    # Save only public entity identifiers and status rather than the entire address response.
    results = [
        {
            key: item.findtext(key)
            for key in (
                "Regon",
                "Nip",
                "Nazwa",
                "Typ",
                "StatusNip",
                "DataZakonczeniaDzialalnosci",
            )
        }
        for item in lines
        if item.findtext("Nazwa")
        and (item.findtext("Nip") if code == "Nip" else item.findtext("Regon"))
        == number
    ]
    if results:
        return public_url, f"GUS BIR {number}", {"podmioty": results}
    return None


def bdl(unit_id, codes):
    unit_url = f"{BDL}/units/{unit_id}?format=json"
    unit = get_json(unit_url)
    if unit.get("id") != unit_id or unit.get("level") != 6:
        return
    years = range(date.today().year - 5, date.today().year)
    url = f"{BDL}/data/by-unit/{unit_id}?" + urlencode(
        [("var-id", code) for code in codes]
        + [("year", year) for year in years]
        + [("format", "json"), ("page-size", 50)]
    )
    data = get_json(url)
    for row in data.get("results", []):
        code = row.get("id")
        if code not in codes:
            continue
        label, measure = codes[code]
        result = [
            {
                "rok": item["year"],
                "wartość": item["val"],
                "atrybut BDL": item.get("attrId"),
            }
            for item in row.get("values", [])
            if type(item.get("val")) in {int, float}
        ]
        if result:
            yield (
                f"{unit_id}:{code}",
                url,
                f"{label} · {unit.get('name', unit_id)}",
                {
                    "jednostka BDL": unit_id,
                    "gmina": unit.get("name"),
                    "jednostka miary": measure,
                    "wskaźnik": label,
                    "obserwacje": result,
                },
            )
