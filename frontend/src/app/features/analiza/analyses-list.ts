import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AssessmentsApi } from '../../core/api/apis';
import { ApiError, Assessment } from '../../core/api/types';
import { THREAT_LEVEL } from '../../core/labels';
import { DataState } from '../../shared';

/** Zapisane analizy projektu (GET /assessments?project_id=). */
@Component({
  selector: 'app-analyses-list',
  imports: [DatePipe, RouterLink, TableModule, TagModule, DataState],
  template: `
    <app-data-state [loading]="loading()" [error]="error()" [empty]="!items().length" emptyText="Ten projekt nie ma jeszcze zapisanych analiz." (retry)="load()">
      <p-table [value]="items()" [tableStyle]="{ 'min-width': '34rem' }">
        <ng-template #header><tr><th>Data</th><th>Zagrożenie</th><th>Kompletność</th><th></th></tr></ng-template>
        <ng-template #body let-a>
          <tr>
            <td>{{ a.created_at | date: 'dd.MM.yyyy HH:mm' }}</td>
            <td><p-tag [value]="threat(a).label" [icon]="threat(a).icon" [severity]="threat(a).tone" /></td>
            <td>{{ a.completeness.score === null ? 'brak podstaw' : pct(a.completeness.score) }}</td>
            <td><a [routerLink]="['/analiza', a.id]">Otwórz</a></td>
          </tr>
        </ng-template>
      </p-table>
    </app-data-state>
  `,
})
export class AnalysesList {
  readonly projectId = input.required<string>();
  private readonly api = inject(AssessmentsApi);
  protected readonly items = signal<Assessment[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<ApiError | null>(null);

  constructor() { effect(() => { this.projectId(); this.load(); }); }

  protected load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.list({ project_id: this.projectId(), limit: 20 }).subscribe({
      next: (p) => { this.items.set(p.items); this.loading.set(false); },
      error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
    });
  }
  protected threat = (a: Assessment) => THREAT_LEVEL[a.threat.level];
  protected pct = (n: number) => `${Math.round(n * 100)}%`;
}
