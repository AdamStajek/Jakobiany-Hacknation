import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectorRef, Component, contentChild, inject, input, signal, TemplateRef } from '@angular/core';

@Component({
  selector: 'app-report-question',
  imports: [NgTemplateOutlet],
  host: {class: 'block', '(window:beforeprint)': 'preparePrint()', '(window:afterprint)': 'printing.set(false)'},
  template: `
    <div class="pw-card">
      <button type="button" class="flex w-full items-start gap-3 rounded-xl p-4 text-left" [attr.aria-expanded]="open()"
        [attr.aria-controls]="sectionId()" (click)="open.set(!open())">
        <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-100 text-primary dark:bg-surface-700">
          <i class="pi {{icon()}}" aria-hidden="true"></i>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block font-semibold">{{question()}}</span>
          <span class="mt-0.5 block text-sm text-muted-color">{{finding()}}</span>
          @if (metrics()) {
            <span class="mt-1 block text-sm font-medium tabular-nums">{{metrics()}}</span>
          }
        </span>
        <i class="pi mt-2 text-xs text-muted-color print:hidden" [class]="open() ? 'pi-chevron-up' : 'pi-chevron-down'" aria-hidden="true"></i>
      </button>
      <div [id]="sectionId()">
        @if (open() || printing()) {
          <div class="space-y-3 border-t border-surface p-4 text-sm">
            <ng-container [ngTemplateOutlet]="body()" />
          </div>
        }
      </div>
    </div>
  `,
})
export class ReportQuestion {
  readonly sectionId = input.required<string>();
  readonly question = input.required<string>();
  readonly finding = input.required<string>();
  readonly metrics = input('');
  readonly icon = input.required<string>();
  protected readonly body = contentChild.required(TemplateRef);
  protected readonly open = signal(false);
  protected readonly printing = signal(false);
  private readonly changes = inject(ChangeDetectorRef);

  protected preparePrint() {
    this.printing.set(true);
    // Przeglądarka może wykonać migawkę przed kolejnym cyklem renderowania Angulara.
    this.changes.detectChanges();
  }
}
