import { Component, computed, inject } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { EvidenceService } from '../core/evidence.service';
import { EXTRACTION_STATUS, PROVIDER_LABEL } from '../core/labels';
import { evidenceSource, locatorLabel, sourceTitle, sourceUrl, splitQuote } from '../core/evidence.util';
import { DataState } from './data-state';
import { ClaimBadge } from './claim-badge';

/** Evidence Lens – panel boczny ze źródłem wskazanego faktu/wniosku (dowód, wersja dokumentu, cytat). */
@Component({
  selector: 'app-evidence-drawer',
  imports: [DrawerModule, ButtonModule, TagModule, ClaimBadge, DataState],
  template: `
    <p-drawer [visible]="ev.visible()" (visibleChange)="$event || ev.close()" position="right" header="Źródło (Evidence Lens)" styleClass="!w-[32rem] max-w-full">
      @if (ev.current(); as r) {
        <div class="flex flex-col gap-3">
          <h3 class="m-0 text-lg font-semibold">{{ r.title }}</h3>
          @if (r.expertStatus) { <app-claim-badge [kind]="r.expertStatus" /> }
          <app-data-state [loading]="ev.state().loading" [error]="error()" (retry)="ev.retry()">
            @if (view(); as v) {
              @if (v.demo) { <p-tag value="Dane demonstracyjne" severity="secondary" icon="pi pi-info-circle" /> }
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 m-0 text-sm">
                <dt class="text-muted-color">Źródło</dt><dd class="m-0">{{ v.provider }}: {{ v.title }}</dd>
                <dt class="text-muted-color">Pobrano</dt><dd class="m-0">{{ v.retrievedAt }}</dd>
                @if (v.sourceVersion) { <dt class="text-muted-color">Wersja źródła</dt><dd class="m-0">{{ v.sourceVersion }}</dd> }
                <dt class="text-muted-color">Lokalizacja</dt><dd class="m-0">{{ v.locator }}</dd>
                @if (v.revision) { <dt class="text-muted-color">Wersja dokumentu</dt><dd class="m-0">{{ v.revision }}{{ v.issuedOn ? ' (' + v.issuedOn + ')' : '' }}</dd> }
                @if (v.extraction) { <dt class="text-muted-color">Ekstrakcja</dt><dd class="m-0">{{ v.extraction }}</dd> }
              </dl>
              @if (v.quote; as q) {
                <blockquote class="m-0 p-3 border-l-4 border-primary bg-surface-100 dark:bg-surface-800 rounded text-sm">{{ q.before }}@if (q.mark) {<mark>{{ q.mark }}</mark>}{{ q.after }}</blockquote>
              } @else {
                <p class="text-sm text-muted-color m-0" role="status">Brak sprawdzalnego cytatu – informacja wymaga sprawdzenia.</p>
              }
              @if (v.hasDocument) {
                @if (v.hasCopy) {
                  <p-button label="Otwórz kopię dokumentu" icon="pi pi-file-pdf" severity="secondary" size="small"
                            [loading]="ev.contentBusy()" (onClick)="ev.openContent()" />
                } @else {
                  <p class="text-sm text-muted-color m-0" role="status">Brak zachowanej kopii dokumentu dla tej wersji.</p>
                }
                @if (ev.contentError(); as ce) { <p class="text-sm text-red-600 m-0" role="alert">{{ ce }}</p> }
              }
              @if (v.url) {
                <a [href]="v.url" target="_blank" rel="noopener"><p-button label="Otwórz oryginał" icon="pi pi-external-link" severity="secondary" size="small" /></a>
              }
            }
          </app-data-state>
        </div>
      }
    </p-drawer>
  `,
})
export class EvidenceDrawer {
  protected readonly ev = inject(EvidenceService);

  protected readonly error = computed(() => {
    const e = this.ev.state().error;
    return e ? { status: 0, code: 'evidence', detail: e, fieldErrors: [] } : null;
  });

  protected readonly view = computed(() => {
    const { evidence: e, version } = this.ev.state();
    if (!e) return null;
    const s = evidenceSource(e);
    return {
      demo: s.provider === 'mock',
      provider: PROVIDER_LABEL[s.provider] ?? s.provider,
      title: sourceTitle(s),
      url: sourceUrl(s),
      retrievedAt: s.retrieved_at,
      sourceVersion: s.version,
      locator: locatorLabel(e.locator),
      quote: e.quote ? splitQuote(e.quote, e.char_offsets) : null,
      hasDocument: !!e.document_id,
      hasCopy: !!version?.content_url,
      revision: version?.revision,
      issuedOn: version?.issued_on,
      extraction: version ? EXTRACTION_STATUS[version.extraction_status].label : undefined,
    };
  });
}
