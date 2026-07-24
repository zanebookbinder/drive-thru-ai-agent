import { drive_v3 } from 'googleapis';
import { Anchor, CorpusDocument, FileMeta } from '../types';
import { estimateTokens } from '../context/tokens';
import { withRetry } from '../util/retry';
import { DriveClient } from './client';
import { GOOGLE_DOC, GOOGLE_SHEET, GOOGLE_SLIDES, PDF, isPlainText } from './mime';
import { extractPdf } from './pdf';
import { exportSheet } from './sheets';

export class UnsupportedTypeError extends Error {}

// Types we can turn into text. Slides are deferred (no exporter yet).
export function isSupported(mimeType: string): boolean {
  return (
    mimeType === GOOGLE_DOC ||
    mimeType === GOOGLE_SHEET ||
    mimeType === PDF ||
    isPlainText(mimeType)
  );
}

export function unsupportedReason(mimeType: string): string {
  if (mimeType === GOOGLE_SLIDES) return 'Google Slides export not yet implemented';
  return `Unsupported type: ${mimeType}`;
}

async function getMediaBuffer(drive: drive_v3.Drive, fileId: string): Promise<Buffer> {
  const res = await withRetry(() =>
    drive.files.get(
      { fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'arraybuffer' },
    ),
  );
  return Buffer.from(res.data as ArrayBuffer);
}

async function exportGoogleDoc(drive: drive_v3.Drive, fileId: string): Promise<string> {
  const res = await withRetry(() =>
    drive.files.export({ fileId, mimeType: 'text/markdown' }, { responseType: 'text' }),
  );
  return String(res.data);
}

// Returns extracted text plus page anchors (charOffset marks each page's start).
export async function exportFile(client: DriveClient, file: FileMeta): Promise<CorpusDocument> {
  let text: string;
  let anchors: Anchor[] = [];

  if (file.mimeType === GOOGLE_DOC) {
    text = await client.withDrive((drive) => exportGoogleDoc(drive, file.id));
  } else if (file.mimeType === GOOGLE_SHEET) {
    text = await client.withSheets((sheets) => exportSheet(sheets, file.id));
  } else if (file.mimeType === PDF) {
    const parsed = await extractPdf(await client.withDrive((drive) => getMediaBuffer(drive, file.id)));
    text = parsed.text;
    anchors = parsed.anchors;
  } else if (isPlainText(file.mimeType)) {
    text = (await client.withDrive((drive) => getMediaBuffer(drive, file.id))).toString('utf8');
  } else if (file.mimeType === GOOGLE_SLIDES) {
    // Deferred to a later build step — see IMPLEMENTATION §13.
    throw new UnsupportedTypeError('Google Slides export not yet implemented');
  } else {
    throw new UnsupportedTypeError(`Unsupported type: ${file.mimeType}`);
  }

  return {
    fileId: file.id,
    name: file.name,
    mimeType: file.mimeType,
    webViewLink: file.webViewLink ?? '',
    path: file.path,
    text,
    tokenEstimate: estimateTokens(text),
    anchors,
  };
}
