export interface CryptoLike {
  randomUUID?: () => string;
  getRandomValues?: (array: Uint8Array) => Uint8Array;
}

/**
 * Generates an RFC 4122 version 4 compliant UUID using cryptographically secure APIs.
 *
 * 1. Uses crypto.randomUUID() when available.
 * 2. Falls back to crypto.getRandomValues() when randomUUID() is not available.
 * 3. Throws a descriptive error if neither secure API is available (never falls back to Math.random()).
 */
export function generateUuidFromCrypto(cryptoProvider?: CryptoLike | null): string {
  const provider: CryptoLike | undefined =
    arguments.length > 0 ? (cryptoProvider ?? undefined) : (globalThis.crypto as unknown as CryptoLike);

  if (typeof provider?.randomUUID === 'function') {
    return provider.randomUUID();
  }

  if (typeof provider?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    provider.getRandomValues(bytes);

    // RFC 4122 v4 requires:
    // byte 6 high nibble = 0b0100 (version 4)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // byte 8 high 2 bits = 0b10 (variant 1, RFC 4122)
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
    return [
      hex.slice(0, 4).join(''),
      hex.slice(4, 6).join(''),
      hex.slice(6, 8).join(''),
      hex.slice(8, 10).join(''),
      hex.slice(10, 16).join('')
    ].join('-');
  }

  throw new Error(
    'Cryptographically secure random number generator is not available in the current runtime environment. Neither crypto.randomUUID nor crypto.getRandomValues is available.'
  );
}

export function generateUuid(): string {
  return generateUuidFromCrypto();
}
