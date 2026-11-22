"""Treści maili Pole Widzenia. Każdy szablon zwraca (temat, tekst, html); html składa `email_layout.shell`."""
from wodo import brand
from wodo.notify import email_layout as ui

FOOTER = "\n\n--\nPole Widzenia. Wiadomość wysłano automatycznie; powiadomienia wyłączysz w ustawieniach konta."
NOT_ADVICE = "To sygnały pomocnicze z modelu, nie zalecenie zabiegu."


def base_url():
    return brand.base_url()


def verification(username, token):
    link = f"{base_url()}/konto/potwierdz?token={token}"
    subject = "Potwierdź adres e-mail w Pole Widzenia"
    text = (f"Cześć {username},\n\nPotwierdź adres e-mail, aby dostawać powiadomienia o polach:\n{link}\n\n"
            "Link działa 48 godzin. Jeśli to nie Ty zakładałeś konto, zignoruj tę wiadomość." + FOOTER)
    html = ui.shell(subject, ui.para(f"Cześć {username},")
                    + ui.para("Potwierdź adres e-mail, aby dostawać powiadomienia o swoich polach.")
                    + ui.button("Potwierdź adres e-mail", link)
                    + ui.para("Link działa 48 godzin. Jeśli to nie Ty zakładałeś konto, zignoruj tę wiadomość.", muted=True),
                    preheader="Potwierdź adres e-mail, aby dostawać powiadomienia.")
    return subject, text, html


def reset(username, token):
    link = f"{base_url()}/konto/reset?token={token}"
    subject = "Ustaw nowe hasło w Pole Widzenia"
    text = (f"Cześć {username},\n\nAby ustawić nowe hasło, otwórz:\n{link}\n\n"
            "Link działa godzinę. Jeśli to nie Ty o to prosiłeś, zignoruj tę wiadomość: hasło się nie zmieni." + FOOTER)
    html = ui.shell(subject, ui.para(f"Cześć {username},") + ui.para("Aby ustawić nowe hasło, użyj przycisku poniżej.")
                    + ui.button("Ustaw nowe hasło", link)
                    + ui.para("Link działa godzinę. Jeśli to nie Ty o to prosiłeś, zignoruj tę wiadomość: hasło się nie zmieni.",
                              muted=True),
                    preheader="Link do ustawienia nowego hasła działa godzinę.")
    return subject, text, html


def welcome(username):
    subject = "Witaj w Pole Widzenia"
    link = f"{base_url()}/sprawdz"
    steps = ["Wyszukaj działkę po numerze albo wskaż punkt na mapie.",
             "Sprawdź, ile wody mieści gleba przy korzeniach i co mówią dane z satelity.",
             "Zapisz pole, aby dostawać powiadomienia, gdy będzie wymagało uwagi."]
    text = (f"Cześć {username},\n\nAdres e-mail potwierdzony. Co dalej:\n" + "\n".join(f"- {x}" for x in steps)
            + f"\n\nZacznij tutaj: {link}" + FOOTER)
    html = ui.shell(subject, ui.para(f"Cześć {username}, adres e-mail jest potwierdzony.") + ui.h2("Co dalej?")
                    + ui.bullets(steps) + ui.button("Przeanalizuj pierwsze pole", link),
                    preheader="Adres potwierdzony. Zobacz, od czego zacząć.")
    return subject, text, html


def password_changed(username):
    subject = "Twoje hasło w Pole Widzenia zostało zmienione"
    link = f"{base_url()}/zapomniane-haslo"
    text = (f"Cześć {username},\n\nHasło do Twojego konta właśnie zmieniono, a pozostałe aktywne sesje wylogowano.\n"
            f"Jeśli to nie Ty, ustaw hasło ponownie: {link}" + FOOTER)
    html = ui.shell(subject, ui.para(f"Cześć {username},")
                    + ui.callout("Hasło do Twojego konta właśnie zmieniono, a pozostałe aktywne sesje wylogowano.", warn=True)
                    + ui.para("Jeśli to Ty, nic nie musisz robić. Jeśli nie, ustaw hasło ponownie.")
                    + ui.button("Ustaw hasło ponownie", link),
                    preheader="Hasło zmieniono. Jeśli to nie Ty, zareaguj.")
    return subject, text, html


