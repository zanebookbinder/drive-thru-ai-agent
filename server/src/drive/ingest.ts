import crypto from 'crypto';
import { DriveClient } from './client';
import { traverse } from './traverse';
import { exportFile, isSupported, unsupportedReason } from './export';
import { FOLDER } from './mime';
import { assemble } from '../context/assemble';
import { Corpus, CorpusDocument, FileMeta, SkipRecord } from '../types';
import { limitConcurrency } from '../util/limit';
import { withRetry } from '../util/retry';
import { log } from '../util/log';

const EXPORT_CONCURRENCY = 5;
// On folder load, parse only small files (native Google files have no byte size
// and are treated as small), and no more than this many. The rest are left for
// the user to load on demand.
export const SIZE_LIMIT_BYTES = 20 * 1024;
export const MAX_EAGER_FILES = 100;

async function resolveRoot(client: DriveClient, fileId: string): Promise<FileMeta> {
  const meta = await client.withDrive((drive) =>
    withRetry(() =>
      drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,modifiedTime,webViewLink',
        supportsAllDrives: true,
      }),
    ),
  );
  const f = meta.data;
  return {
    id: f.id!,
    name: f.name ?? 'Untitled',
    mimeType: f.mimeType!,
    size: f.size ?? undefined,
    modifiedTime: f.modifiedTime ?? undefined,
    webViewLink: f.webViewLink ?? undefined,
    path: '',
  };
}

// Decide, without any I/O, which files to parse now vs. leave unloaded vs. skip.
function partition(files: FileMeta[], forceLoadIds: Set<string>) {
  const toLoad: FileMeta[] = [];
  const unloaded: FileMeta[] = [];
  const skipped: SkipRecord[] = [];
  let eager = 0;

  for (const file of files) {
    if (!isSupported(file.mimeType)) {
      skipped.push({ fileId: file.id, name: file.name, reason: unsupportedReason(file.mimeType) });
      continue;
    }
    const bytes = file.size ? Number(file.size) : undefined;
    const tooLarge = bytes !== undefined && bytes >= SIZE_LIMIT_BYTES;
    if (forceLoadIds.has(file.id)) {
      toLoad.push(file);
    } else if (!tooLarge && eager < MAX_EAGER_FILES) {
      toLoad.push(file);
      eager += 1;
    } else {
      unloaded.push(file);
    }
  }
  return { toLoad, unloaded, skipped };
}

// Resolves a pasted link to a folder (enumerate) or a single file, then parses the
// eager set with bounded concurrency and per-file error isolation. Files in
// forceLoadIds are parsed regardless of size (user-requested loads).
export async function ingest(
  client: DriveClient,
  sourceUrl: string,
  rootId: string,
  maxTokens: number,
  forceLoadIds: Set<string> = new Set(),
): Promise<Corpus> {
  const root = await resolveRoot(client, rootId);
  const files =
    root.mimeType === FOLDER
      ? await client.withDrive((drive) => traverse(drive, rootId))
      : [root];

  const { toLoad, unloaded, skipped } = partition(files, forceLoadIds);

  const limit = limitConcurrency(EXPORT_CONCURRENCY);
  const documents: CorpusDocument[] = [];
  await Promise.all(
    toLoad.map((file) =>
      limit(async () => {
        try {
          documents.push(await exportFile(client, file));
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'unknown error';
          skipped.push({ fileId: file.id, name: file.name, reason });
          log.warn('file skipped during ingest', { fileId: file.id, reason });
        }
      }),
    ),
  );

  const { tier } = assemble(documents, files, maxTokens);
  const tokensLoaded = documents.reduce((sum, doc) => sum + doc.tokenEstimate, 0);

  log.info('ingest complete', {
    files: files.length,
    exported: documents.length,
    unloaded: unloaded.length,
    skipped: skipped.length,
    tier,
  });

  return {
    id: crypto.randomUUID(),
    title: root.name,
    sourceUrl,
    rootId,
    tier,
    documents,
    manifest: files,
    unloaded,
    tokensLoaded,
    skipped,
  };
}
