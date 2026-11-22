"""Porównaj alarm dla pszenicy z udziałem powierzchni zagrożonej wg SMSR 2024."""
from check_live import request

# Zboża ozime, tabela „Udział powierzchni zagrożonej suszą [%]” dla obu gmin.
# https://susza.iung.pulawy.pl/wykazy/2024,1415022/
# https://susza.iung.pulawy.pl/wykazy/2024,0620102/
CASES = {
    "141502_2.0001.171": [0.0, 99.75, 99.12],
    "062010_2.0008.14": [0.06, 0.0, 0.0],
}
DAYS = ["2024-05-20", "2024-06-20", "2024-06-30"]


def main():
    for parcel, coverage in CASES.items():
        for day, pct in zip(DAYS, coverage, strict=True):
            result = request("http://127.0.0.1:8080", "/api/analysis",
                             {"parcel_id": parcel, "date": day, "crop": "wheat"})
            assert result["parcel"]["id"] == parcel and result["date"] == day
            risk = result["metrics"]["risk"]
            if 0 < pct < 95 or risk not in {"Podwyższone", "Niskie w modelu"}:
                verdict = "nierozstrzygający"
            elif (pct >= 95) == (risk == "Podwyższone"):
                verdict = "zgodny"
            else:
                verdict = "rozbieżny"
            print(parcel, day, pct, risk, verdict, result["confidence"], result.get("agricultural"), flush=True)


if __name__ == "__main__":
    main()
