import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { TagModule } from 'primeng/tag';
import { catchError, forkJoin, of } from 'rxjs';
import { EvidenceApi } from '../../../core/api/apis';
import { Evidence, ProjectDetail } from '../../../core/api/types';
import { PROVIDER_LABEL } from '../../../core/labels';
import { EvidenceIds } from './evidence-ids';
import { buildSourceGroups } from './sources';

const MAX_EVIDENCE = 25;

/** Pochodzenie danych: pięć źródeł (BZP, dokumenty, KPO, TERYT, BDL) z datą pobrania i znacznikiem dostawcy. */
@Component({
  selector: 'app-sources-tab',
  imports: [DatePipe, TagModule, EvidenceIds],
  template: `
    <div class="grid gap-4 md:grid-cols-2">
      @for (g of groups(); track g.key) {
        <section class="p-4 rounded-lg border border-surface bg-surface-0 dark:bg-surface-900">
          <div class="flex flex-wrap items-center gap-2">
            <h4 class="m-0">{{ g.title }}</h4>
            @if (g.demo) { <p-tag value="Dane demonstracyjne" severity="secondary" icon="pi pi-info-circle" /> }
          </div>
          <p class="m-0 mb-2 text-sm text-muted-color">{{ g.description }}</p>
          @for (i of g.items; track $index) {
            <div class="flex flex-wrap items-center gap-2 py-1 border-t border-surface">
              <span>{{ i.text }}</span>
              @if (i.provider) { <p-tag [value]="provider(i.provider)" severity="secondary" /> }
              @if (i.retrievedAt) { <span class="text-xs text-muted-color">pobrano {{ i.retrievedAt | date: 'yyyy-MM-dd HH:mm' }}</span> }
              @if (i.evidenceIds.length) { <app-evidence-ids [ids]="i.evidenceIds" /> }
            </div>
          } @empty { <p class="m-0 text-sm text-muted-color">Brak danych z tego źródła.</p> }
        </section>
      }
    </div>
    @if (truncated()) {
      <p class="text-sm text-muted-color">Pokazano źródła dla {{ max }} pierwszych dowodów projektu.</p>
    }
  `,
})
export class SourcesTab implements OnInit {
  readonly detail = input.required<ProjectDetail>();
  private readonly api = inject(EvidenceApi);
  private readonly evidence = signal<Evidence[]>([]);
  protected readonly max = MAX_EVIDENCE;
  protected readonly truncated = computed(() => this.detail().evidence_ids.length > MAX_EVIDENCE);
  protected readonly groups = computed(() => buildSourceGroups(this.detail(), this.evidence()));
  protected readonly provider = (p: string) => PROVIDER_LABEL[p] ?? p;

  ngOnInit() {
    const ids = this.detail().evidence_ids.slice(0, MAX_EVIDENCE);
    if (!ids.length) return;
    forkJoin(ids.map((id) => this.api.get(id).pipe(catchError(() => of(null)))))
      .subscribe((r) => this.evidence.set(r.filter((e): e is Evidence => !!e)));
  }
}
