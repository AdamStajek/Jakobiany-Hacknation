import os

FOOTER = "\n\n--\nWodoStrażnik. Wiadomość wysłano automatycznie; powiadomienia wyłączysz w ustawieniach konta."


def base_url():
    return os.environ.get("WODO_PUBLIC_URL", "http://localhost:4200").rstrip("/")


def verification(username, token):
    link = f"{base_url()}/konto/potwierdz?token={token}"
    return (
        "Potwierdź adres e-mail w WodoStraży",
        f"Cześć {username},\n\nPotwierdź adres e-mail, aby dostawać powiadomienia o polach:\n{link}\n\n"
        "Link działa 48 godzin. Jeśli to nie Ty zakładałeś konto, zignoruj tę wiadomość." + FOOTER,
    )


def reset(username, token):
    link = f"{base_url()}/konto/reset?token={token}"
    return (
        "Ustaw nowe hasło w WodoStraży",
        f"Cześć {username},\n\nAby ustawić nowe hasło, otwórz:\n{link}\n\n"
        "Link działa godzinę. Jeśli to nie Ty o to prosiłeś, zignoruj tę wiadomość: hasło się nie zmieni." + FOOTER,
    )


def attention(username, items):
    lines = [f"- {item['name']}: " + "; ".join(item["reasons"]) for item in items]
    count = len(items)
    subject = "Pole wymaga uwagi" if count == 1 else f"Pola wymagające uwagi: {count}"
    return (
        subject,
        f"Cześć {username},\n\nNa podstawie ostatnich analiz:\n" + "\n".join(lines)
        + f"\n\nOtwórz aplikację: {base_url()}/pola\n"
        "To sygnały pomocnicze z modelu, nie zalecenie zabiegu." + FOOTER,
    )


def recommendation_lines(items):
    return "\n\n".join(
        f"- {item['action']}\n  Dlaczego? {item['why']}\n"
        f"  Co wykazała analiza? {item['evidence']}\n  Kiedy? {item['when']}\n"
        f"  Warunki: {item['limits']}"
        for item in items
    )


def recommendations(username, field_id, field_name, parcel_id, items):
    return (
        "Nowe rekomendacje dla Twojej działki",
        f"Cześć {username},\n\nPole: {field_name}\nDziałka: {parcel_id}\n\n"
        "Po odświeżeniu danych pojawiły się nowe wstępne rekomendacje:\n\n"
        + recommendation_lines(items)
        + f"\n\nOtwórz pole: {base_url()}/pola?pole={field_id}"
        + FOOTER,
    )


def test_recommendation(username):
    example = {
        "action": "Sprawdź wilgotność gleby na głębokości korzeni przed podlewaniem.",
        "why": "Pomiar pomaga zdecydować, czy uprawa potrzebuje dodatkowej wody.",
        "evidence": "Przykład: model wskazuje możliwy niedobór wody.",
        "when": "Przed planowanym podlewaniem.",
        "limits": "Przykład ma charakter demonstracyjny.",
    }
    return (
        "[TEST] Nowa rekomendacja dla działki",
        f"Cześć {username},\n\nTo testowa wiadomość zamówiona w ustawieniach konta. "
        "Poniższa porada dotyczy przykładowej działki.\n\n"
        + recommendation_lines([example])
        + f"\n\nUstawienia powiadomień: {base_url()}/konto",
    )


# --- Maile demo (scenariusz ręczny, bez prognozy i bez wysyłki) ---

DEMO_KINDS = ("rain", "residue")
SOIL_ADJ = {"sandy": "piaszczysta", "clay": "gliniasta", "silty": "pylasta", "organic": "torfowa"}
TERRAIN_ADJ = {"sloped": "nachylone", "flat": "płaskie", "depression": "zagłębione"}
SOIL_PART = {"sandy": "piaszczystej", "clay": "gliniastej", "silty": "pylastej", "organic": "torfowej"}


def demo_context(field_name=None, soil="sandy", terrain="sloped"):
    soil = soil if soil in SOIL_ADJ else "sandy"
    terrain = terrain if terrain in TERRAIN_ADJ else "sloped"
    return {
        "field_name": (field_name or "").strip()[:80] or None,
        "soil": soil,
        "terrain": terrain,
        "soil_adj": SOIL_ADJ[soil],
        "terrain_adj": TERRAIN_ADJ[terrain],
        "soil_part": SOIL_PART[soil],
    }