def attention(username, items):
    lines = [f"- {item['name']}: " + "; ".join(item["reasons"]) for item in items]
    count = len(items)
    subject = "Pole wymaga uwagi" if count == 1 else f"Pola wymagające uwagi: {count}"
    link = f"{base_url()}/pola"
    text = (f"Cześć {username},\n\nNa podstawie ostatnich analiz:\n" + "\n".join(lines)
            + f"\n\nOtwórz aplikację: {link}\n{NOT_ADVICE}" + FOOTER)
    html = ui.shell(subject, ui.para(f"Cześć {username}, na podstawie ostatnich analiz:")
                    + "".join(ui.callout(f"{item['name']}: " + "; ".join(item["reasons"]), warn=True) for item in items)
                    + ui.button("Otwórz moje pola", link) + ui.para(NOT_ADVICE, muted=True),
                    preheader=lines[0][2:])
    return subject, text, html


def recommendation_lines(items):
    return "\n\n".join(
        f"- {item['action']}\n  Dlaczego? {item['why']}\n"
        f"  Co wykazała analiza? {item['evidence']}\n  Kiedy? {item['when']}\n"
        f"  Warunki: {item['limits']}"
        for item in items
    )


def recommendation_cards(items):
    return "".join(
        ui.h2(item["action"]) + ui.para(f"Dlaczego? {item['why']}") + ui.para(f"Co wykazała analiza? {item['evidence']}")
        + ui.para(f"Kiedy? {item['when']}") + ui.para(f"Warunki: {item['limits']}", muted=True)
        for item in items)


def recommendations(username, field_id, field_name, parcel_id, items):
    subject = "Nowe rekomendacje dla Twojej działki"
    link = f"{base_url()}/pola?pole={field_id}"
    text = (f"Cześć {username},\n\nPole: {field_name}\nDziałka: {parcel_id}\n\n"
            "Po odświeżeniu danych pojawiły się nowe wstępne rekomendacje:\n\n"
            + recommendation_lines(items) + f"\n\nOtwórz pole: {link}" + FOOTER)
    html = ui.shell(subject, ui.para(f"Cześć {username},") + ui.callout(f"Pole: {field_name} · Działka: {parcel_id}")
                    + ui.para("Po odświeżeniu danych pojawiły się nowe wstępne rekomendacje:")
                    + recommendation_cards(items) + ui.button("Otwórz pole", link),
                    preheader=f"Nowe wstępne rekomendacje dla pola {field_name}.")
    return subject, text, html


def test_recommendation(username):
    example = {
        "action": "Sprawdź wilgotność gleby na głębokości korzeni przed podlewaniem.",
        "why": "Pomiar pomaga zdecydować, czy uprawa potrzebuje dodatkowej wody.",
        "evidence": "Przykład: model wskazuje możliwy niedobór wody.",
        "when": "Przed planowanym podlewaniem.",
        "limits": "Przykład ma charakter demonstracyjny.",
    }
    subject = "[TEST] Nowa rekomendacja dla działki"
    link = f"{base_url()}/konto"
    intro = ("To testowa wiadomość zamówiona w ustawieniach konta. "
             "Poniższa porada dotyczy przykładowej działki.")
    text = f"Cześć {username},\n\n{intro}\n\n" + recommendation_lines([example]) + f"\n\nUstawienia powiadomień: {link}"  + FOOTER + FOOTER
    html = ui.shell(subject, ui.para(f"Cześć {username},") + ui.callout(intro) + recommendation_cards([example])
                    + ui.button("Ustawienia powiadomień", link), preheader="Testowa wiadomość z ustawień konta.")
    return subject, text, html


def weekly_summary(username, summary):
    """Podsumowanie tygodnia: pola wymagające uwagi, bez raportu i z nieaktualnym raportem."""
    subject = "Twoje pola w tym tygodniu"
    link = f"{base_url()}/pola"
    attention_lines = [f"{item['name']}: " + "; ".join(item["reasons"]) for item in summary["attention"]]
    if attention_lines:
        lead = f"Pola wymagające uwagi: {len(attention_lines)} z {summary['total']}."
    else:
        lead = f"Według ostatnich raportów żadne z {summary['total']} pól nie wymaga pilnej uwagi."
    todo = []
    if summary["no_report"]:
        todo.append("Uruchom analizę dla pól bez raportu: " + ", ".join(summary["no_report"]) + ".")
    if summary["stale"]:
        todo.append("Odśwież nieaktualne raporty: " + ", ".join(summary["stale"]) + ".")
    text = f"Cześć {username},\n\n{lead}\n"
    if attention_lines:
        text += "\n" + "\n".join(f"- {line}" for line in attention_lines) + "\n"
    if todo:
        text += "\nCo warto zrobić:\n" + "\n".join(f"- {line}" for line in todo) + "\n"
    text += f"\nOtwórz moje pola: {link}\n{NOT_ADVICE}" + FOOTER
    body = ui.para(f"Cześć {username},") + ui.callout(lead, warn=bool(attention_lines))
    body += "".join(ui.callout(line, warn=True) for line in attention_lines)
    if todo:
        body += ui.h2("Co warto zrobić?") + ui.bullets(todo)
    body += ui.button("Otwórz moje pola", link) + ui.para(NOT_ADVICE, muted=True)
    return subject, text, ui.shell(subject, body, preheader=lead)


