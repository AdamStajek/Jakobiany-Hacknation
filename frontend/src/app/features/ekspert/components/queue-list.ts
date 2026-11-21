import { Component, computed, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { SelectModule } from 'primeng/select';
import { ApiError, ReviewItem, ReviewStatus, ReviewTargetType } from '../../../core/api/types';
import { REVIEW_STATUS, TARGET_TYPE_LABEL } from '../../../core/labels';
import { DataState, StatusBadge } from '../../../shared';
import { PAGE_SIZE, StatusFilter } from '../ekspert.facade';
import { Obj, itemTitle } from '../review.util';

const DEFAULT_STATUS = '';
const TYPES: ReviewTargetType[] = ['fact', 'link', 'risk', 'recommendation', 'risk_dna', 'pattern_candidate', 'sector_rules', 'project'];

@Component({
  selector: 'app-queue-list',
  imports: [FormsModule, ButtonModule, PaginatorModule, SelectModule, DataState, StatusBadge],
  template: `
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap gap-2 items-end">
        <label class="flex flex-col gap-1 text-xs text-muted-color grow">Status
          <p-select [options]="statusOptions" optionLabel="label" optionValue="value" [ngModel]="status()"
                    (ngModelChange)="filters.emit({ status: $event, type: type() })" ariaLabel="Filtr statusu" size="small" class="w-full" />
        </label>
        <label class="flex flex-col gap-1 text-xs text-muted-color grow">Typ
          <p-select [options]="typeOptions" optionLabel="label" optionValue="value" [ngModel]="type()"
                    (ngModelChange)="filters.emit({ status: status(), type: $event })" ariaLabel="Filtr typu" size="small" class="w-full" />
        </label>
      </div>
      <div class="flex items-center justify-between text-sm text-muted-color">
        <span role="status">{{ total() }} pozycji</span>
        <p-button label="Dodaj własny wpis" icon="pi pi-plus" size="small" severity="secondary" [text]="true" (onClick)="add.emit()" />
      </div>

      <app-data-state [loading]="loading()" [error]="error()" [empty]="!items().length"
                      emptyText="Brak pozycji dla wybranych filtrów." (retry)="retry.emit()">
        <ul class="list-none m-0 p-0 flex flex-col gap-2">
          @for (i of rows(); track i.key) {
            <li>
              <button type="button" (click)="select.emit(i.item)" [attr.aria-current]="i.key === selectedKey() ? 'true' : null"
                      class="w-full text-left p-3 rounded-lg border bg-surface-0 dark:bg-surface-900 cursor-pointer flex flex-col gap-1 hover:bg-surface-100 dark:hover:bg-surface-800"
                      [class]="i.key === selectedKey() ? 'border-primary' : 'border-surface'">
                <span class="flex items-center justify-between gap-2 text-xs text-muted-color">
                  <span>{{ i.type }}</span><app-status-badge type="review" [value]="i.item.review_status" />
                </span>
                <span class="text-sm font-medium break-words">{{ i.title }}</span>
                <span class="text-xs text-muted-color">{{ i.item.project_id ?? 'bez projektu' }} · rewizja {{ i.item.revision }}</span>
              </button>
            </li>
          }
        </ul>
        @if (total() > pageSize) {
          <p-paginator [first]="offset()" [rows]="pageSize" [totalRecords]="total()" (onPageChange)="page($event)" [showCurrentPageReport]="false" />
        }
      </app-data-state>
    </div>
  `,
})
export class QueueList {
  readonly items = input.required<ReviewItem[]>();
  readonly total = input(0);
  readonly loading = input(false);
  readonly error = input<ApiError | null>(null);
  readonly offset = input(0);
  readonly status = input<StatusFilter>(DEFAULT_STATUS);
  readonly type = input<ReviewTargetType | ''>('');
  readonly selectedKey = input<string | null>(null);

  readonly select = output<ReviewItem>();
  readonly filters = output<{ status: StatusFilter; type: ReviewTargetType | '' }>();
  readonly pageChange = output<number>();
  readonly retry = output<void>();
  readonly add = output<void>();

  protected readonly pageSize = PAGE_SIZE;
  protected readonly statusOptions = [
    { label: 'Do decyzji (propozycje i wymagające dowodów)', value: '' },
    ...Object.entries(REVIEW_STATUS).map(([value, m]) => ({ label: m.label, value })),
    { label: 'Wszystkie rekordy (także dane wejściowe projektów)', value: 'all' },
  ];
  protected readonly typeOptions = [{ label: 'Wszystkie typy', value: '' }, ...TYPES.map((value) => ({ label: TARGET_TYPE_LABEL[value], value }))];

  protected readonly rows = computed(() => this.items().map((item) => ({
    item, key: `${item.target_type}:${item.target_id}`, type: TARGET_TYPE_LABEL[item.target_type] ?? item.target_type,
    title: itemTitle(item.target_type, item.value as Obj, item.target_id),
  })));

  protected page(e: PaginatorState) { this.pageChange.emit(e.first ?? 0); }
}
