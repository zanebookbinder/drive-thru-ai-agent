import { describe, expect, it } from 'vitest';
import { parseDriveLink } from './parseLink';

describe('parseDriveLink', () => {
  it('extracts a folder id from an account-index URL', () => {
    expect(parseDriveLink('https://drive.google.com/drive/u/2/folders/1AbC_dEf-123')).toBe(
      '1AbC_dEf-123',
    );
  });

  it('extracts a doc id ignoring a #gid fragment', () => {
    expect(
      parseDriveLink('https://docs.google.com/spreadsheets/d/1SheetId9999/edit#gid=0'),
    ).toBe('1SheetId9999');
  });

  it('accepts a bare id of 20+ chars', () => {
    expect(parseDriveLink('1abcdefghijklmnopqrst')).toBe('1abcdefghijklmnopqrst');
  });

  it('extracts an id from a URL with tracking params', () => {
    expect(parseDriveLink('https://drive.google.com/open?id=1XyZ_9&usp=sharing')).toBe('1XyZ_9');
  });

  it('returns null for a non-Drive URL', () => {
    expect(parseDriveLink('https://example.com/some/path')).toBeNull();
  });

  it('extracts a presentation id', () => {
    expect(parseDriveLink('https://docs.google.com/presentation/d/1DeckAbc/edit')).toBe('1DeckAbc');
  });
});
