import { registerLocaleData } from '@angular/common';
import localePl from '@angular/common/locales/pl';
import { provideHttpClient } from '@angular/common/http';
import { LOCALE_ID } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';

registerLocaleData(localePl);
bootstrapApplication(App, {providers: [provideHttpClient(), {provide: LOCALE_ID, useValue: 'pl'}]})
  .catch(console.error);
