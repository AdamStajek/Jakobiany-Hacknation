import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { SkeletonModule } from 'primeng/skeleton';
import { ApiService } from '../../core/api/api.service';
import { errorMessage } from '../../core/api/errors';
import { DemoNotification, DemoNotificationKind } from '../../core/api/types';
import { AuthStore } from '../../core/state/auth.store';
import { ConsentStore } from '../../core/state/consent.store';
import { FieldDescriptionStore } from '../../core/state/field-description.store';
import { FieldsStore } from '../../core/state/fields.store';
import { NOTIFY_KEY, NotifyChannel, demoQuery, emailProblem, parseSettings } from '../../core/state/notification-settings';
import { Panel } from '../../shared/ui/panel';
import { DeliverySettingsPanel } from './delivery-settings';

const CHANNELS: {value: NotifyChannel; label: string}[] = [{value: 'email', label: 'E-mail'}, {value: 'app', label: 'Powiadomienia w aplikacji'}];

type PrefsState = 'loading' | 'ready' | 'error';

/** Ekran /powiadomienia: ustawienia powiadomień (konto albo ten telefon) i podgląd przykładowych wiadomości. */
@Component({
  selector: 'app-notifications-page',
  imports: [ButtonModule, MessageModule, SkeletonModule, Panel, DeliverySettingsPanel],
  host: {class: 'block'},
  templateUrl: './notifications-page.html',
})
export class NotificationsPage {
  private readonly api = inject(ApiService);
  protected readonly auth = inject(AuthStore);
  protected readonly consent = inject(ConsentStore);
  protected readonly fieldsStore = inject(FieldsStore);
  private readonly description = inject(FieldDescriptionStore);

  protected readonly prefsState = signal<PrefsState>('ready');
  protected readonly prefsError = signal('');
  protected readonly enabled = signal(false);
  protected readonly channel = signal<NotifyChannel>('email');
  protected readonly emailInput = signal('');
  protected readonly touched = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveInfo = signal('');
  protected readonly needsConsent = signal(false);

  protected readonly loggedIn = this.auth.loggedIn;
  protected readonly emailNeeded = computed(() => this.enabled() && this.channel() === 'email' && !this.loggedIn());
  protected readonly emailError = computed(() => (this.emailNeeded() ? emailProblem(this.emailInput()) : ''));
  protected readonly showEmailError = computed(() => this.touched() && this.emailError() !== '');

  protected readonly selectedField = signal('');
  protected readonly matched = computed(() => {
    const d = this.description.confirmed();
    return [d?.soil.label, d?.terrain.label].filter((v): v is string => !!v);
  });
  protected readonly preview = signal<DemoNotification | null>(null);
  protected readonly previewState = signal<'idle' | 'loading' | 'error'>('idle');
  protected readonly previewError = signal('');
  protected readonly previewKind = signal<DemoNotificationKind | null>(null);

  constructor() {
    effect(() => {
      const user = this.auth.user();
      untracked(() => { if (user) void this.loadAccountPrefs(); else this.loadLocal(); });
    });
  }

  protected readonly channels = CHANNELS;
  protected read(event: Event): string { return (event.target as HTMLInputElement | HTMLSelectElement).value; }
  protected checked(event: Event): boolean { return (event.target as HTMLInputElement).checked; }
  protected setChannel(value: NotifyChannel) { this.channel.set(value); }

  protected async loadAccountPrefs() {
    this.prefsState.set('loading');
    try {
      const prefs = await this.api.notificationPrefs();
      this.enabled.set(prefs.email_enabled);
      this.channel.set('email');
      this.prefsError.set('');
      this.prefsState.set('ready');
    } catch (error) {
      this.prefsError.set(errorMessage(error, 'Nie udało się pobrać ustawień powiadomień.'));
      this.prefsState.set('error');
    }
  }

  private loadLocal() {
    this.prefsState.set('ready');
    const saved = parseSettings(this.consent.read(NOTIFY_KEY));
    if (!saved) return;
    this.enabled.set(saved.enabled);
    this.channel.set(saved.channel);
    this.emailInput.set(saved.email);
  }

  protected async save() {
    this.touched.set(true);
    this.saveInfo.set('');
    this.prefsError.set('');
    this.needsConsent.set(false);
    if (this.emailError()) return;
    if (this.loggedIn()) await this.saveAccount(); else this.saveLocal();
  }

  private async saveAccount() {
    this.saving.set(true);
    try {
      const prefs = await this.api.setNotificationPrefs({email_enabled: this.enabled() && this.channel() === 'email'});
      this.saveInfo.set(prefs.email_enabled
        ? 'Zapisano. Powiadomienia będą przychodzić na e-mail z Twojego konta.'
        : 'Zapisano. Nie wyślemy Ci wiadomości e-mail.');
    } catch (error) {
      this.prefsError.set(errorMessage(error, 'Nie udało się zapisać ustawień. Spróbuj ponownie.'));
    } finally {
      this.saving.set(false);
    }
  }

  private saveLocal() {
    const result = this.consent.write(NOTIFY_KEY, JSON.stringify({enabled: this.enabled(), channel: this.channel(), email: this.emailInput().trim()}));
    if (result === 'saved') this.saveInfo.set('Zapisano na tym telefonie.');
    else if (result === 'skipped') this.needsConsent.set(true);
    else this.prefsError.set('Przeglądarka nie pozwoliła zapisać ustawień. Spróbuj ponownie.');
  }

  protected allowAndSave() {
    this.consent.grant();
    void this.save();
  }

  protected async show(kind: DemoNotificationKind) {
    this.previewKind.set(kind);
    this.previewState.set('loading');
    this.preview.set(null);
    try {
      const name = this.fieldsStore.fields().find((f) => f.id === this.selectedField())?.name ?? null;
      this.preview.set(await this.api.demoNotification(kind, demoQuery(this.description.confirmed(), name)));
      this.previewState.set('idle');
    } catch (error) {
      this.previewError.set(errorMessage(error, 'Nie udało się pokazać przykładu. Spróbuj ponownie.'));
      this.previewState.set('error');
    }
  }
}
