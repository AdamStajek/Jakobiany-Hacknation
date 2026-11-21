import { Component, inject } from '@angular/core';
import { DrawerModule } from 'primeng/drawer';
import { ButtonModule } from 'primeng/button';
import { EvidenceService } from '../core/evidence.service';
import { ClaimBadge } from './claim-badge';

/** Evidence Lens – panel boczny ze źródłem wskazanego faktu/wniosku. */
@Component({
  selector: 'app-evidence-drawer',
  imports: [DrawerModule, ButtonModule, ClaimBadge],
  template: `
    <p-drawer [visible]="ev.visible()" (visibleChange)="$event || ev.close()" position="right" header="Źródło (Evidence Lens)" styleClass="!w-[32rem] max-w-full">
      @if (ev.current(); as r) {
        <div class="flex flex-col gap-3">
          <h3 class="m-0 text-lg font-semibold">{{ r.title }}</h3>
          @if (r.expertStatus) { <app-claim-badge [kind]="r.expertStatus" /> }
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 m-0 text-sm">
            <dt class="text-muted-color">Identyfikator</dt><dd class="m-0">{{ r.sourceId }}</dd>
            @if (r.documentVersionId) { <dt class="text-muted-color">Wersja</dt><dd class="m-0">{{ r.documentVersionId }}</dd> }
            @if (r.page) { <dt class="text-muted-color">Strona</dt><dd class="m-0">{{ r.page }}</dd> }
            @if (r.paragraphId) { <dt class="text-muted-color">Akapit</dt><dd class="m-0">{{ r.paragraphId }}</dd> }
            @if (r.fetchedAt) { <dt class="text-muted-color">Pobrano</dt><dd class="m-0">{{ r.fetchedAt }}</dd> }
          </dl>
          @if (r.fragment) {
            <blockquote class="m-0 p-3 border-l-4 border-primary bg-surface-100 dark:bg-surface-800 rounded text-sm">{{ r.fragment }}</blockquote>
          } @else {
            <p class="text-sm text-muted-color m-0">Brak wskazanego fragmentu – informacja wymaga sprawdzenia.</p>
          }
          @if (r.url) {
            <a [href]="r.url" target="_blank" rel="noopener"><p-button label="Otwórz oryginał" icon="pi pi-external-link" severity="secondary" size="small" /></a>
          }
        </div>
      }
    </p-drawer>
  `,
})
export class EvidenceDrawer {
  protected readonly ev = inject(EvidenceService);
}
