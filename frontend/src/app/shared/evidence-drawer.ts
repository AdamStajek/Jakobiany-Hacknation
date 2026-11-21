import { Component, effect, inject, signal } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { EvidenceApi } from '../core/api/apis';
import { ApiError, Evidence, asSource } from '../core/api/types';
import { saveBlob } from '../core/download';
import { EvidenceService } from '../core/evidence.service';
import { PROVIDER_LABEL } from '../core/labels';

@Component({
  selector: 'app-evidence-drawer',
  imports: [DrawerModule],
  template: `
    <p-drawer [visible]="!!ev.current()" (visibleChange)="$event || ev.close()" position="right" header="Dowód źródłowy"
              styleClass="!w-[32rem] max-w-full">
      @if (loading()) { <p role="status">Wczytywanie dowodu…</p> }
      @if (error()) { <p class="text-red-600" role="alert">{{ error() }}</p> }
      @if (proof(); as p) {
        @let source = origin(p.source);
        <div class="flex flex-col gap-3">
          <h3 class="m-0 text-lg font-semibold">{{ source.name ?? provider(source.provider) }}</h3>
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 m-0 text-sm">
            <dt class="text-muted-color">Dowód</dt><dd class="m-0 break-words">{{ p.id }}</dd>
            <dt class="text-muted-color">Źródło</dt><dd class="m-0 break-words">{{ source.identifier ?? source.id }} · {{ provider(source.provider) }}</dd>
            <dt class="text-muted-color">Pobrano</dt><dd class="m-0">{{ source.retrieved_at }}</dd>
            @if (source.version) { <dt class="text-muted-color">Wersja źródła</dt><dd class="m-0 break-all">{{ source.version }}</dd> }
            <dt class="text-muted-color">Lokalizacja</dt><dd class="m-0">{{ locator(p.locator) }}</dd>
            @if (p.char_offsets) { <dt class="text-muted-color">Zakres znaków</dt><dd class="m-0">{{ p.char_offsets.start }}–{{ p.char_offsets.end }}</dd> }
          </dl>
          @if (p.quote) {
            <blockquote class="m-0 p-3 border-l-4 border-primary bg-surface-100 dark:bg-surface-800 rounded text-sm whitespace-pre-wrap">{{ p.quote }}</blockquote>
          } @else {
            <p class="text-sm text-muted-color m-0">Sprawdź wskazane pole lub dokument źródłowy.</p>
          }
          @if (source.original_url) { <a [href]="source.original_url" target="_blank" rel="noopener noreferrer">Otwórz oryginał</a> }
          @if (p.document_id && p.document_version_id) {
            <button type="button" class="action" (click)="download(p.document_id, p.document_version_id, source.name)">Pobierz wersję dokumentu</button>
          }
        </div>
      }
    </p-drawer>
  `,
})
export class EvidenceDrawer {
  protected readonly ev = inject(EvidenceService);
  private readonly api = inject(EvidenceApi);
  protected readonly proof = signal<Evidence | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly origin = asSource;
  protected readonly provider = (p: string) => PROVIDER_LABEL[p] ?? p;

  constructor() {
    effect((cleanup) => {
      const id = this.ev.current();
      this.proof.set(null);
      this.error.set('');
      this.loading.set(!!id);
      if (!id) return;
      const request = this.api.get(id).subscribe({
        next: (p) => { this.proof.set(p); this.loading.set(false); },
        error: (e: ApiError) => { this.error.set(e.detail); this.loading.set(false); },
      });
      cleanup(() => request.unsubscribe());
    });
  }

  protected locator(l: Evidence['locator']) {
    if (l.kind === 'pdf') return `Strona ${l.page}`;
    if (l.kind === 'table') return [l.sheet, `wiersz ${l.row}`, l.column].filter(Boolean).join(' · ');
    if (l.kind === 'record_field') return l.field;
    return `Akapit ${l.paragraph}`;
  }

  protected download(documentId: string, versionId: string, fileName?: string) {
    this.error.set('');
    this.api.documentContent(documentId, versionId).subscribe({
      next: (r) => saveBlob(r, fileName ?? 'dokument'),
      error: (e: ApiError) => this.error.set(e.detail),
    });
  }
}
