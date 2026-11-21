import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProjectsApi } from '../../../core/api/apis';
import { ApiError, Schemas } from '../../../core/api/types';
import { JobProgress } from '../../../shared';

type Provider = Schemas['SourceLookup']['source'];

const OPTIONS = {
  procurement: { label: 'Dokumenty zamówień', hint: 'Zostaw puste, by użyć adresów z dopasowanych ogłoszeń BZP.', optional: true },
  funding: { label: 'Wykazy UE i KPO', hint: 'Numer projektu. Puste pole użyje identyfikatorów z karty.', optional: true },
  bip: { label: 'BIP i publikacje inwestora', hint: 'Adres HTTPS publikacji w zatwierdzonym BIP' },
  kio: { label: 'KIO', hint: 'Adres szczegółów orzeczenia w serwisie orzeczenia.uzp.gov.pl' },
  teryt: { label: 'GUS TERYT', hint: 'Kod TERC gminy, powiatu lub województwa' },
  bdl: { label: 'GUS BDL', hint: 'Dwunastocyfrowy identyfikator jednostki BDL' },
  kposk: { label: 'KPOŚK / AKPOŚK', hint: 'Identyfikator aglomeracji, np. PLDO001' },
  prices: { label: 'GUS · ceny budownictwa', hint: 'Miesiąc w formacie RRRR-MM' },
  krs: { label: 'KRS', hint: 'Numer KRS' },
  regon: { label: 'GUS REGON (BIR)', hint: 'Numer REGON lub NIP' },
} satisfies Record<Provider, { label: string; hint: string; optional?: boolean }>;

@Component({
  selector: 'app-source-lookup',
  imports: [FormsModule, JobProgress],
  template: `
    <form class="panel mb-4" (ngSubmit)="fetch()">
      <h2>Pobierz dane dla projektu</h2>
      <label for="lookup-source">Źródło</label>
      <select id="lookup-source" name="source" [(ngModel)]="provider" (ngModelChange)="query = ''">
        @for (option of options; track option[0]) { <option [value]="option[0]">{{ option[1].label }}</option> }
      </select>
      <label for="lookup-query">Identyfikator lub adres źródłowy</label>
      <input id="lookup-query" name="query" [(ngModel)]="query" aria-describedby="lookup-hint"
        maxlength="600" [required]="!optional(provider)" />
      <p id="lookup-hint" class="text-sm text-muted-color">{{ hint(provider) }}</p>
      <button class="action" [disabled]="busy() || (!query.trim() && !optional(provider))">Pobierz dane</button>
      @if (error()) { <p class="text-red-600" role="alert">{{ error() }}</p> }
      <app-job-progress [location]="location()" (finishedJob)="finished()" (trackingError)="fail($event)" />
    </form>
  `,
})
export class SourceLookup {
  readonly projectId = input.required<string>();
  readonly changed = output<void>();
  private readonly projects = inject(ProjectsApi);
  protected readonly options = Object.entries(OPTIONS);
  protected readonly location = signal<string | null>(null);
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly hint = (p: Provider) => OPTIONS[p].hint;
  protected readonly optional = (p: Provider) => 'optional' in OPTIONS[p];
  protected provider: Provider = 'procurement';
  protected query = '';

  protected fetch() {
    this.busy.set(true);
    this.location.set(null);
    this.error.set('');
    this.projects.lookup(this.projectId(), { source: this.provider, query: this.query.trim() }).subscribe({
      next: (a) => this.location.set(a.location),
      error: (e: ApiError) => this.fail(e.detail),
    });
  }

  protected finished() { this.busy.set(false); this.changed.emit(); }
  protected fail(message: string) { this.error.set(message); this.busy.set(false); }
}
