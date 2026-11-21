import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiError, Job, Schemas } from '../../core/api/types';
import { ImportsApi, ProjectsApi } from '../../core/api/apis';
import { JobProgress, PageHeader } from '../../shared';

@Component({
  selector: 'app-import-page',
  imports: [FormsModule, RouterLink, JobProgress, PageHeader],
  template: `
    <app-page-header title="Import i źródła" subtitle="Importuj rekordy historyczne i wyszukaj dokumentację zamówień w BZP i TED." />
    <div class="grid gap-4 xl:grid-cols-2">
      <form class="panel" (ngSubmit)="startImport()">
        <h2>Import projektów</h2>
        <label for="sheet">Arkusz konkursowy lub plik o tych samych nagłówkach (XLS, XLSX, CSV)</label>
        <input id="sheet" type="file" accept=".xls,.xlsx,.csv" #sheet (change)="file = sheet.files?.[0]" />
        <button class="action" [disabled]="!file || busy()">Zapisz i wzbogacaj</button>
      </form>
      <form class="panel" (ngSubmit)="refresh()">
        <h2>Odśwież dane projektu</h2>
        <label for="project-id">Identyfikator projektu z karty projektu</label>
        <input id="project-id" name="projectId" [(ngModel)]="projectId" required />
        <label for="provider">Dodatkowy identyfikator ogłoszenia (opcjonalnie)</label>
        <select id="provider" name="provider" [(ngModel)]="scheme"><option value="bzp">BZP</option><option value="ted">TED</option></select>
        <input aria-label="Numer ogłoszenia" name="reference" [(ngModel)]="reference" placeholder="Numer ogłoszenia" />
        <button class="action" [disabled]="!projectId.trim() || busy()">Pobierz dane publiczne</button>
      </form>
    </div>
    @if (error()) { <p class="text-red-600" role="alert">{{ error() }}</p> }
    <app-job-progress class="block mt-4" [location]="location()" (finishedJob)="complete($event)" (trackingError)="fail($event)" />
    @if (result(); as j) {
      <ul class="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        @for (r of j.results; track r.resource_id) {
          @if (r.resource_type === 'project') { <li><a [routerLink]="['/projekty', r.resource_id]">{{ r.resource_id }}</a></li> }
        }
      </ul>
    }
  `,
})
export class ImportPage {
  readonly projekt = input<string>();

  constructor() { effect(() => { this.projectId = this.projekt() ?? ""; }); }
  private readonly imports = inject(ImportsApi);
  private readonly projects = inject(ProjectsApi);
  protected file?: File;
  protected projectId = '';
  protected scheme: 'bzp' | 'ted' = 'bzp';
  protected reference = '';
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly location = signal<string | null>(null);
  protected readonly result = signal<Job | null>(null);

  protected startImport() {
    if (this.file && !this.busy()) this.run(this.imports.create(this.file));
  }

  protected refresh() {
    const references: Schemas['ExternalId'][] = this.reference.trim()
      ? [{ scheme: this.scheme, value: this.reference.trim() }] : [];
    if (!this.busy()) this.run(this.projects.enrich(this.projectId.trim(), undefined, references));
  }

  private run(request: ReturnType<ImportsApi['create']>) {
    this.busy.set(true);
    this.location.set(null);
    this.result.set(null);
    this.error.set('');
    request.subscribe({ next: (accepted) => this.location.set(accepted.location), error: (e: ApiError) => this.fail(e.detail) });
  }

  protected complete(job: Job) { this.result.set(job); this.busy.set(false); }

  protected fail(message: string) { this.error.set(message); this.busy.set(false); }
}
