import { Component, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

/** Komunikaty nad listą pól: miejsce zapisu, migracja na konto, błędy i „Dodaj bieżącą działkę”. */
@Component({
  selector: 'app-fields-notices',
  imports: [ButtonModule, MessageModule],
  templateUrl: './fields-notices.html',
  host: {class: 'contents'},
})
export class FieldsNotices {
  readonly loggedIn = input.required<boolean>();
  readonly storageAllowed = input.required<boolean>();
  readonly offerMigration = input.required<boolean>();
  readonly localCount = input.required<number>();
  readonly migrating = input.required<boolean>();
  readonly error = input<string | null>(null);
  readonly analysisError = input<string | null>(null);
  /** Id bieżącej działki, którą można dodać do pól (null: nie ma czego dodawać). */
  readonly saveParcelId = input<string | null>(null);
  readonly saving = input(false);

  readonly reopenConsent = output<void>();
  readonly migrate = output<void>();
  readonly migrationDismissed = output<void>();
  readonly reload = output<void>();
  readonly retry = output<void>();
  readonly saveCurrent = output<void>();
}
