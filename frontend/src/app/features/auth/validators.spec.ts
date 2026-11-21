import { emailError, passwordError, repeatError, usernameError } from './validators';

describe('walidatory formularzy konta', () => {
  it('e-mail', () => {
    expect(emailError('jan@example.pl')).toBe('');
    expect(emailError('jan@')).not.toBe('');
    expect(emailError('')).not.toBe('');
  });

  it('nazwa użytkownika', () => {
    expect(usernameError('jan_k')).toBe('');
    expect(usernameError('ab')).not.toBe('');
    expect(usernameError('jan k')).not.toBe('');
    expect(usernameError('jan@x')).not.toBe('');
  });

  it('hasło ma co najmniej 10 znaków', () => {
    expect(passwordError('123456789')).toContain('10');
    expect(passwordError('1234567890')).toBe('');
  });

  it('powtórzone hasło musi być takie samo', () => {
    expect(repeatError('a', 'a')).toBe('');
    expect(repeatError('a', 'b')).not.toBe('');
  });
});
