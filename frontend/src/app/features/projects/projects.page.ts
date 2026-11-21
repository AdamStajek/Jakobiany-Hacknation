import { Component, inject, signal } from '@angular/core';
import { TableModule } from 'primeng/table';
import { RouterLink } from '@angular/router';
import { ProjectsApi } from '../../core/api/apis';
import { ApiError, Project } from '../../core/api/types';
import { DataState, PageHeader, StatusBadge } from '../../shared';

/** Zalążek repozytorium projektów (rozbudowa w 1A: filtry, paginacja, import). */
@Component({
  selector: 'app-projects-page',
  imports: [PageHeader, DataState, TableModule, StatusBadge, RouterLink],
  template: `
    <app-page-header title="Projekty" subtitle="Repozytorium historycznych inwestycji" />
    <app-data-state [loading]="loading()" [error]="error()" [empty]="!loading() && !projects().length" (retry)="load()">
      <p-table [value]="projects()" [tableStyle]="{ 'min-width': '40rem' }">
        <ng-template #header><tr><th>Tytuł</th><th>Status</th><th>Wzbogacenie</th><th>Ryzyka</th></tr></ng-template>
        <ng-template #body let-p>
          <tr>
            <td><a [routerLink]="['/projekty', p.id]">{{ p.title }}</a><div class="text-xs text-muted-color">{{ p.id }}</div></td>
            <td><app-status-badge type="project" [value]="p.status" /></td>
            <td>@if (p.enrichment_status) { <app-status-badge type="match" [value]="p.enrichment_status" /> }</td>
            <td>{{ p.counts.risks }}</td>
          </tr>
        </ng-template>
      </p-table>
    </app-data-state>
  `,
})
export class ProjectsPage {
  private readonly api = inject(ProjectsApi);
  protected readonly projects = signal<Project[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<ApiError | null>(null);

  constructor() { this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.list({ limit: 25, offset: 0 }).subscribe({
      next: (p) => { this.projects.set(p.items); this.loading.set(false); },
      error: (e: ApiError) => { this.error.set(e); this.loading.set(false); },
    });
  }
}
