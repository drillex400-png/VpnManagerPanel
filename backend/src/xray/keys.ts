import { generateKeyPairSync } from 'crypto';

/**
 * Generate a real X25519 key pair for Xray Reality.
 * Returns base64url-encoded keys compatible with Xray-core.
 */
export function generateX25519KeyPair(): { privateKey: string; publicKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('x25519');

  // JWK exports x25519 keys as base64url without padding — exactly what Xray uses
  const pubJwk = publicKey.export({ format: 'jwk' }) as { x: string };
  const privJwk = privateKey.export({ format: 'jwk' }) as { d: string };

  return {
    privateKey: privJwk.d,
    publicKey: pubJwk.x,
  };
}

/**
 * Generate a random Reality short ID (8 hex bytes = 16 hex chars).
 */
export function generateShortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
}

/**
 * Generate multiple short IDs.
 */
export function generateShortIds(count = 2): string[] {
  return Array.from({ length: count }, () => generateShortId());
}
