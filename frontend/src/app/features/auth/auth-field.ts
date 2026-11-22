import { Component, computed, input, model } from '@angular/core';
import { InputTextModule } from 'primeng/inputtext';

/** Pole formularza konta: etykieta, podpowiedź i błąd powiązane z inputem (aria). */
@Component({
  selector: 'app-auth-field',
  imports: [InputTextModule],
  template: `
    <div class="flex flex-col gap-1">
      <label [for]="id()" class="text-sm font-medium">{{label()}}</label>
      <input [id]="id()" [type]="type()" [value]="value()" (input)="value.set(read($event))" pInputText class="h-11 w-full dark:border-surface-400 dark:bg-surface-900"
        [attr.autocomplete]="autocomplete()" [attr.aria-invalid]="error() ? 'true' : null" [attr.aria-describedby]="describedBy()"
        autocapitalize="none" spellcheck="false" required />
      @if (hint() && !error()) { <p [id]="id() + '-hint'" class="text-xs text-muted-color">{{hint()}}</p> }
      @if (error()) {
        <p [id]="id() + '-error'" class="flex items-center gap-1 text-xs text-red-700 dark:text-red-400" role="alert">
          <i class="pi pi-exclamation-circle" aria-hidden="true"></i>{{error()}}
        </p>
      }
    </div>
  `,
})
export class AuthField {
  readonly id = input.required<string>();
  readonly label = input.required<string>();
  readonly type = input<'text' | 'email' | 'password'>('text');
  readonly autocomplete = input('off');
  readonly hint = input('');
  readonly error = input('');
  readonly value = model('');

  protected readonly describedBy = computed(() => (this.error() ? `${this.id()}-error` : this.hint() ? `${this.id()}-hint` : null));

  protected read(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
}
