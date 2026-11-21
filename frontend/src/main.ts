import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { providePrimeNG } from 'primeng/config';
import { App } from './app/app';
import { AppPreset } from './app/theme';
import { routes } from './app/app.routes';

bootstrapApplication(App, {
  providers: [
    provideHttpClient(),
    provideRouter(routes),
    providePrimeNG({
      theme: { preset: AppPreset, options: { darkModeSelector: '.dark' } },
    }),
  ],
}).catch(console.error);
