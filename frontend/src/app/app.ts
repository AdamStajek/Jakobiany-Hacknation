import { Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

interface Row {
  id: number;
  name: string;
  role: string;
  status: 'Active' | 'Pending' | 'Offline';
}

@Component({
  selector: 'app-root',
  imports: [FormsModule, ButtonModule, CardModule, InputTextModule, SelectModule, TableModule, TagModule, ToastModule],
  providers: [MessageService],
  templateUrl: './app.html',
})
export class App {
  private readonly messages = inject(MessageService);

  readonly apiMessage = signal('Loading…');
  readonly apiOk = signal<boolean | null>(null);
  readonly dark = signal(false);

  name = '';
  role: string | null = null;
  readonly roles = ['Frontend', 'Backend', 'Design', 'PM'];

  readonly rows = signal<Row[]>([
    { id: 1, name: 'Anna', role: 'Frontend', status: 'Active' },
    { id: 2, name: 'Piotr', role: 'Backend', status: 'Pending' },
    { id: 3, name: 'Kasia', role: 'Design', status: 'Offline' },
  ]);

  constructor() {
    inject(HttpClient)
      .get<{ message: string }>('/api/hello')
      .subscribe({
        next: ({ message }) => {
          this.apiMessage.set(message);
          this.apiOk.set(true);
        },
        error: () => {
          this.apiMessage.set('Could not reach the API.');
          this.apiOk.set(false);
        },
      });
  }

  toggleDark() {
    this.dark.update((d) => !d);
    document.documentElement.classList.toggle('dark', this.dark());
  }

  add() {
    if (!this.name || !this.role) {
      this.messages.add({ severity: 'warn', summary: 'Uzupełnij pola', detail: 'Podaj imię i rolę.' });
      return;
    }
    this.rows.update((r) => [...r, { id: r.length + 1, name: this.name, role: this.role!, status: 'Pending' }]);
    this.messages.add({ severity: 'success', summary: 'Dodano', detail: this.name });
    this.name = '';
    this.role = null;
  }

  severity(s: Row['status']) {
    return s === 'Active' ? 'success' : s === 'Pending' ? 'warn' : 'secondary';
  }
}
