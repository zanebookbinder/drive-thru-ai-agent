import { PDFParse } from 'pdf-parse';
import { Anchor } from '../types';

interface ParsedPdf {
  text: string;
  anchors: Anchor[];
}

const PAGE_SEP = '\n\n';

// Extracts text page by page so each page's start becomes a citation anchor.
export async function extractPdf(buffer: Buffer): Promise<ParsedPdf> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    const anchors: Anchor[] = [];
    let running = 0;
    const parts: string[] = [];

    for (const page of result.pages) {
      anchors.push({ type: 'page', index: page.num, charOffset: running });
      parts.push(page.text);
      running += page.text.length + PAGE_SEP.length;
    }

    return { text: parts.join(PAGE_SEP), anchors };
  } finally {
    await parser.destroy();
  }
}
