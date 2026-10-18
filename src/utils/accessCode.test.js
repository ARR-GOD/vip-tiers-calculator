import { describe, it, expect } from 'vitest';
import { generateAccessCode, normalizeAccessCode, isValidAccessCode, formatAccessCode, clientPortalUrl } from './accessCode';

describe('access codes', () => {
  it('draws 12 Crockford base32 characters', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateAccessCode();
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
      expect(isValidAccessCode(code)).toBe(true);
    }
    expect(generateAccessCode(n => new Uint8Array(n).fill(255))).toBe('ZZZZZZZZZZZZ');
    expect(generateAccessCode(n => Uint8Array.from({ length: n }, (_, i) => i))).toBe('0123456789AB');
  });

  it('accepts typed codes in any case, with dashes, and lookalike letters', () => {
    expect(normalizeAccessCode(' abcd-1234-efgh ')).toBe('ABCD1234EFGH');
    expect(normalizeAccessCode('O0IL-l1io')).toBe('00111110');
    expect(isValidAccessCode(normalizeAccessCode('abcd-1234-efgh'))).toBe(true);
    expect(isValidAccessCode('ABCD1234EFG')).toBe(false);
    expect(isValidAccessCode('ABCD1234EFGU')).toBe(false);
  });

  it('formats codes and portal links', () => {
    expect(formatAccessCode('ABCD1234EFGH')).toBe('ABCD-1234-EFGH');
    expect(clientPortalUrl('ABCD1234EFGH', 'https://loyoly-setup.vercel.app')).toBe('https://loyoly-setup.vercel.app/client/ABCD-1234-EFGH');
  });
});
