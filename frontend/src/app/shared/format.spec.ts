import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime } from './format';

describe('formatDateTime', () => {
  it('formatuje znacznik ISO po polsku w czasie polskim', () => {
    // Separator daty i godziny zależy od wersji ICU (przecinek lub spacja).
    expect(formatDateTime('2026-11-21T22:16:02+00:00')).toMatch(/^21 listopada 2026,? 23:16$/);
    expect(formatDateTime('2026-07-05T10:00:00+00:00')).toMatch(/^5 lipca 2026,? 12:00$/);
  });
  it('zwraca pusty tekst dla braku i oryginał dla błędnej wartości', () => {
    expect(formatDateTime(null)).toBe('');
    expect(formatDateTime('wczoraj')).toBe('wczoraj');
  });
});

describe('formatDate', () => {
  it('formatuje samą datę po polsku', () => {
    expect(formatDate('2024-07-05')).toBe('5 lipca 2024');
    expect(formatDate(undefined)).toBe('');
  });
});
