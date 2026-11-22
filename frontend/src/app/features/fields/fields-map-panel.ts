import { Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Field } from '../../core/state/fields.store';
import { MapPrefsStore } from '../../core/state/map-prefs.store';
import { WodoMap } from '../../shared/map/wodo-map';
import { fieldPins, fieldShapes, mapGeometry } from './field-map';

/** Mapa wszystkich pól z kartą wybranego pola. */
@Component({
  selector: 'app-fields-map-panel',
  imports: [ButtonModule, RouterLink, WodoMap],
  templateUrl: './fields-map-panel.html',
  host: {class: 'relative block min-h-0 flex-1'},
})
export class FieldsMapPanel {
  protected readonly prefs = inject(MapPrefsStore);
  readonly fields = input.required<Field[]>();
  readonly selected = input<Field | null>(null);
  readonly hintSeen = input.required<boolean>();

  readonly picked = output<string | null>();
  readonly hintDismissed = output<void>();
  /** Id działki do analizy. */
  readonly analyze = output<string>();
  readonly passport = output<string>();

  protected readonly shapes = computed(() => fieldShapes(this.fields()));
  protected readonly pins = computed(() => fieldPins(this.fields()));
  protected readonly geometry = computed(() => mapGeometry(this.fields(), this.selected()));
}
