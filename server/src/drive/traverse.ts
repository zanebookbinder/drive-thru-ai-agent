import { drive_v3 } from 'googleapis';
import { FileMeta } from '../types';
import { withRetry } from '../util/retry';
import { FOLDER, SHORTCUT } from './mime';

const FIELDS =
  'nextPageToken, files(id,name,mimeType,size,modifiedTime,webViewLink,shortcutDetails)';

// BFS over the folder tree. Handles pagination, shortcut resolution, and cycles.
export async function traverse(drive: drive_v3.Drive, rootId: string): Promise<FileMeta[]> {
  const out: FileMeta[] = [];
  const seen = new Set<string>();
  const queue: Array<{ id: string; path: string }> = [{ id: rootId, path: '' }];

  while (queue.length) {
    const { id, path } = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);

    let pageToken: string | undefined;
    do {
      const { data } = await withRetry(() =>
        drive.files.list({
          q: `'${id}' in parents and trashed = false`,
          fields: FIELDS,
          pageSize: 1000,
          pageToken,
          includeItemsFromAllDrives: true,
          supportsAllDrives: true,
        }),
      );

      for (const f of data.files ?? []) {
        if (f.mimeType === SHORTCUT && f.shortcutDetails?.targetId) {
          queue.push({ id: f.shortcutDetails.targetId, path });
        } else if (f.mimeType === FOLDER && f.id) {
          queue.push({ id: f.id, path: `${path}/${f.name}` });
        } else if (f.id && f.mimeType) {
          out.push({
            id: f.id,
            name: f.name ?? 'Untitled',
            mimeType: f.mimeType,
            size: f.size ?? undefined,
            modifiedTime: f.modifiedTime ?? undefined,
            webViewLink: f.webViewLink ?? undefined,
            path,
          });
        }
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);
  }
  return out;
}
