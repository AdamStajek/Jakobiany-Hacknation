import { Component, inject, input, output, signal } from '@angular/core';
import { TableModule } from 'primeng/table';
import { EvidenceApi } from '../../../core/api/apis';
import { ApiError, DocumentVersion, ProjectDocument, asSource } from '../../../core/api/types';
import { saveBlob } from '../../../core/download';
import { EXTRACTION_STATUS, PROVIDER_LABEL } from '../../../core/labels';
import { DataState } from '../../../shared';
import { DocumentUpload } from '../../../shared/document-upload';
import { StatusTag } from './status-tag';

@Component({
  selector: 'app-documents-tab',
  imports: [TableModule, DataState, StatusTag, DocumentUpload],
  template: `
    @if (canUpload()) {
      <app-document-upload class="block mb-4" [projectId]="projectId()" [documents]="documents()" (changed)="changed.emit()" />
    }
    @if (error()) { <p class="text-red-600" role="alert">{{ error() }}</p> }
    <app-data-state [empty]="!documents().length" emptyText="Brak dokumentów.">
      @for (d of documents(); track d.id) {
        <section class="mb-4">
          <h4 class="m-0 mb-2">{{ d.document_type }} @if (d.exemplar) { · Materiał wzorcowy }
            <span class="text-sm font-normal text-muted-color">({{ d.id }})</span></h4>
          <p-table [value]="d.versions" [tableStyle]="{ 'min-width': '40rem' }">
            <ng-template #header><tr><th>Wersja</th><th>Typ pliku</th><th>Źródło</th><th>Data wydania</th><th>Ekstrakcja</th></tr></ng-template>
            <ng-template #body let-v>
              <tr>
                <td>{{ v.revision }}@if (v.id === d.current_version_id) { <span class="ml-1 text-xs text-muted-color">(aktualna)</span> }
                  @if (v.content_url) { <button class="underline cursor-pointer block" (click)="download(v)">{{ name(v) }}</button> }
                </td>
                <td>{{ v.media_type }}</td>
                <td>{{ provider(v.source.provider) }}</td>
                <td>{{ v.issued_on ?? '—' }}</td>
                <td><app-status-tag [meta]="extraction(v.extraction_status)" /></td>
              </tr>
            </ng-template>
          </p-table>
        </section>
      }
    </app-data-state>
  `,
})
export class DocumentsTab {
  readonly documents = input.required<ProjectDocument[]>();
  readonly projectId = input.required<string>();
  readonly canUpload = input(false);
  readonly changed = output<void>();
  private readonly api = inject(EvidenceApi);
  protected readonly error = signal('');
  protected readonly extraction = (s: DocumentVersion["extraction_status"]) => EXTRACTION_STATUS[s];
  protected readonly provider = (p: string) => PROVIDER_LABEL[p] ?? p;
  protected readonly name = (v: DocumentVersion) => asSource(v.source).name ?? 'Pobierz dokument';

  protected download(v: DocumentVersion) {
    this.error.set('');
    this.api.documentContent(v.document_id, v.id).subscribe({
      next: (r) => saveBlob(r, this.name(v)), error: (e: ApiError) => this.error.set(e.detail),
    });
  }
}
