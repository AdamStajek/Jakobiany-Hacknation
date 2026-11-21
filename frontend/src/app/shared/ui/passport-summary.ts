import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import type { Passport } from '../../core/api/types';

type Fact = {label: string; value: number; unit: string; hint?: string};

const FACTS: {key: string; label: string; unit: string; hint?: string}[] = [
  {key: 'parcel_area_ha', label: 'Powierzchnia', unit: 'ha'},
  {key: 'climatic_water_balance_30d_mm', label: 'Bilans wody z pogody (30 dni)', unit: 'mm',
    hint: 'Poniżej zera: opady nie pokryły wody, która mogła wyparować.'},
  {key: 'nearest_waterbody_distance_m', label: 'Do najbliższego zbiornika', unit: 'm'},
];

/** Krótki paszport pola: kilka liczb i jedno zdanie o sytuacji, ze stanami ładowania i błędu. Czysto prezentacyjny. */
@Component({
  selector: 'app-passport-summary',
  imports: [DatePipe, DecimalPipe, RouterLink, ButtonModule, MessageModule, SkeletonModule],
  template: `
    @if (loading()) {
      <div role="status" aria-label="Pobieramy paszport"><p-skeleton height="12rem" borderRadius="14px" /></div>
    } @else if (error()) {
      <p-message severity="error" icon="pi pi-exclamation-circle" role="alert">
        <span>{{error()}}</span>
        <p-button label="Spróbuj ponownie" size="small" severity="secondary" [text]="true" (onClick)="retry.emit()" />
      </p-message>
    } @else if (data(); as passport) {
    <article class="pw-card flex flex-col gap-4 p-4" [attr.aria-label]="'Paszport: ' + title()">
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

      @if (facts().length) {
        <dl class="grid gap-3 sm:grid-cols-3">
          @for (fact of facts(); track fact.label) {
            <div class="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
              <dt class="text-xs text-muted-color">{{fact.label}}</dt>
              <dd class="mt-1 text-lg font-semibold">{{fact.value | number:'1.0-2':'pl'}} <span class="text-sm font-normal text-muted-color">{{fact.unit}}</span></dd>
              @if (fact.hint) { <dd class="mt-1 text-xs text-muted-color">{{fact.hint}}</dd> }
            </div>
          }
        </dl>
      } @else {
        <p class="text-sm text-muted-color">Brak danych liczbowych dla tej działki.</p>
      }

      <a [routerLink]="['/dzialka', passport.parcel_id]" class="text-sm font-medium text-primary underline">Pełna analiza działki</a>
    </article>
    }
  `,
})
export class PassportSummary {
  readonly data = input<Passport | null>(null);
  readonly loading = input(false);
  readonly error = input('');
  readonly retry = output<void>();
  readonly title = input.required<string>();
  readonly subtitle = input('');

  protected readonly facts = computed<Fact[]>(() => FACTS.flatMap(({key, ...rest}) => {
    const item = this.data()?.fields.find((f) => f.field === key && f.status === 'ok');
    return item && typeof item.value === 'number' ? [{...rest, value: item.value}] : [];
  }));
}
