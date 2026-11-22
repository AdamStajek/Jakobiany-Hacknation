import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from '../api/api.service';
import { errorMessage } from '../api/errors';
import { keyToBytes } from '../pwa/service-worker';

type PushState = 'unsupported' | 'blocked' | 'off' | 'on';

/** Web Push na tym urządzeniu: zgoda przeglądarki, subskrypcja i jej zapis na serwerze. */
@Injectable({providedIn: 'root'})
export class PushStore {
  private readonly api = inject(ApiService);
  readonly state = signal<PushState>(this.supported() ? 'off' : 'unsupported');
  readonly busy = signal(false);
  readonly error = signal('');

  private supported(): boolean {
    return typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  /** Sprawdza, czy to urządzenie ma już subskrypcję, i odnawia jej zapis na serwerze. */
  async refresh(): Promise<void> {
    if (!this.supported()) { this.state.set('unsupported'); return; }
    if (Notification.permission === 'denied') { this.state.set('blocked'); return; }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      this.state.set(subscription ? 'on' : 'off');
      if (subscription) await this.save(subscription);
    } catch { this.state.set('off'); }
  }

  private async save(subscription: PushSubscription): Promise<void> {
    const {endpoint, keys} = subscription.toJSON();
    if (!endpoint || !keys?.['p256dh'] || !keys['auth']) throw new Error('Przeglądarka zwróciła niepełną subskrypcję.');
    await this.api.savePushSubscription({endpoint, keys: {p256dh: keys['p256dh'], auth: keys['auth']}});
  }

  /** Prosi o zgodę dopiero po kliknięciu użytkownika. */
  async enable(): Promise<boolean> {
    this.busy.set(true);
    this.error.set('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        this.state.set(permission === 'denied' ? 'blocked' : 'off');
        this.error.set('Bez zgody przeglądarki nie możemy wysyłać powiadomień. Zgodę zmienisz w ustawieniach strony.');
        return false;
      }
      const registration = await navigator.serviceWorker.ready;
      const {public_key} = await this.api.pushKey();
      const subscription = await registration.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: keyToBytes(public_key)});
      await this.save(subscription);
      this.state.set('on');
      return true;
    } catch (error) {
      this.error.set(errorMessage(error, 'Nie udało się włączyć powiadomień na tym urządzeniu.'));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  async disable(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await this.api.removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      this.state.set('off');
    } catch (error) {
      this.error.set(errorMessage(error, 'Nie udało się wyłączyć powiadomień na tym urządzeniu.'));
    } finally {
      this.busy.set(false);
    }
  }
}
