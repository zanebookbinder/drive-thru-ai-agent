import { describe, expect, it } from 'vitest';
import { parseDriveLink } from './parseLink';

describe('parseDriveLink (client)', () => {
  it('accepts a folder URL', () => {
    expect(parseDriveLink('https://drive.google.com/drive/folders/1abcDEF_ghi')).toBe(
      '1abcDEF_ghi',
    );
  });

  it('rejects an empty string', () => {
    expect(parseDriveLink('')).toBeNull();
  });

  it('rejects a short non-URL token', () => {
    expect(parseDriveLink('hello')).toBeNull();
  });
});
