const LOG_PREFIX = "[bitto-api]";

/** Structured log helper - use for important business events */
export function log(scope: string, message: string, meta?: Record<string, unknown>) {
  const payload = meta ? ` ${JSON.stringify(meta)}` : "";
  console.log(`${LOG_PREFIX} [${scope}] ${message}${payload}`);
}
