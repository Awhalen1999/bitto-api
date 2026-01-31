import type { Context, Next } from "hono";

export async function requestLogger(c: Context, next: Next) {
  const start = Date.now();
  const { method, url } = c.req;

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  console.log(
    `[${new Date().toISOString()}] ${method} ${url} ${status} ${duration}ms`,
  );
}
