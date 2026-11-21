import { Component, effect, inject, input, signal } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { catchError, forkJoin, of } from 'rxjs';
import { EvidenceApi } from '../../../core/api/apis';
import { Evidence } from '../../../core/api/types';
import { evidenceSource, locatorLabel, sourceTitle, splitQuote } from '../../../core/evidence.util';
import { PROVIDER_LABEL } from '../../../core/labels';
import { DataState, EvidenceLink } from '../../../shared';

interface EvidenceView {
  id: string; demo: boolean; source: string; retrievedAt: string; locator: string;
  quote: { before: string; mark: string; after: string } | null;
}
interface EvidenceRow { id: string; view?: EvidenceView; failed?: boolean; }

/** Evidence Lens inline: cytat, źródło i lokalizacja każdego dowodu pozycji obok propozycji. */
@Component({
  selector: 'app-evidence-inline',
  imports: [TagModule, DataState, EvidenceLink],
  template: `
    <section aria-label="Dowody" class="flex flex-col gap-3">
      <h4 class="m-0 text-base font-semibold">Dowody ({{ ids().length }})</h4>
      @if (!ids().length) {
        <p class="m-0 text-sm text-muted-color" role="status">Pozycja nie ma dowodów – zatwierdzenie wymaga co najmniej jednego.</p>
      }
      <app-data-state [loading]="loading()" (retry)="load()">
        @for (r of rows(); track r.id) {
          <article class="p-3 rounded-lg border border-surface flex flex-col gap-2 text-sm">
            @if (r.view; as v) {
              <div class="flex flex-wrap items-center gap-2 text-xs text-muted-color">
                <span>{{ v.source }} · pobrano {{ v.retrievedAt }}</span>
                @if (v.demo) { <p-tag value="Dane demonstracyjne" severity="secondary" icon="pi pi-info-circle" /> }
              </div>
              @if (v.quote; as q) {
                <blockquote class="m-0 p-3 border-l-4 border-primary bg-surface-100 dark:bg-surface-800 rounded">{{ q.before }}@if (q.mark) {<mark>{{ q.mark }}</mark>}{{ q.after }}</blockquote>
              } @else {
                <p class="m-0 text-muted-color" role="status">Brak sprawdzalnego cytatu.</p>
              }
              <div class="flex items-center justify-between gap-2 text-xs text-muted-color">
                <span>{{ v.locator }}</span>
                <app-evidence-link [evidenceId]="r.id" label="Pełne źródło" />
              </div>
            } @else {
              <p class="m-0 text-red-600" role="alert">Nie udało się pobrać dowodu <code>{{ r.id }}</code>.</p>
            }
          </article>
        }
      </app-data-state>
    </section>
  `,
})
export class EvidenceInline {
  readonly ids = input.required<string[]>();
  private readonly api = inject(EvidenceApi);
  protected readonly rows = signal<EvidenceRow[]>([]);
  protected readonly loading = signal(false);
  private cache = new Map<string, EvidenceRow>();

  constructor() { effect(() => { this.ids(); this.load(); }); }

  protected load() {
    const ids = this.ids();
    if (!ids.length) { this.rows.set([]); return; }
    const missing = ids.filter((id) => !this.cache.get(id)?.view);
    if (!missing.length) { this.rows.set(ids.map((id) => this.cache.get(id)!)); return; }
    this.loading.set(true);
    forkJoin(missing.map((id) => this.api.get(id).pipe(catchError(() => of(null))))).subscribe((list) => {
      missing.forEach((id, i) => this.cache.set(id, list[i] ? { id, view: toView(list[i]) } : { id, failed: true }));
      this.rows.set(ids.map((id) => this.cache.get(id)!));
      this.loading.set(false);
    });
  }
}

function toView(e: Evidence): EvidenceView {
  const s = evidenceSource(e);
  return {
    id: e.id, demo: s.provider === 'mock', source: `${PROVIDER_LABEL[s.provider] ?? s.provider}: ${sourceTitle(s)}`,
    retrievedAt: s.retrieved_at, locator: locatorLabel(e.locator), quote: e.quote ? splitQuote(e.quote, e.char_offsets) : null,
  };
}