def _rain_happening(c):
    # Pole nachylone: spływ w dół działki; inaczej ogólne ryzyko nadmiaru wody.
    if c["terrain"] == "sloped":
        risk = "Istnieje podwyższone ryzyko, że część wody spłynie w dół działki, zamiast wsiąknąć w glebę."
    else:
        risk = "Istnieje podwyższone ryzyko, że część wody nie zdąży wsiąknąć w glebę i zostanie na jej powierzchni."
    if c["soil"] == "sandy":
        soil = f"jego {c['soil_adj']} gleba ma ograniczoną zdolność magazynowania wody"
    else:
        soil = f"jego gleba ({c['soil_adj']}) może różnie magazynować i przepuszczać wodę"
    return (
        f"Prognozowane są intensywne opady deszczu. Twoje pole{_named(c)} jest {c['terrain_adj']}, a {soil}. {risk}"
    )


def _named(c):
    return f" „{c['field_name']}”" if c["field_name"] else ""


def _sections(happening, actions, why):
    return {"happening": happening, "actions": actions, "why": why}


def _rain(c):
    return (
        "Nadchodzą intensywne opady — zadbaj o zatrzymanie wody na swoim polu",
        _sections(
            _rain_happening(c),
            [
                "Nie wykopuj ani nie pogłębiaj rowów odprowadzających wodę bez wcześniejszej oceny warunków. "
                "Mogłoby to dodatkowo przyspieszyć jej odpływ.",
                "W miejscach, w których regularnie obserwujesz spływ wody, rozważ pasy roślinności "
                "spowalniające odpływ i sprzyjające wsiąkaniu.",
                "Po opadach sprawdź dolną część pola, aby zidentyfikować miejsca największego spływu.",
            ],
            "Spowolnienie odpływu może zwiększyć ilość wody zatrzymywanej w glebie "
            "i ograniczyć jej straty podczas ulewnych deszczy.",
        ),
    )


def _residue(c):
    return (
        "Zbiory kukurydzy za tydzień — pozostaw resztki pożniwne na wskazanej części pola",
        _sections(
            "Zbliżają się zbiory kukurydzy. To moment, w którym możesz zdecydować, jak zagospodarować "
            f"resztki pożniwne. Wyniki wcześniejszego eksperymentu na Twoim polu{_named(c)} wskazały, że gleba pod "
            "pozostawionymi resztkami roślinnymi dłużej utrzymywała wilgoć niż gleba na fragmencie kontrolnym.",
            [
                f"Na górnej, {c['soil_part']} części pola po zbiorach pozostaw równomiernie rozdrobnione "
                "resztki kukurydzy na powierzchni gleby.",
                "Unikaj ich usuwania z tego obszaru, jeśli nie koliduje to z wymaganiami kolejnej uprawy.",
                "Na pozostałej części działki dostosuj sposób zagospodarowania resztek do warunków glebowych "
                "i planowanego siewu.",
            ],
            "Pozostawione resztki osłaniają powierzchnię gleby i ograniczają parowanie. Na Twoim polu wcześniejszy "
            "eksperyment wskazał, że praktyka ta może poprawiać utrzymywanie wilgoci, bez konieczności inwestowania "
            "w dodatkowy sprzęt.",
        ),
    )


def _esc(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def demo(kind, field_name=None, soil="sandy", terrain="sloped"):
    """Mail demo: {subject, html, text}. Struktura: Co się dzieje? / Co warto zrobić? / Dlaczego?"""
    if kind not in DEMO_KINDS:
        raise ValueError("Nieznany rodzaj powiadomienia demo.")
    context = demo_context(field_name, soil, terrain)
    subject, s = (_rain if kind == "rain" else _residue)(context)
    text = (
        f"{subject}\n\nCo się dzieje?\n{s['happening']}\n\nCo warto zrobić?\n"
        + "\n".join(f"- {a}" for a in s["actions"])
        + f"\n\nDlaczego?\n{s['why']}\n\nOtwórz aplikację: {base_url()}/pola\n"
        "To podpowiedź pomocnicza, nie zalecenie zabiegu." + FOOTER
    )
    html = (
        f"<h1>{_esc(subject)}</h1><h2>Co się dzieje?</h2><p>{_esc(s['happening'])}</p>"
        "<h2>Co warto zrobić?</h2><ul>" + "".join(f"<li>{_esc(a)}</li>" for a in s["actions"]) + "</ul>"
        f"<h2>Dlaczego?</h2><p>{_esc(s['why'])}</p>"
        f'<p><a href="{_esc(base_url())}/pola">Otwórz aplikację</a></p>'
        "<p><small>To podpowiedź pomocnicza, nie zalecenie zabiegu. WodoStrażnik. Wiadomość demonstracyjna.</small></p>"
    )
    return {"subject": subject, "html": html, "text": text, "sections": s}
