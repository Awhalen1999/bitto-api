import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError } from "zod";
import { ApiError } from "../lib/errors.js";
import { log } from "../lib/logger.js";

export function errorHandler(err: Error, c: Context) {
  const isDev = process.env.NODE_ENV === "development";

  log("error", err.message, {
    name: err.name,
    ...(isDev && { stack: err.stack }),
  });

  if (err instanceof ApiError) {
    return c.json(
      {
        error: err.message,
        ...(err.details != null && { details: err.details }),
      },
      err.statusCode as ContentfulStatusCode,
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      { error: "Validation failed", details: err.issues },
      400,
    );
  }

  return c.json({ error: "Internal server error" }, 500);
}
