import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { ConfirmationService, MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { AppPreset } from './theme';
import { routes } from './app.routes';
import { authInterceptor, errorInterceptor, notifyInterceptor } from './core/api/interceptors';
import { mockInterceptor } from './core/mock/mock.interceptor';

registerLocaleData(localePl);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Kolejność: auth → mock (odpowiada zamiast sieci) → error (mapuje błędy mocka i sieci).
    provideHttpClient(withInterceptors([authInterceptor, notifyInterceptor, errorInterceptor, mockInterceptor])),
    provideRouter(routes, withComponentInputBinding()),
    provideAnimationsAsync(),
    { provide: LOCALE_ID, useValue: 'pl' },
    MessageService,
    ConfirmationService,
    providePrimeNG({
      theme: { preset: AppPreset, options: { darkModeSelector: '.dark' } },
    }),
  ],
};
