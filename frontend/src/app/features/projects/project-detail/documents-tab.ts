import { Component, input } from '@angular/core';
import { TableModule } from 'primeng/table';
import { DocumentVersion, ProjectDocument } from '../../../core/api/types';
import { EXTRACTION_STATUS, PROVIDER_LABEL } from '../../../core/labels';
import { DataState } from '../../../shared';
import { StatusTag } from './status-tag';

@Component({
  selector: 'app-documents-tab',
  imports: [TableModule, DataState, StatusTag],
  template: `
    <app-data-state [empty]="!documents().length" emptyText="Brak dokumentów. Wgraj dokumentację w kroku „Nowa inwestycja”.">
      @for (d of documents(); track d.id) {
        <section class="mb-4">
          <h4 class="m-0 mb-2">{{ d.document_type }} <span class="text-sm font-normal text-muted-color">({{ d.id }})</span></h4>
          <p-table [value]="d.versions" [tableStyle]="{ 'min-width': '40rem' }">
            <ng-template #header><tr><th>Wersja</th><th>Typ pliku</th><th>Źródło</th><th>Data wydania</th><th>Ekstrakcja</th></tr></ng-template>
            <ng-template #body let-v>
              <tr>
                <td>{{ v.revision }}@if (v.id === d.current_version_id) { <span class="ml-1 text-xs text-muted-color">(aktualna)</span> }</td>
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
  protected readonly extraction = (s: DocumentVersion["extraction_status"]) => EXTRACTION_STATUS[s];
  protected readonly provider = (p: string) => PROVIDER_LABEL[p] ?? p;
}
