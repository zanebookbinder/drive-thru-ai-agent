import { sheets_v4 } from 'googleapis';
import { withRetry } from '../util/retry';

// Cap per-tab size so a large spreadsheet can't blow the token budget. Truncation
// is made visible to the model — a silently cut sheet produces confident wrong
// answers about totals (IMPLEMENTATION §7).
const MAX_ROWS = 200;
const MAX_COLS = 50;

export function colLetter(n: number): string {
  let s = '';
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s || 'A';
}

function cell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

export function toMarkdownTable(rows: string[][]): string {
  const width = Math.max(1, ...rows.map((r) => r.length));
  const line = (r: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cell(r[i] ?? '')).join(' | ')} |`;
  const [header, ...body] = rows;
  const separator = Array.from({ length: width }, () => '---');
  return [line(header), `| ${separator.join(' | ')} |`, ...body.map(line)].join('\n');
}

// Renders one markdown table per tab. Uses the Sheets API — Drive's export of a
// spreadsheet returns only the first tab.
export async function exportSheet(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<string> {
  const meta = await withRetry(() =>
    sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties(title,gridProperties(columnCount))',
    }),
  );

  const blocks: string[] = [];
  for (const sheet of meta.data.sheets ?? []) {
    const title = sheet.properties?.title ?? 'Sheet';
    const cols = Math.min(sheet.properties?.gridProperties?.columnCount ?? 26, MAX_COLS);
    // Fetch one extra row beyond the cap to detect (and report) truncation.
    const range = `'${title.replace(/'/g, "''")}'!A1:${colLetter(cols)}${MAX_ROWS + 2}`;
    const res = await withRetry(() =>
      sheets.spreadsheets.values.get({ spreadsheetId, range }),
    );
    const values = (res.data.values ?? []) as string[][];

    blocks.push(`### ${title}`);
    if (values.length === 0) {
      blocks.push('(empty sheet)');
      continue;
    }

    const truncated = values.length > MAX_ROWS + 1;
    const shown = truncated ? [values[0], ...values.slice(1, MAX_ROWS + 1)] : values;
    blocks.push(toMarkdownTable(shown));
    if (truncated) blocks.push(`[truncated: further rows beyond ${MAX_ROWS} not shown]`);
  }

  return blocks.join('\n\n');
}
