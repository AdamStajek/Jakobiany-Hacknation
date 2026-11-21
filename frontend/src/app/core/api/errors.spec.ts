import { HttpErrorResponse } from '@angular/common/http';
import { errorMessage } from './errors';

const http = (status: number, error?: unknown) => new HttpErrorResponse({status, error});

describe('errorMessage', () => {
  it('zwraca komunikat tekstowy backendu', () => {
    expect(errorMessage(http(404, {detail: 'Nie znaleziono działki.'}))).toBe('Nie znaleziono działki.');
  });
  it('czyści prefiks walidatora pydantic', () => {
    expect(errorMessage(http(422, {detail: [{msg: 'Value error, Zła data.'}]}))).toBe('Zła data.');
  });
  it('rozpoznaje brak serwera', () => {
    expect(errorMessage(http(0))).toContain('niedostępny');
  });
  it('tłumaczy 503 na komunikat o budowie bazy działek', () => {
    expect(errorMessage(http(503))).toContain('Baza działek');
  });
  it('tłumaczy 429 na prośbę o ponowienie', () => {
    expect(errorMessage(http(429))).toContain('ponownie');
  });
  it('używa komunikatu zastępczego dla nieznanego błędu', () => {
    expect(errorMessage(new Error('x'), 'Zapasowy.')).toBe('Zapasowy.');
  });
});
