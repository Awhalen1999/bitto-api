import { Hono } from "hono";
import { sql } from "../db/client.js";
import { authMiddleware } from "../middleware/auth.js";
import type { Variables } from "../types/index.js";

const auth = new Hono<{ Variables: Variables }>();

// Sync user from Firebase to database
auth.post("/sync", async (c) => {
  const { uid, email, displayName, photoURL } = await c.req.json();

  console.log("🔄 [AUTH] Syncing user:", { uid, email });

  const result = await sql`
    INSERT INTO users (firebase_uid, email, display_name, avatar_url, updated_at)
    VALUES (${uid}, ${email}, ${displayName || null}, ${photoURL || null}, NOW())
    ON CONFLICT (firebase_uid) 
    DO UPDATE SET 
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW()
    RETURNING id, firebase_uid, email
  `;

  console.log("✅ [AUTH] User synced:", result[0].id);

  return c.json({
    success: true,
    user: result[0],
  });
});

export default auth;
