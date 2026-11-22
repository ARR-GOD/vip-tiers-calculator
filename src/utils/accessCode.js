// ════════════════════════════════════════════════════════════════════
// Client access codes — what a CSM shares to open the client portal
// ════════════════════════════════════════════════════════════════════
//
// 12 characters of Crockford base32 (≈ 60 bits): no I, L, O or U, so a code
// read aloud or retyped can't be confused. Stored without dashes, shown as
// XXXX-XXXX-XXXX.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ACCESS_CODE_LENGTH = 12;

// 256 is a multiple of 32, so `byte % 32` keeps every character equally likely.
export function generateAccessCode(randomBytes = n => crypto.getRandomValues(new Uint8Array(n))) {
  return Array.from(randomBytes(ACCESS_CODE_LENGTH), b => ALPHABET[b % 32]).join('');
}

// Typed codes: any case, dashes or spaces, and the letters Crockford maps to digits.
export function normalizeAccessCode(input) {
  return (input || '').toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
}

export const isValidAccessCode = code => new RegExp(`^[${ALPHABET}]{${ACCESS_CODE_LENGTH}}$`).test(code);

export const formatAccessCode = code => (code || '').match(/.{1,4}/g)?.join('-') ?? '';

export const clientPortalUrl = (code, origin = window.location.origin) => `${origin}/client/${formatAccessCode(code)}`;
