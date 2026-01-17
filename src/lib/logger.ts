const isBrowser = typeof window !== 'undefined';

function formatArgs(args: unknown[]) {
  return args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
}

const logger = {
  info: (...args: unknown[]) => {
    const msg = formatArgs(args);
    if (isBrowser && typeof globalThis.console !== 'undefined') {
      globalThis.console.info(msg);
      return;
    }
    console.info('[info]', msg);
  },
  warn: (...args: unknown[]) => {
    const msg = formatArgs(args);
    if (isBrowser && typeof globalThis.console !== 'undefined') {
      globalThis.console.warn(msg);
      return;
    }
    console.warn('[warn]', msg);
  },
  error: (...args: unknown[]) => {
    const msg = formatArgs(args);
    if (isBrowser && typeof globalThis.console !== 'undefined') {
      globalThis.console.error(msg);
      return;
    }
    console.error('[error]', msg);
  },
};

export default logger;
