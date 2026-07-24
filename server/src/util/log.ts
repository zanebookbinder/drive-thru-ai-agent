// Logs identifiers and counts only — never document content, questions, or tokens.
type Fields = Record<string, string | number | boolean | undefined>;

function write(level: 'info' | 'warn' | 'error', msg: string, fields?: Fields) {
  const line = { level, msg, time: new Date().toISOString(), ...fields };
  const out = JSON.stringify(line);
  if (level === 'error') console.error(out);
  else if (level === 'warn') console.warn(out);
  else console.log(out);
}

export const log = {
  info: (msg: string, fields?: Fields) => write('info', msg, fields),
  warn: (msg: string, fields?: Fields) => write('warn', msg, fields),
  error: (msg: string, fields?: Fields) => write('error', msg, fields),
};
