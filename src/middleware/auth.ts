import type { Context, Next } from "hono";
import admin from "firebase-admin";
import { UnauthorizedError } from "../lib/errors.js";
import type { Variables } from "../types/index.js";

export async function authMiddleware(
  c: Context<{ Variables: Variables }>,
  next: Next,
) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    c.set("user", {
      uid: decodedToken.uid,
      email: decodedToken.email!,
    });

    await next();
  } catch (error) {
    throw new UnauthorizedError("Invalid or expired token");
  }
}
