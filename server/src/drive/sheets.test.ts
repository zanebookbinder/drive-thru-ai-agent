import { describe, expect, it } from 'vitest';
import { colLetter, toMarkdownTable } from './sheets';

describe('colLetter', () => {
  it('maps 1-indexed columns to spreadsheet letters', () => {
    expect(colLetter(1)).toBe('A');
    expect(colLetter(26)).toBe('Z');
    expect(colLetter(27)).toBe('AA');
    expect(colLetter(52)).toBe('AZ');
  });
});

describe('toMarkdownTable', () => {
  it('renders a header row, separator, and body', () => {
    const md = toMarkdownTable([
      ['Name', 'Role'],
      ['Ada', 'Engineer'],
    ]);
    expect(md).toBe('| Name | Role |\n| --- | --- |\n| Ada | Engineer |');
  });

  it('pads ragged rows to a uniform width', () => {
    const md = toMarkdownTable([['A', 'B', 'C'], ['x']]);
    expect(md.split('\n')[2]).toBe('| x |  |  |');
  });

  it('escapes pipes and flattens newlines in cells', () => {
    const md = toMarkdownTable([['a|b'], ['line1\nline2']]);
    expect(md).toContain('a\\|b');
    expect(md).toContain('line1 line2');
  });
});
