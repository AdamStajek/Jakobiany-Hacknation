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
