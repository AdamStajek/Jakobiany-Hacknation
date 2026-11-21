import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MultiSelectModule } from 'primeng/multiselect';
import { Requirement } from '../rules.types';

/** Jedna pozycja checklisty: kod, pytanie, uzasadnienie, waga, powiązane ryzyka, oczekiwane dowody. */
@Component({
  selector: 'app-requirement-row',
  imports: [FormsModule, ButtonModule, InputNumberModule, InputTextModule, MultiSelectModule],
  template: `
    <div class="grid gap-2 p-3 rounded-lg border border-surface md:grid-cols-2">
      <label class="flex flex-col gap-1 text-sm">Kod
        <input pInputText [ngModel]="req().code" (ngModelChange)="patch({ code: $event })" [disabled]="readonly()" />
      </label>
      <label class="flex flex-col gap-1 text-sm">Waga (&gt; 0)
        <p-inputnumber [ngModel]="req().weight" (ngModelChange)="patch({ weight: $event ?? 0 })" [min]="0" [maxFractionDigits]="2" [disabled]="readonly()" />
      </label>
      <label class="flex flex-col gap-1 text-sm md:col-span-2">Pytanie
        <input pInputText [ngModel]="req().question" (ngModelChange)="patch({ question: $event })" [disabled]="readonly()" />
      </label>
      <label class="flex flex-col gap-1 text-sm md:col-span-2">Uzasadnienie
        <input pInputText [ngModel]="req().rationale" (ngModelChange)="patch({ rationale: $event })" [disabled]="readonly()" />
      </label>
      <label class="flex flex-col gap-1 text-sm">Powiązane ryzyka
        <p-multiselect [options]="riskOptions()" [ngModel]="req().risk_codes" (ngModelChange)="patch({ risk_codes: $event })" [disabled]="readonly()" placeholder="Wybierz kody" display="chip" appendTo="body" />
      </label>
      <label class="flex flex-col gap-1 text-sm">Oczekiwane dowody (po jednym w wierszu)
        <textarea pInputText rows="2" [ngModel]="(req().expected_evidence ?? []).join('\n')" (ngModelChange)="patch({ expected_evidence: lines($event) })" [disabled]="readonly()"></textarea>
      </label>
      @if (!readonly()) {
        <div class="md:col-span-2 text-right">
          <p-button label="Usuń pozycję" icon="pi pi-trash" severity="danger" [text]="true" size="small" (onClick)="removed.emit()" />
        </div>
      }
    </div>
  `,
})
export class RequirementRow {
  readonly req = input.required<Requirement>();
  readonly riskCodes = input.required<string[]>();
  readonly readonly = input(false);
  readonly changed = output<Requirement>();
  readonly removed = output<void>();

  protected readonly riskOptions = computed(() => {
    const all = new Set([...this.riskCodes(), ...this.req().risk_codes]);
    return [...all].map((c) => ({ label: c, value: c }));
  });

  protected patch(p: Partial<Requirement>) { this.changed.emit({ ...this.req(), ...p }); }
  protected lines(v: string) { return v.split('\n').map((s) => s.trim()).filter(Boolean); }
}
