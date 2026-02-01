import type { Context, Next } from "hono";
import admin from "firebase-admin";
import { sql } from "../db/client.js";
import { UnauthorizedError } from "../lib/errors.js";
import type { Variables } from "../types/index.js";

export async function authMiddleware(
  c: Context<{ Variables: Variables }>,
  next: Next,
) {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    console.log("❌ [AUTH] Missing or invalid authorization header");
    throw new UnauthorizedError("Missing or invalid authorization header");
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Get user from database by firebase_uid
    const userResult = await sql`
      SELECT id, firebase_uid, email, display_name
      FROM users
      WHERE firebase_uid = ${decodedToken.uid}
      LIMIT 1
    `;

    if (userResult.length === 0) {
      console.log("❌ [AUTH] User not found in database:", decodedToken.uid);
      throw new UnauthorizedError("User not found");
    }

    c.set("user", {
      id: userResult[0].id,
      firebaseUid: userResult[0].firebase_uid,
      email: userResult[0].email,
    });

    console.log("✅ [AUTH] User authenticated:", userResult[0].email);
    await next();
  } catch (error) {
    console.log("❌ [AUTH] Token verification failed:", error);
    throw new UnauthorizedError("Invalid or expired token");
  }
}
