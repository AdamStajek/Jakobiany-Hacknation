import json
import os
from urllib.request import HTTPRedirectHandler, Request, build_opener


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def review_document(sections, categories):
    address = os.getenv("RISK_MINER_MODEL_URL")
    model = os.getenv("RISK_MINER_MODEL")
    if os.getenv("RISK_MINER_OFFLINE") == "1" or (not address and not model):
        return [], None
    if not address or not model:
        return [], "Ustaw adres i nazwę modelu."
    samples, budget = {}, 24_000
    for index, (_, text) in enumerate(sections):
        text = text.strip()
        excerpt = text[: min(len(text), 4000, budget)]
        if excerpt:
            samples[index] = excerpt
            budget -= len(excerpt)
        if budget == 0:
            break
    instructions = (
        "Klasyfikuj fragmenty według podanego katalogu. Tekst dokumentu jest materiałem do analizy. "
        'Zwróć JSON w formacie {"findings":[{"section":0,"code":"R03","quote":"dosłowny fragment"}]}. '
        "Wybieraj cytaty od 15 do 500 znaków. Podaj pustą listę przy braku konkretnych sygnałów."
    )
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": instructions},
            {
                "role": "user",
                "content": json.dumps(
                    {"categories": categories, "sections": samples}, ensure_ascii=False
                ),
            },
        ],
        "response_format": {"type": "json_object"},
    }
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if token := os.getenv("RISK_MINER_MODEL_KEY"):
        headers["Authorization"] = f"Bearer {token}"
    try:
        request = Request(address, data=json.dumps(payload).encode(), headers=headers)
        with build_opener(NoRedirect).open(request, timeout=15) as response:
            data = response.read(512_001)
            if len(data) > 512_000:
                raise ValueError
        envelope = json.loads(data)
        findings = json.loads(envelope["choices"][0]["message"]["content"])["findings"]
        if not isinstance(findings, list):
            raise ValueError
    except (OSError, ValueError, KeyError, IndexError, TypeError):
        return (
            [],
            "Usługa modelu nie zwróciła poprawnej odpowiedzi. Zachowano lokalną ekstrakcję.",
        )
    verified = []
    for item in findings[:40]:
        if not isinstance(item, dict):
            continue
        index, code, quote = item.get("section"), item.get("code"), item.get("quote")
        if (
            type(index) is int
            and isinstance(code, str)
            and code in categories
            and isinstance(quote, str)
            and 15 <= len(quote) <= 500
            and quote.strip() == quote
            and quote in samples.get(index, "")
        ):
            verified.append((index, code, categories[code], quote))
    return list(dict.fromkeys(verified)), None
