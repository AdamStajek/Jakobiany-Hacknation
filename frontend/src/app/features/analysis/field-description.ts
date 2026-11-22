import { Component, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../core/api/api.service';
import { errorMessage } from '../../core/api/errors';
import { ConfirmedDescription, DescribeAttributeKey, FieldDescription } from '../../core/api/types';
import { confirmedFrom, descriptionRows, withChoice } from '../../core/state/field-description';

@Component({
  selector: 'app-field-description',
  imports: [FormsModule, ButtonModule, MessageModule, SkeletonModule],
  templateUrl: './field-description.html',
  host: {class: 'block'},
})
export class FieldDescriptionInput {
  private readonly api = inject(ApiService);
  readonly confirmed = output<ConfirmedDescription>();

  protected readonly maxLength = 1000;
  protected readonly text = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly description = signal<FieldDescription | null>(null);
  protected readonly rows = computed(() => {
    const d = this.description();
    return d ? descriptionRows(d, d.attribute_labels) : [];
  });
  protected readonly canSubmit = computed(() => !!this.text().trim() && !this.loading());

  protected async organize() {
    if (!this.canSubmit()) return;
    this.loading.set(true);
    this.error.set('');
    try {
      this.description.set(await this.api.describeField(this.text().trim()));
    } catch (e) {
      this.error.set(errorMessage(e, 'Nie udało się uporządkować opisu. Spróbuj ponownie.'));
    } finally {
      this.loading.set(false);
    }
  }

  protected choose(key: DescribeAttributeKey, value: string | null) {
    const d = this.description();
    if (d) this.description.set(withChoice(d, key, d[key].value === value ? null : value));
  }

  protected edit() { this.description.set(null); }

  protected confirm() {
    const d = this.description();
    if (d) this.confirmed.emit(confirmedFrom(d));
  }
}
