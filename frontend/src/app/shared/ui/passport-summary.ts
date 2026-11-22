import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import type { Passport } from '../../core/api/types';

@Component({
  selector: 'app-passport-summary',
  imports: [DatePipe, DecimalPipe, RouterLink, ButtonModule, MessageModule, ProgressBarModule, SkeletonModule],
  template: `
    @if (loading()) {
      <div class="pw-card flex flex-col gap-3 p-4" role="status" aria-live="polite" aria-label="Pobieramy dane działki">
        <p class="flex items-center gap-2 text-sm font-medium">
          <i class="pi pi-spinner pi-spin motion-reduce:animate-none" aria-hidden="true"></i>{{progress() || 'Pobieramy dane działki…'}}
        </p>
        @if (percent() === null) { <p-progressbar mode="indeterminate" [style]="{height: '8px'}" aria-label="Postęp pobierania" /> }
        @else { <p-progressbar [value]="percent()" [showValue]="false" [style]="{height: '8px'}" aria-label="Postęp pobierania" /> }
        <p-skeleton height="6rem" borderRadius="14px" />
      </div>
    } @else if (error()) {
      <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">
        <span>{{error()}}</span>
        <p-button label="Spróbuj ponownie" size="small" severity="secondary" [text]="true" (onClick)="retry.emit()" />
      </p-message>
    } @else if (data(); as passport) {
    <article class="pw-card flex flex-col gap-4 p-4" [attr.aria-label]="'Dane działki: ' + title()">
      <header>
        <h2 class="break-words text-lg font-bold">{{title()}}</h2>
        <p class="text-sm text-muted-color">
          @if (subtitle()) { {{subtitle()}} · }
          Stan na {{passport.analysis_as_of | date:'dd.MM.yyyy'}}
        </p>
      </header>

      @if (passport.farmer_report; as plan) {
        <p class="text-sm">{{plan.situation}}</p>
        @if (plan.next_check) { <p class="text-sm text-muted-color">{{plan.next_check}}</p> }
      }

      <dl class="grid gap-3 lg:grid-cols-3">
        @for (fact of passport.summary; track fact.label) {
          <div class="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
            <dt class="text-sm text-muted-color">{{fact.label}}</dt>
            <dd class="mt-1 text-lg font-semibold wrap-break-word">
              @if (fact.value === null) {
                <span class="text-sm font-normal text-muted-color">Brak danych</span>
              } @else {
                {{typeof fact.value === 'number' ? (fact.value | number:'1.0-2') : fact.value}}
                @if (fact.unit) { <span class="text-sm font-normal text-muted-color">{{fact.unit}}</span> }
              }
            </dd>
            @if (fact.value !== null && fact.hint) { <dd class="mt-1 text-xs text-muted-color">{{fact.hint}}</dd> }
          </div>
        }
      </dl>

      <a [routerLink]="['/dzialka', passport.parcel_id]" class="text-sm font-medium text-primary underline">Pełna analiza działki</a>
    </article>
    }
  `,
})
export class PassportSummary {
  readonly data = input<Passport | null>(null);
  readonly loading = input(false);
  /** Etykieta bieżącego źródła i postęp 0–100 (null = nieokreślony). */
  readonly progress = input('');
  readonly percent = input<number | null>(null);
  readonly error = input('');
  readonly retry = output<void>();
  readonly title = input.required<string>();
  readonly subtitle = input('');
}
