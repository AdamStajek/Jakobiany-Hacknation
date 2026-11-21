import { Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { REVIEW_STATUS } from '../../../core/labels';
import { Conflict } from '../ekspert.facade';
import { Obj, diffValues, display } from '../review.util';
import { fieldsFor } from '../target-fields';

/** Konflikt 409 `stale_revision`: porównanie pole po polu – baza, bieżący rekord i moja korekta. */
@Component({
  selector: 'app-conflict-diff',
  imports: [ButtonModule, MessageModule],
  template: `
    <p-message severity="warn" class="block">
      <div class="flex flex-col gap-3" role="alert">
        <strong>Rekord zmienił się, zanim zapisałeś decyzję (<code>stale_revision</code>).</strong>
        @if (conflict().theirs; as t) {
          <p class="m-0 text-sm">
            Twoja decyzja dotyczyła rewizji {{ conflict().base.revision }}, a bieżąca to {{ t.revision }}
            (status: {{ status(t.review_status) }}). Twoja korekta została zachowana w formularzu.
          </p>
          @if (rows().length) {
            <div class="overflow-x-auto">
              <table class="w-full text-sm border-collapse">
                <caption class="sr-only">Porównanie pól</caption>
                <thead><tr class="text-left text-muted-color">
                  <th class="p-2">Pole</th><th class="p-2">Przy otwarciu</th><th class="p-2">Teraz</th><th class="p-2">Moja korekta</th>
                </tr></thead>
                <tbody>
                  @for (r of rows(); track r.key) {
                    <tr class="border-t border-surface align-top">
                      <th scope="row" class="p-2 text-left font-medium">{{ r.label }}</th>
                      <td class="p-2 whitespace-pre-wrap break-words">{{ r.base }}</td>
                      <td class="p-2 whitespace-pre-wrap break-words" [class.font-semibold]="r.theirsChanged">{{ r.theirs }}</td>
                      <td class="p-2 whitespace-pre-wrap break-words">{{ r.mine }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="m-0 text-sm">Pola rekordu się nie różnią – zmienił się tylko status lub rewizja.</p>
          }
          <div class="flex flex-wrap gap-2">
            <p-button label="Zastosuj korektę do bieżącej rewizji" icon="pi pi-refresh" size="small" (onClick)="rebase.emit()" />
            <p-button label="Odrzuć moją korektę" icon="pi pi-trash" size="small" severity="secondary" (onClick)="discard.emit()" />
          </div>
        } @else {
          <p class="m-0 text-sm">Nie udało się pobrać bieżącego rekordu do porównania.</p>
          <p-button label="Spróbuj ponownie" icon="pi pi-refresh" size="small" (onClick)="reload.emit()" />
        }
      </div>
    </p-message>
  `,
})
export class ConflictDiff {
  readonly conflict = input.required<Conflict>();
  readonly rebase = output<void>();
  readonly discard = output<void>();
  readonly reload = output<void>();

  protected status = (s: string) => REVIEW_STATUS[s as keyof typeof REVIEW_STATUS]?.label ?? s;

  protected readonly rows = computed(() => {
    const { base, theirs, attempt } = this.conflict();
    if (!theirs) return [];
    const b = base.value as Obj, t = theirs.value as Obj, mine = attempt.changes ?? {};
    const labels = new Map(fieldsFor(base.target_type).map((f) => [f.key, f.label]));
    const keys = [...new Set([...diffValues(b, t).map((d) => d.key), ...Object.keys(mine)])];
    return keys.map((key) => ({
      key, label: labels.get(key) ?? key, base: display(b[key]), theirs: display(t[key]),
      mine: key in mine ? display(mine[key]) : '—', theirsChanged: JSON.stringify(b[key]) !== JSON.stringify(t[key]),
    }));
  });
}
