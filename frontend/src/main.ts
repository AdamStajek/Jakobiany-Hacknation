import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { registerServiceWorker } from './app/core/pwa/service-worker';

bootstrapApplication(App, appConfig).catch(console.error);
registerServiceWorker();
