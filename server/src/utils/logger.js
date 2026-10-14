// Small structured JSON logger. One line per event, sensitive keys redacted.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const SENSITIVE = /pass|token|secret|authorization|cookie|csrf|email/i;

function redact(value, depth = 0) {
  if (value === null || typeof value !== 'object' || depth > 3) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    out[k] = SENSITIVE.test(k) ? '[redacted]' : redact(v, depth + 1);
  }
  return out;
}

function threshold() {
  return LEVELS[process.env.LOG_LEVEL] ?? (process.env.NODE_ENV === 'test' ? LEVELS.silent : LEVELS.info);
}

function write(level, message, context = {}) {
  if (LEVELS[level] < threshold()) return;
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...redact(context) });
  (level === 'error' ? process.stderr : process.stdout).write(line + '\n');
}

export const logger = {
  debug: (m, c) => write('debug', m, c),
  info: (m, c) => write('info', m, c),
  warn: (m, c) => write('warn', m, c),
  error: (m, c) => write('error', m, c),
};
