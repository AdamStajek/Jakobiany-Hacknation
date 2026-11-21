import { Component, computed, inject, input, signal, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { ProjectsApi } from '../../../core/api/apis';
import { AuthService } from '../../../core/auth.service';
import { ApiError, ProjectDetail } from '../../../core/api/types';
import { saveBlob } from '../../../core/download';
import { ID_SCHEME_LABEL } from '../../../core/labels';
import { DataState, MoneyAmount, StatusBadge } from '../../../shared';
import { DocumentsTab } from './documents-tab';
import { FactsTab } from './facts-tab';
import { LinksTab } from './links-tab';
import { RisksTab } from './risks-tab';
import { SourcesTab } from './sources-tab';
import { StructureTab } from './structure-tab';
import { TimelineTab } from './timeline-tab';

export const TABS = [
  { value: 'structure', label: 'Struktura' },
  { value: 'timeline', label: 'Oś czasu' },
  { value: 'risks', label: 'Zdarzenia i ryzyka' },
  { value: 'documents', label: 'Dokumenty' },
  { value: 'links', label: 'Powiązania' },
  { value: 'facts', label: 'Twierdzenia' },
  { value: 'sources', label: 'Źródła danych' },
] as const;
type TabId = (typeof TABS)[number]['value'];

/** Karta projektu: nagłówek, eksport i zakładki renderowane leniwie (po wybraniu). */
@Component({
  selector: 'app-project-detail-page',
  imports: [RouterLink, ButtonModule, TabsModule, TagModule, DataState, StatusBadge, MoneyAmount, StructureTab,
    TimelineTab, RisksTab, DocumentsTab, LinksTab, FactsTab, SourcesTab],
  template: `
    <a routerLink="/projekty" class="text-sm"><i class="pi pi-arrow-left"></i> Wszystkie projekty</a>
    <app-data-state class="block mt-3" [loading]="loading()" [error]="error()" (retry)="load()">
      @if (detail(); as d) {
        <header class="flex flex-col gap-2 mb-4">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="m-0 text-2xl font-bold">{{ d.title }}</h2>
              <div class="text-sm text-muted-color">ID: <span class="font-mono">{{ d.id }}</span> · rewizja {{ d.revision }}</div>
            </div>
            <div class="flex gap-2">
              <p-button label="Eksport JSON" icon="pi pi-download" size="small" severity="secondary" [loading]="exporting() === 'json'" (onClick)="export('json')" />
              <p-button label="Eksport CSV" icon="pi pi-download" size="small" severity="secondary" [loading]="exporting() === 'csv'" (onClick)="export('csv')" />
            </div>
          </div>
          <div class="flex flex-wrap gap-3 text-sm">
            @if (d.kind === 'planned' && auth.can('analyse')) { <a routerLink="/analiza" [queryParams]="{ projekt: d.id }">Edytuj i analizuj</a> }
            @if (auth.can('decide')) { <a routerLink="/ekspert" [queryParams]="{ projekt: d.id }">Weryfikuj i edytuj rekordy</a> }
            @if (auth.can('enrich')) { <a routerLink="/import" [queryParams]="{ projekt: d.id }">Odśwież źródła</a> }
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <app-status-badge type="project" [value]="d.status" />
            @if (d.enrichment_status) { <app-status-badge type="match" [value]="d.enrichment_status" /> }
            @for (e of d.external_ids; track e.value) { <p-tag severity="secondary" [value]="scheme[e.scheme] + ': ' + e.value" /> }
          </div>
          @if (d.description) { <p class="m-0">{{ d.description }}</p> }
          @if (d.amounts.length) {
            <div class="flex flex-wrap gap-4">@for (a of d.amounts; track $index) { <app-money-amount [amount]="a" /> }</div>
          }
          <div class="text-sm text-muted-color">Powiązano: {{ d.counts.procedures }} postępowań · {{ d.counts.risks }} ryzyk · {{ d.counts.links }} powiązań</div>
        </header>

        <p-tabs [value]="current()" (valueChange)="select($event)" [scrollable]="true">
          <p-tablist>@for (t of tabs; track t.value) { <p-tab [value]="t.value">{{ t.label }}</p-tab> }</p-tablist>
        </p-tabs>
        <div class="pt-4" role="region" [attr.aria-label]="'Zakładka ' + current()">
          @switch (current()) {
            @case ('structure') { <app-structure-tab [procedures]="d.procedures" /> }
            @case ('timeline') { <app-timeline-tab [events]="d.timeline" /> }
            @case ('risks') { <app-risks-tab [projectId]="d.id" /> }
            @case ('documents') {
              <app-documents-tab [documents]="d.documents" [projectId]="d.id"
                [canUpload]="auth.can('decide') || (d.kind === 'planned' && auth.can('analyse'))" (changed)="load(false)" />
            }
            @case ('links') { <app-links-tab [links]="d.links" /> }
            @case ('facts') { <app-facts-tab [projectId]="d.id" /> }
            @case ('sources') { <app-sources-tab [detail]="d" /> }
          }
        </div>
      }
    </app-data-state>
  `,
})
export class ProjectDetailPage {
  /** Z trasy (`:id`) i z `?tab=` dzięki withComponentInputBinding. */
  readonly id = input.required<string>();
  readonly tab = input<string>();
  private readonly api = inject(ProjectsApi);
  private readonly router = inject(Router);
  private readonly toast = inject(MessageService);
  protected readonly auth = inject(AuthService);

  protected readonly tabs = TABS;
  protected readonly scheme = ID_SCHEME_LABEL;
  protected readonly detail = signal<ProjectDetail | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly exporting = signal<'json' | 'csv' | null>(null);
  protected readonly current = computed<TabId>(() => TABS.find((t) => t.value === this.tab())?.value ?? 'structure');

  constructor() { effect(() => { this.id(); this.load(); }); }

  protected load(showLoading = true) {
    this.loading.set(showLoading);
    this.error.set(null);
    this.api.get(this.id()).subscribe({
      next: (d) => { this.detail.set(d); this.loading.set(false); },
      error: (e: ApiError) => { this.detail.set(null); this.error.set(e); this.loading.set(false); },
    });
  }

  protected select(value: string | number | undefined) {
    this.router.navigate([], { queryParams: { tab: value }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected export(format: 'json' | 'csv') {
    this.exporting.set(format);
    this.api.export(this.id(), format).subscribe({
      next: (res) => { saveBlob(res, `project-${this.id()}.${format}`); this.exporting.set(null); },
      error: (e: ApiError) => {
        this.exporting.set(null);
        this.toast.add({ severity: 'error', summary: 'Eksport nie powiódł się', detail: e.detail });
      },
    });
  }
}
