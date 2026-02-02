import type { DecodedIdToken } from "firebase-admin/auth";
import { Hono } from "hono";
import { sql } from "../db/client.js";
import { verifyTokenMiddleware } from "../middleware/auth.js";
import { log } from "../lib/logger.js";

const auth = new Hono<{ Variables: { firebaseToken: DecodedIdToken } }>();

/** Sync user from Firebase to DB. Requires valid Bearer token. Uses token uid/email. */
auth.post("/sync", verifyTokenMiddleware, async (c) => {
  const token = c.get("firebaseToken");
  const body = (await c.req.json()) as {
    displayName?: string;
    photoURL?: string;
  };

  log("auth", "Syncing user", { uid: token.uid, email: token.email });

  const [user] = await sql`
    INSERT INTO users (firebase_uid, email, display_name, avatar_url, updated_at)
    VALUES (
      ${token.uid},
      ${token.email ?? ""},
      ${body.displayName ?? null},
      ${body.photoURL ?? null},
      NOW()
    )
    ON CONFLICT (firebase_uid)
    DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW()
    RETURNING id, firebase_uid, email
  `;

  log("auth", "User synced", { id: user.id });

  return c.json({ success: true, user });
});

export default auth;
