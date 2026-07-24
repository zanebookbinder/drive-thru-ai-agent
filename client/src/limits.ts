// Mirrors the server ingest gate (SIZE_LIMIT_BYTES / MAX_EAGER_FILES) for UI copy.
export const SIZE_LIMIT_LABEL = '20 KB';
export const MAX_EAGER_FILES = 100;

export const GATE_NOTE =
  `Files over ${SIZE_LIMIT_LABEL} aren't read automatically (and only the first ` +
  `${MAX_EAGER_FILES} files are loaded by default). They're listed with a Load ` +
  `button so you can add any you need.`;
