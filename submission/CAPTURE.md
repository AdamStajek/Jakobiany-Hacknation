# Odtworzenie demonstracji

Uruchom aplikację zgodnie z README. Na potrzeby powtórnego nagrania można wcześniej zweryfikować źródła i rozgrzać cache wejść.

```bash
cd frontend
npx playwright install chromium
WODO_CAPTURE=1 npm run test:e2e
cd ..
ffmpeg -y -i submission/.capture/chromium/demo.webm -c:v libx264 -crf 20 -pix_fmt yuv420p -movflags +faststart submission/demo.mp4
```

Nagranie prowadzi przez otwarcie aplikacji, wpisanie prawdziwego numeru działki, wybór ziemniaka i daty, uruchomienie analizy, wyjaśnienie rekomendacji, historię i pobranie PDF. Aplikacja pobiera rzeczywiste dane. Braki dostawców widnieją w raporcie.