WEATHER_KINDS = {
    "rain": ("Intensywne opady",
             "Nie pogłębiaj rowów odprowadzających wodę bez oceny warunków. Po opadach sprawdź dolną część pola, "
             "żeby znaleźć miejsca największego spływu.",
             "Gwałtowny deszcz może spłynąć z pola, zamiast wsiąknąć w glebę."),
    "heat": ("Upał",
             "Sprawdź wilgotność gleby przy korzeniach. Jeśli podlewasz, rób to wcześnie rano, nie w południe.",
             "Wysoka temperatura zwiększa parowanie i ryzyko stresu wodnego uprawy."),
}


def weather_alert(username, items):
    """Alert pogodowy: `items` to {name, kind, day, detail}; jeden mail zbiera wszystkie pola użytkownika."""
    kinds = list(dict.fromkeys(item["kind"] for item in items))
    subject = ("Upał i intensywne opady" if len(kinds) == 2 else WEATHER_KINDS[kinds[0]][0]) + " w prognozie dla Twoich pól"
    link = f"{base_url()}/pola"
    text = f"Cześć {username},\n"
    body = ui.para(f"Cześć {username},")
    for kind in kinds:
        title, action, why = WEATHER_KINDS[kind]
        rows = [item for item in items if item["kind"] == kind]
        lines = [f"{item['name']} ({item['day']}): {item['detail']}" for item in rows]
        text += f"\n{title}\n" + "\n".join(f"- {line}" for line in lines) + f"\nCo warto zrobić? {action}\nDlaczego? {why}\n"
        body += ui.h2(title) + ui.bullets(lines) + ui.para(f"Co warto zrobić? {action}") + ui.para(f"Dlaczego? {why}", muted=True)
    text += f"\nOtwórz moje pola: {link}\nPrognoza jest niepewna i dotyczy punktu siatki modelu, nie Twojej działki." + FOOTER
    body += ui.button("Otwórz moje pola", link) + ui.para(
        "Prognoza jest niepewna i dotyczy punktu siatki modelu, nie Twojej działki.", muted=True)
    return subject, text, ui.shell(subject, body, preheader=f"{items[0]['name']}: {items[0]['detail']}")


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


def demo(kind, field_name=None, soil="sandy", terrain="sloped"):
    """Mail demo: {subject, html, text}. Struktura: Co się dzieje? / Co warto zrobić? / Dlaczego?"""
    if kind not in DEMO_KINDS:
        raise ValueError("Nieznany rodzaj powiadomienia demo.")
    context = demo_context(field_name, soil, terrain)
    subject, s = (_rain if kind == "rain" else _residue)(context)
    link = f"{base_url()}/pola"
    text = (
        f"{subject}\n\nCo się dzieje?\n{s['happening']}\n\nCo warto zrobić?\n"
        + "\n".join(f"- {a}" for a in s["actions"])
        + f"\n\nDlaczego?\n{s['why']}\n\nOtwórz aplikację: {link}\n"
        "To podpowiedź pomocnicza, nie zalecenie zabiegu." + FOOTER
    )
    body = (ui.h2("Co się dzieje?") + ui.para(s["happening"]) + ui.h2("Co warto zrobić?") + ui.bullets(s["actions"])
            + ui.h2("Dlaczego?") + ui.para(s["why"]) + ui.button("Otwórz aplikację", link))
    # Podgląd w przeglądarce nie ma załącznika CID, więc logo bierzemy z adresu aplikacji.
    html = ui.shell(subject, body, preheader=s["happening"][:90], logo_src=f"{base_url()}/assets/brand/pole_widzenia_z_napisem_przezroczyste.png",
                    note="To podpowiedź pomocnicza, nie zalecenie zabiegu. Wiadomość demonstracyjna.")
    return {"subject": subject, "html": html, "text": text, "sections": s}
