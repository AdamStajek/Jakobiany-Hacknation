import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import localePl from '@angular/common/locales/pl';
import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { provideEchartsCore } from 'ngx-echarts';
import { routes } from './app.routes';
import { AppPreset } from './theme';

registerLocaleData(localePl);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({scrollPositionRestoration: 'enabled'})),
    provideAnimationsAsync(),
    providePrimeNG({theme: {preset: AppPreset, options: {darkModeSelector: '.app-dark', cssLayer: {name: 'primeng', order: 'theme, base, primeng'}}}}),
    provideEchartsCore({echarts: () => import('./shared/charts/echarts-setup')}),
    {provide: LOCALE_ID, useValue: 'pl'},
  ],
};
