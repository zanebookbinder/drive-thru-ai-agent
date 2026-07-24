import crypto from 'crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, sign, verify } from './crypto';

const KEY = crypto.randomBytes(32).toString('hex');
const SECRET = 'test-secret';

describe('crypto', () => {
  it('round-trips a refresh token through AES-256-GCM', () => {
    const token = '1//refresh-token-value';
    expect(decrypt(encrypt(token, KEY), KEY)).toBe(token);
  });

  it('produces different ciphertext each time (random iv)', () => {
    expect(encrypt('same', KEY)).not.toBe(encrypt('same', KEY));
  });

  it('fails to decrypt with a tampered payload', () => {
    const payload = encrypt('secret', KEY);
    const tampered = payload.slice(0, -2) + (payload.endsWith('a') ? 'bb' : 'aa');
    expect(() => decrypt(tampered, KEY)).toThrow();
  });

  it('signs and verifies a payload', () => {
    const token = sign({ state: 'abc', verifier: 'xyz' }, SECRET);
    expect(verify<{ state: string }>(token, SECRET)).toEqual({ state: 'abc', verifier: 'xyz' });
  });

  it('rejects a token signed with a different secret', () => {
    const token = sign({ state: 'abc' }, SECRET);
    expect(verify(token, 'other-secret')).toBeNull();
  });

  it('rejects undefined and malformed tokens', () => {
    expect(verify(undefined, SECRET)).toBeNull();
    expect(verify('garbage', SECRET)).toBeNull();
  });
});
