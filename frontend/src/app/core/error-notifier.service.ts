import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { describeError } from './api/error-policy';
import { ApiError } from './api/types';

/** Globalny stan błędów: baner braku połączenia, ekran braku dostępu i toasty dla błędów infrastruktury. */
@Injectable({ providedIn: 'root' })
export class ErrorNotifier {
  private readonly toast = inject(MessageService);
  private readonly router = inject(Router);
  /** Baner „brak połączenia”; znika po pierwszej udanej odpowiedzi API. */
  readonly offline = signal(false);

  markOnline() {
    if (this.offline()) this.offline.set(false);
  }

  report(e: ApiError) {
    if (e.status === 0) { this.offline.set(true); return; }
    const { summary, detail } = describeError(e);
    if (e.status === 401) {
      this.toast.add({ severity: 'warn', summary, detail, life: 6000 });
      void this.router.navigate(['/brak-dostepu'], { queryParams: { kod: 401 } });
      return;
    }
    this.toast.add({ severity: e.status >= 500 ? 'error' : 'warn', summary, detail, life: 6000 });
  }
}
