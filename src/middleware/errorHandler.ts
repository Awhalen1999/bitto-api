import type { Context } from "hono";
import { ZodError } from "zod";
import { ApiError } from "../lib/errors.js";

export function errorHandler(err: Error, c: Context) {
  console.error("Error:", {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  if (err instanceof ApiError) {
    return c.json(
      {
        error: err.message,
        ...(err.details && { details: err.details }),
      },
      err.statusCode as any,
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: "Validation failed",
        details: err.issues,
      },
      400,
    );
  }

  // Default error
  return c.json(
    {
      error: "Internal server error",
    },
    500,
  );
}
