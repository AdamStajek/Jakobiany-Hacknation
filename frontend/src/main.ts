import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { providePrimeNG } from 'primeng/config';
import { App } from './app/app';
import { AppPreset } from './app/theme';

bootstrapApplication(App, {
  providers: [
    provideHttpClient(),
    providePrimeNG({
      theme: { preset: AppPreset, options: { darkModeSelector: '.dark' } },
    }),
  ],
}).catch(console.error);
