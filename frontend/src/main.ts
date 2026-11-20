import { Component, inject, signal } from '@angular/core';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';

@Component({
  selector: 'app-root',
  template: '<main><h1>Angular + FastAPI</h1><p role="status">{{ message() }}</p></main>',
})
class App {
  readonly message = signal('Loading…');

  constructor() {
    inject(HttpClient).get<{ message: string }>('/api/hello').subscribe({
      next: ({ message }) => this.message.set(message),
      error: () => this.message.set('Could not reach the API.'),
    });
  }
}

bootstrapApplication(App, { providers: [provideHttpClient()] }).catch(console.error);
