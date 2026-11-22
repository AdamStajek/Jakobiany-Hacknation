import { Injectable, signal } from '@angular/core';
import { ConfirmedDescription } from '../api/types';

/** Potwierdzony opis pola własnymi słowami; używany przy analizie, podglądzie maili demo i uzasadnieniach. */
@Injectable({providedIn: 'root'})
export class FieldDescriptionStore {
  readonly confirmed = signal<ConfirmedDescription | null>(null);
  readonly labels = signal<Record<'soil' | 'terrain' | 'problem' | 'constraint', string>>(
    {soil: 'Gleba', terrain: 'Teren', problem: 'Problem', constraint: 'Ograniczenie'});
  clear() { this.confirmed.set(null); }
}
