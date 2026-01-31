import { Hono } from "hono";
import { sql } from "../db/client.js";
import { authMiddleware } from "../middleware/auth.js";
import type { Variables } from "../types/index.js";

const auth = new Hono<{ Variables: Variables }>();

// Apply auth middleware to all routes
auth.use("*", authMiddleware);

// Sync user from Firebase to database
auth.post("/sync", async (c) => {
  const user = c.get("user");
  const { uid, email, displayName, photoURL } = await c.req.json();

  await sql`
    INSERT INTO users (id, email, display_name, avatar_url, updated_at)
    VALUES (${uid}, ${email}, ${displayName || null}, ${photoURL || null}, NOW())
    ON CONFLICT (id) 
    DO UPDATE SET 
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      avatar_url = EXCLUDED.avatar_url,
      updated_at = NOW()
  `;

  return c.json({ success: true });
});

export default auth;
