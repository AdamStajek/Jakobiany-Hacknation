import { Injectable, signal } from '@angular/core';

type InstallPrompt = Event & {prompt: () => Promise<void>; userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>};

/** Stan PWA: łączność z siecią i możliwość zainstalowania aplikacji na urządzeniu. */
@Injectable({providedIn: 'root'})
export class PwaStore {
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly canInstall = signal(false);
  private prompt: InstallPrompt | null = null;

  constructor() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.prompt = event as InstallPrompt;
      this.canInstall.set(true);
    });
    window.addEventListener('appinstalled', () => this.clear());
  }

  async install(): Promise<void> {
    const prompt = this.prompt;
    if (!prompt) return;
    await prompt.prompt();
    await prompt.userChoice;
    this.clear();
  }

  dismissInstall() { this.clear(); }

  private clear() {
    this.prompt = null;
    this.canInstall.set(false);
  }
}
