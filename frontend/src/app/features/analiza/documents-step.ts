import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ProjectsApi } from '../../core/api/apis';
import { newIdempotencyKey } from '../../core/api/api-client';
import { ApiError, Job, ProjectDetail } from '../../core/api/types';
import { EXTRACTION_STATUS } from '../../core/labels';
import { JobProgress } from '../../shared';
import { errorText } from './analiza.util';

const ACCEPT = '.pdf,.docx';

/** Krok 2: wgrywanie PDF/DOCX (nowy dokument lub nowa wersja) i lista wersji ze statusem ekstrakcji. */
@Component({
  selector: 'app-documents-step',
  imports: [FormsModule, ButtonModule, SelectModule, TableModule, TagModule, JobProgress],
  template: `
    <div class="flex flex-col gap-4 max-w-4xl">
      <p class="m-0 text-muted-color">Dokumenty są opcjonalne. Możesz pominąć ten krok i analizować sam opis.</p>
      <div class="flex flex-wrap items-end gap-3 p-4 rounded-lg border border-surface">
        <div class="flex flex-col gap-1">
          <label for="doc-file" class="font-semibold">Plik (PDF lub DOCX)</label>
          <input id="doc-file" type="file" [accept]="accept" (change)="pick($event)" />
        </div>
        <div class="flex flex-col gap-1">
          <label for="doc-target" class="font-semibold">Zapisz jako</label>
          <p-select inputId="doc-target" [options]="targets()" optionLabel="label" optionValue="value" [(ngModel)]="target" />
        </div>
        <p-button label="Wgraj" icon="pi pi-upload" [disabled]="!file()" [loading]="uploading()" (onClick)="upload()" />
      </div>
      @if (error(); as e) {
        <div class="p-3 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950" role="alert">
          <i class="pi pi-times-circle"></i> {{ message(e) }}
        </div>
      }
      <app-job-progress [location]="location()" (finishedJob)="done($event)" />

      <p-table [value]="rows()" [tableStyle]="{ 'min-width': '36rem' }">
        <ng-template #header><tr><th>Dokument</th><th>Wersja</th><th>Typ pliku</th><th>Ekstrakcja</th></tr></ng-template>
        <ng-template #body let-r>
          <tr>
            <td>{{ r.doc }}</td>
            <td>{{ r.revision }}@if (r.current) { <span class="ml-1 text-xs text-muted-color">(aktualna)</span> }</td>
            <td>{{ r.media }}</td>
            <td><p-tag [value]="r.meta.label" [icon]="r.meta.icon" [severity]="r.meta.tone" /></td>
          </tr>
        </ng-template>
        <ng-template #emptymessage><tr><td colspan="4" class="text-muted-color">Brak wgranych dokumentów.</td></tr></ng-template>
      </p-table>
    </div>
  `,
})
export class DocumentsStep {
  readonly project = input.required<ProjectDetail>();
  readonly changed = output<void>();

  private readonly api = inject(ProjectsApi);
  protected readonly accept = ACCEPT;
  protected readonly file = signal<File | null>(null);
  protected readonly target = signal('');
  protected readonly uploading = signal(false);
  protected readonly location = signal<string | null>(null);
  protected readonly error = signal<ApiError | null>(null);
  protected readonly message = errorText;
  private key = newIdempotencyKey();

  protected readonly targets = computed(() => [
    { value: '', label: 'Nowy dokument' },
    ...this.project().documents.map((d) => ({ value: d.id, label: `Nowa wersja: ${d.document_type} (${d.id})` })),
  ]);
  protected readonly rows = computed(() =>
    this.project().documents.flatMap((d) => d.versions.map((v) => ({
      doc: d.document_type, revision: v.revision, media: v.media_type, current: v.id === d.current_version_id,
      meta: EXTRACTION_STATUS[v.extraction_status],
    }))));

  protected pick(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    this.file.set(f);
    this.error.set(null);
    if (f && !/\.(pdf|docx)$/i.test(f.name)) {
      this.file.set(null);
      this.error.set({ status: 415, code: 'unsupported_document_type', detail: '', fieldErrors: [] });
    }
  }

  protected upload() {
    const f = this.file();
    if (!f) return;
    this.uploading.set(true);
    this.error.set(null);
    this.api.uploadDocument(this.project().id, f, { documentId: this.target() || undefined }, this.key).subscribe({
      next: (r) => { this.uploading.set(false); this.location.set(r.location); this.key = newIdempotencyKey(); },
      error: (e: ApiError) => { this.uploading.set(false); this.error.set(e); if (!e.network) this.key = newIdempotencyKey(); },
    });
  }

  protected done(_job: Job) {
    this.file.set(null);
    this.changed.emit();
  }
}
