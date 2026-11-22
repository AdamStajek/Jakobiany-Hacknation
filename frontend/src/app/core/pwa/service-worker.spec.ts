import { describe, expect, it } from 'vitest';
import { keyToBytes } from './service-worker';

describe('keyToBytes', () => {
  it('dekoduje base64url bez dopełnienia', () => {
    expect(Array.from(keyToBytes('AQID'))).toEqual([1, 2, 3]);
    expect(Array.from(keyToBytes('-_8'))).toEqual([251, 255]);
  });
});
