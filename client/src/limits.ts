// Mirrors the server ingest gate (SIZE_LIMIT_BYTES / MAX_EAGER_FILES) for UI copy.
export const SIZE_LIMIT_LABEL = '20 KB';
export const MAX_EAGER_FILES = 100;

export const GATE_NOTE =
  `Drive Thru will automatically load the first ${MAX_EAGER_FILES} files under ` +
  `${SIZE_LIMIT_LABEL}. You can choose to load larger files later.`;
