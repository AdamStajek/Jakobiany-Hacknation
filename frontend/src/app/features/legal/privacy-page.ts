import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Polityka prywatności i informacja o plikach cookie (RODO art. 13). */
@Component({
  selector: 'app-privacy-page',
  imports: [RouterLink],
  template: `
    <article class="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <header>
        <h1 class="pw-h1">Polityka prywatności</h1>
        <p class="text-sm text-muted-color">Ostatnia aktualizacja: 22 listopada 2026</p>
      </header>

      <section aria-labelledby="admin" class="space-y-2">
        <h2 id="admin" class="pw-h2">Kto odpowiada za dane</h2>
        <p>Administratorem danych jest zespół Jakobiany (HackNation 2026), twórca aplikacji Pole Widzenia.
          Kontakt w sprawach danych osobowych: adres podany w opisie projektu.</p>
      </section>

      <section aria-labelledby="dane" class="space-y-2">
        <h2 id="dane" class="pw-h2">Jakie dane zbieramy i po co</h2>
        <ul class="list-disc space-y-1 pl-5">
          <li><strong>Konto</strong> (adres e-mail, nazwa użytkownika, hasło zapisane wyłącznie jako skrót) — założenie konta, logowanie, potwierdzenie adresu i odzyskiwanie hasła. Podstawa: umowa o świadczenie usługi (art. 6 ust. 1 lit. b RODO).</li>
          <li><strong>Zapisane pola</strong> (numer i obrys działki, uprawa, odpowiedzi rolnika) — wyświetlanie analiz i raportów na koncie. Podstawa: umowa.</li>
          <li><strong>Powiadomienia</strong> (e-mail, powiadomienia push) — tylko po Twoim włączeniu. Podstawa: zgoda (art. 6 ust. 1 lit. a), którą możesz wycofać w dowolnym momencie.</li>
          <li><strong>Dane techniczne</strong> (adres IP w licznikach zapytań) — ochrona przed nadużyciami. Podstawa: uzasadniony interes (art. 6 ust. 1 lit. f). Liczniki działają w pamięci i nie są trwale zapisywane.</li>
        </ul>
        <p>Analizy używają publicznych danych (NASA POWER, GUGiK, Open-Meteo i in.). Do tych usług wysyłamy współrzędne analizowanej działki, nigdy Twoich danych konta.</p>
      </section>

      <section aria-labelledby="cookies" class="space-y-2">
        <h2 id="cookies" class="pw-h2">Cookies i pamięć przeglądarki</h2>
        <ul class="list-disc space-y-1 pl-5">
          <li><strong>wodo_session</strong> — niezbędne cookie sesji po zalogowaniu (HttpOnly, SameSite=Lax, Secure). Nie wymaga zgody.</li>
          <li><strong>localStorage</strong> (pola, motyw, tryb raportu) — zapisujemy dopiero po Twojej zgodzie w okienku na dole ekranu. Możesz ją zmienić w dowolnej chwili.</li>
          <li>Nie używamy cookies reklamowych ani analitycznych podmiotów trzecich.</li>
        </ul>
      </section>

      <section aria-labelledby="prawa" class="space-y-2">
        <h2 id="prawa" class="pw-h2">Twoje prawa</h2>
        <p>Masz prawo dostępu do danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przenoszenia i sprzeciwu,
          a także prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych. Konto i wszystkie powiązane dane
          usuniesz samodzielnie w <a routerLink="/konto" class="font-semibold text-primary underline">ustawieniach konta</a>.</p>
      </section>

      <section aria-labelledby="czas" class="space-y-2">
        <h2 id="czas" class="pw-h2">Jak długo przechowujemy dane</h2>
        <p>Dane konta i pól przechowujemy do czasu usunięcia konta. Sesja wygasa po okresie nieaktywności.
          Dane nie są sprzedawane ani przekazywane poza Europejski Obszar Gospodarczy przez nas samych.</p>
      </section>

      <section aria-labelledby="dostepnosc" class="space-y-2">
        <h2 id="dostepnosc" class="pw-h2">Dostępność</h2>
        <p>Dążymy do zgodności z WCAG 2.2 na poziomie AA: obsługa klawiaturą, kontrast, czytniki ekranu i tryb ograniczonego ruchu.
          Trudności z dostępnością zgłoś na adres kontaktowy projektu.</p>
      </section>
    </article>
  `,
})
export class PrivacyPage {}
