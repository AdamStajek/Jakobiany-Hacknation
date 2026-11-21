import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { forkJoin } from 'rxjs';
import { AssessmentsApi } from '../../../core/api/apis';
import { ApiError, Assessment, InformationCheck, Twin } from '../../../core/api/types';
import { saveBlob } from '../../../core/download';
import { DataState } from '../../../shared';
import { RunPanel } from '../run-panel';
import { DeviationsPanel } from './deviations-panel';
import { GapsPanel } from './gaps-panel';
import { RecommendationsPanel } from './recommendations-panel';
import { ScoreCards } from './score-cards';
import { TwinsPanel } from './twins-panel';

/** Wynik analizy: wskaźniki, bliźniaki, luki, odchylenia i rekomendacje; eksport i ponowne uruchomienie. */
@Component({
  selector: 'app-result-page',
  imports: [DatePipe, RouterLink, ButtonModule, TabsModule, DataState, ScoreCards, TwinsPanel, GapsPanel, DeviationsPanel,
    RecommendationsPanel, RunPanel],
  template: `
    <a routerLink="/analiza" class="text-sm"><i class="pi pi-arrow-left"></i> Nowa inwestycja</a>
    <app-data-state class="block mt-3" [loading]="loading()" [error]="error()" (retry)="load()">
      @if (a(); as a) {
        <header class="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 class="m-0 text-2xl font-bold">Wynik analizy</h2>
            <div class="text-sm text-muted-color">
              Projekt <a [routerLink]="['/projekty', a.project_id]">{{ a.project_id }}</a> ·
              {{ a.created_at | date: 'dd.MM.yyyy HH:mm' }} · metoda {{ a.snapshot.method_version }} ·
              rewizja projektu {{ a.snapshot.project_revision }}
            </div>
          </div>
          <div class="flex gap-2">
            <p-button label="Eksport JSON" icon="pi pi-download" size="small" severity="secondary" [loading]="exporting() === 'json'" (onClick)="export('json')" />
            <p-button label="Eksport CSV" icon="pi pi-download" size="small" severity="secondary" [loading]="exporting() === 'csv'" (onClick)="export('csv')" />
          </div>
        </header>

        <app-score-cards [a]="a" />

        @if (a.limitations.length) {
          <div class="mt-4 p-3 rounded-lg border border-surface text-sm" role="note">
            <b>Ograniczenia analizy</b>
            <ul class="m-0 mt-1 pl-5">@for (l of a.limitations; track $index) { <li>{{ l }}</li> }</ul>
          </div>
        }

        <p-tabs value="twins" class="mt-4">
          <p-tablist>
            <p-tab value="twins">Bliźniaki ({{ twins().length }})</p-tab>
            <p-tab value="gaps">Luki ({{ gaps().length }})</p-tab>
            <p-tab value="deviations">Odchylenia</p-tab>
            <p-tab value="recs">Rekomendacje ({{ a.recommendations.length }})</p-tab>
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="twins"><app-twins-panel [twins]="twins()" /></p-tabpanel>
            <p-tabpanel value="gaps"><app-gaps-panel [gaps]="gaps()" /></p-tabpanel>
            <p-tabpanel value="deviations"><app-deviations-panel [a]="a" /></p-tabpanel>
            <p-tabpanel value="recs"><app-recommendations-panel [items]="a.recommendations" /></p-tabpanel>
          </p-tabpanels>
        </p-tabs>

        <section class="mt-6 p-4 rounded-lg border border-surface flex flex-col gap-3">
          <h3 class="m-0 text-base">Uzupełnij i uruchom ponownie</h3>
          <p class="m-0 text-sm text-muted-color">Wgraj brakujące dokumenty lub popraw opis, a potem uruchom analizę na aktualnych danych.</p>
          <div class="flex flex-wrap gap-2">
            <a [routerLink]="['/analiza']" [queryParams]="{ projekt: a.project_id, krok: 1 }"><p-button label="Edytuj opis" icon="pi pi-pencil" severity="secondary" size="small" /></a>
            <a [routerLink]="['/analiza']" [queryParams]="{ projekt: a.project_id, krok: 2 }"><p-button label="Dodaj dokumenty" icon="pi pi-upload" severity="secondary" size="small" /></a>
          </div>
          <app-run-panel [projectId]="a.project_id" label="Uruchom ponownie" severity="secondary" />
        </section>
      }
    </app-data-state>
  `,
})
export class ResultPage {
  readonly assessmentId = input.required<string>();
  private readonly api = inject(AssessmentsApi);
  protected readonly a = signal<Assessment | null>(null);
  protected readonly twins = signal<Twin[]>([]);
  protected readonly gaps = signal<InformationCheck[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly exporting = signal<'json' | 'csv' | null>(null);

  constructor() { effect(() => { this.assessmentId(); this.load(); }); }

  protected load() {
    const id = this.assessmentId();
    this.loading.set(true);
    this.error.set(null);
    forkJoin({ a: this.api.get(id), twins: this.api.twins(id), gaps: this.api.gaps(id) }).subscribe({
      next: (r) => { this.a.set(r.a); this.twins.set(r.twins); this.gaps.set(r.gaps); this.loading.set(false); },
      error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
    });
  }

  protected export(format: 'json' | 'csv') {
    this.exporting.set(format);
    this.api.export(this.assessmentId(), format).subscribe({
      next: (res) => { saveBlob(res, `analiza.${format}`); this.exporting.set(null); },
      error: (e: ApiError) => { this.exporting.set(null); this.error.set(e); },
    });
  }
}
