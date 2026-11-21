import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';

/** Ekran braku dostępu (401/403): wyjaśnia przyczynę i prowadzi na stronę startową roli. */
@Component({
  selector: 'app-access-denied-page',
  imports: [RouterLink],
  template: `
    <section class="max-w-xl mx-auto flex flex-col items-start gap-3 p-6 rounded-lg border border-surface" role="alert">
      <div class="flex items-center gap-2 text-xl font-semibold"><i class="pi pi-lock" aria-hidden="true"></i>{{ title }}</div>
      <p class="m-0">{{ text }}</p>
      <a [routerLink]="auth.home()" class="px-4 py-2 rounded-lg bg-primary text-primary-contrast no-underline">Przejdź na stronę startową roli</a>
    </section>
  `,
})
export class AccessDeniedPage {
  protected readonly auth = inject(AuthService);
  private readonly unauthenticated = inject(ActivatedRoute).snapshot.queryParamMap.get('kod') === '401';
  protected readonly title = this.unauthenticated ? 'Wymagane logowanie' : 'Brak dostępu';
  protected readonly text = this.unauthenticated
    ? 'Sesja jest nieważna lub brakuje tokenu dostępu. Wybierz rolę demo albo skonfiguruj token i spróbuj ponownie.'
    : 'Wybrana rola nie ma uprawnień do tego widoku. Zmień rolę w menu bocznym albo wróć na stronę startową.';
}
