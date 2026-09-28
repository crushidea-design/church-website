import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Same contract as raah-management's encryptPayload/decryptPayload (AES-256-GCM,
// SHA-256 of RAAH_ENCRYPTION_SECRET as key, 12-byte IV, base64 fields), for
// payloads other than visitation bodies. raah-crypto.test.ts pins the two
// implementations to each other; do not change keys or the format here.

export type EncryptedPayload = { iv: string; tag: string; ciphertext: string };

export const RAAH_ENCRYPTION_VERSION = 1;

const keyFor = (secret: string) => createHash('sha256').update(secret).digest();

export function encryptJson(value: unknown, secret: string): EncryptedPayload {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}

export function decryptJson<T>(payload: EncryptedPayload | string | null | undefined, secret: string): T {
  const encrypted = typeof payload === 'string' ? (JSON.parse(payload) as EncryptedPayload) : payload;
  if (!encrypted?.iv || !encrypted.tag || !encrypted.ciphertext) throw new Error('Encrypted payload is missing or invalid.');
  const decipher = createDecipheriv('aes-256-gcm', keyFor(secret), Buffer.from(encrypted.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  return JSON.parse(plaintext) as T;
}
