import type { Context, Next } from "hono";
import admin from "firebase-admin";
import { sql } from "../db/client.js";
import { UnauthorizedError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import type { Variables } from "../types/index.js";

/** Verifies Firebase token and sets user in context. Requires user to exist in DB. */
export async function authMiddleware(
  c: Context<{ Variables: Variables }>,
  next: Next,
) {
  const token = getBearerToken(c);
  const decoded = await verifyToken(token);

  const [user] = await sql`
    SELECT id, firebase_uid, email
    FROM users
    WHERE firebase_uid = ${decoded.uid}
    LIMIT 1
  `;

  if (!user) {
    log("auth", "User not found in database", { uid: decoded.uid });
    throw new UnauthorizedError("User not found");
  }

  c.set("user", {
    id: user.id,
    firebaseUid: user.firebase_uid,
    email: user.email,
  });

  await next();
}

/** Verifies Firebase token only. Use for routes that create users (e.g. auth/sync). */
export async function verifyTokenMiddleware(
  c: Context<{ Variables: { firebaseToken: admin.auth.DecodedIdToken } }>,
  next: Next,
) {
  const token = getBearerToken(c);
  const decoded = await verifyToken(token);
  c.set("firebaseToken", decoded);
  await next();
}

function getBearerToken(c: Context): string {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or invalid authorization header");
  }
  return header.slice(7);
}

async function verifyToken(token: string): Promise<admin.auth.DecodedIdToken> {
  try {
    return await admin.auth().verifyIdToken(token);
  } catch {
    log("auth", "Token verification failed");
    throw new UnauthorizedError("Invalid or expired token");
  }
}
