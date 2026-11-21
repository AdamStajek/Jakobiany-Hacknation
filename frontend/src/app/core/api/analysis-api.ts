import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { ApiClient } from './api-client';

export interface SubsectorOption { code: string; label: string; }

/** Katalog podsektorów z zatwierdzonych reguł sektorowych (potrzebny w formularzu projektu). */
@Injectable({ providedIn: 'root' })
export class SubsectorsApi {
  private readonly api = inject(ApiClient);
  list(sectorCode = 'water_and_sewerage') {
    return this.api.get<{ subsectors: SubsectorOption[] }[]>('/sector-rules', { sector_code: sectorCode })
      .pipe(map((rules) => rules[0]?.subsectors ?? []));
  }
}
