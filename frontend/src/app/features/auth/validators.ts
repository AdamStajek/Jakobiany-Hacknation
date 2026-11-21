export const MIN_PASSWORD = 10;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Komunikat o niepoprawnym adresie e-mail albo pusty tekst. */
export function emailError(value: string): string {
  return EMAIL.test(value.trim()) ? '' : 'Wpisz poprawny adres e-mail, np. jan@example.pl.';
}

/** Nazwa użytkownika: 3–32 znaków, bez spacji i bez „@” (żeby nie mylić jej z e-mailem przy logowaniu). */
export function usernameError(value: string): string {
  const name = value.trim();
  if (name.length < 3 || name.length > 32) return 'Nazwa musi mieć od 3 do 32 znaków.';
  return /[\s@]/.test(name) ? 'Nazwa nie może zawierać spacji ani znaku @.' : '';
}

export function passwordError(value: string): string {
  return value.length >= MIN_PASSWORD ? '' : `Hasło musi mieć co najmniej ${MIN_PASSWORD} znaków (teraz: ${value.length}).`;
}

export function repeatError(password: string, repeat: string): string {
  return password === repeat ? '' : 'Hasła nie są takie same.';
}
