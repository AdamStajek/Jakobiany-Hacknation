import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ApiService } from '../../core/api/api.service';
import { errorMessage } from '../../core/api/errors';
import { DeliverySettings, NotificationPrefs, PushDemoKind } from '../../core/api/types';
import { AuthStore } from '../../core/state/auth.store';
import { FieldsStore } from '../../core/state/fields.store';
import { PushStore } from '../../core/state/push.store';
import { Panel } from '../../shared/ui/panel';

const FALLBACK_ZONES = ['Europe/Warsaw'];
const DEMOS: {kind: PushDemoKind; label: string; icon: string}[] = [
  {kind: 'water', label: 'Warto podlać pole', icon: 'pi-cloud-download'},
  {kind: 'rain', label: 'Intensywne opady', icon: 'pi-cloud'},
  {kind: 'frost', label: 'Przymrozek tej nocy', icon: 'pi-star'},
  {kind: 'heat', label: 'Upał jutro', icon: 'pi-sun'},
  {kind: 'residue', label: 'Zbiory kukurydzy', icon: 'pi-calendar'},
];

/** Powiadomienia push na tym urządzeniu oraz godziny ciszy i strefa czasowa (dla zalogowanych). */
@Component({
  selector: 'app-delivery-settings',
  imports: [ButtonModule, MessageModule, Panel],
  host: {class: 'block'},
  templateUrl: './delivery-settings.html',
})
export class DeliverySettingsPanel {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthStore);
  protected readonly push = inject(PushStore);
  private readonly fields = inject(FieldsStore);
  protected readonly demos = DEMOS;

  protected readonly prefs = signal<NotificationPrefs | null>(null);
  protected readonly error = signal('');
  protected readonly info = signal('');
  protected readonly saving = signal(false);
  protected readonly quietStart = signal('22:00');
  protected readonly quietEnd = signal('07:00');
  protected readonly timezone = signal('Europe/Warsaw');
  protected readonly zones = computed(() => {
    const list = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : FALLBACK_ZONES;
    return list.includes(this.timezone()) ? list : [this.timezone(), ...list];
  });
  protected readonly deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  protected readonly pushAvailable = computed(() => this.prefs()?.push_available ?? false);

  constructor() {
    effect(() => {
      if (this.auth.user()) untracked(() => void this.load());
    });
  }

  protected read(event: Event): string { return (event.target as HTMLInputElement | HTMLSelectElement).value; }
  protected checked(event: Event): boolean { return (event.target as HTMLInputElement).checked; }

  private apply(prefs: NotificationPrefs) {
    this.prefs.set(prefs);
    this.quietStart.set(prefs.quiet_start);
    this.quietEnd.set(prefs.quiet_end);
    this.timezone.set(prefs.timezone);
  }

  private async load() {
    try {
      this.apply(await this.api.notificationPrefs());
      await this.push.refresh();
    } catch (error) {
      this.error.set(errorMessage(error, 'Nie udało się pobrać ustawień dostarczania.'));
    }
  }

  private async update(change: Partial<DeliverySettings>, done: string) {
    this.saving.set(true);
    this.error.set('');
    this.info.set('');
    try {
      this.apply(await this.api.setNotificationPrefs(change));
      this.info.set(done);
    } catch (error) {
      this.error.set(errorMessage(error, 'Nie udało się zapisać ustawień. Spróbuj ponownie.'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async togglePush(on: boolean) {
    if (on) {
      if (!(await this.push.enable())) return;
      await this.update({push_enabled: true}, 'Powiadomienia push włączone na tym urządzeniu.');
    } else {
      await this.push.disable();
      await this.update({push_enabled: false}, 'Powiadomienia push wyłączone.');
    }
  }

  protected async sendTest(kind: PushDemoKind = 'basic') {
    this.error.set('');
    this.info.set('');
    try {
      await this.api.sendTestPush(kind, this.fields.fields()[0]?.name ?? null);
      this.info.set('Wysłano powiadomienie. Powinno pojawić się za chwilę.');
    } catch (error) {
      this.error.set(errorMessage(error, 'Nie udało się wysłać powiadomienia testowego.'));
    }
  }

  protected toggleQuiet(on: boolean) { return this.update({quiet_enabled: on}, on ? 'Godziny ciszy włączone.' : 'Godziny ciszy wyłączone.'); }

  protected saveQuiet() {
    return this.update({quiet_start: this.quietStart(), quiet_end: this.quietEnd(), timezone: this.timezone()},
      'Zapisano godziny ciszy i strefę czasową.');
  }
}
