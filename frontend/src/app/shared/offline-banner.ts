import { Component, inject, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { ProjectsApi } from '../core/api/apis';
import { ErrorNotifier } from '../core/error-notifier.service';

/** Baner braku połączenia z serwerem; „Ponów” sprawdza dostępność API i chowa baner po sukcesie. */
@Component({
  selector: 'app-offline-banner',
  imports: [ButtonModule],
  template: `
    @if (notifier.offline()) {
      <div class="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-red-300 bg-red-50 dark:bg-red-950" role="alert">
        <i class="pi pi-wifi" aria-hidden="true"></i>
        <span class="grow">Brak połączenia z serwerem. Dane na ekranie mogą być nieaktualne.</span>
        <p-button label="Ponów" icon="pi pi-refresh" size="small" severity="secondary" [loading]="checking()" (onClick)="check()" />
      </div>
    }
  `,
})
export class OfflineBanner {
  protected readonly notifier = inject(ErrorNotifier);
  private readonly projects = inject(ProjectsApi);
  protected readonly checking = signal(false);

  protected check() {
    this.checking.set(true);
    // Udana odpowiedź zdejmuje baner w `notifyInterceptor` (markOnline); błąd sieci zostawia go widocznym.
    this.projects.list({ limit: 1 }).subscribe({
      next: () => this.checking.set(false),
      error: () => this.checking.set(false),
    });
  }
}
