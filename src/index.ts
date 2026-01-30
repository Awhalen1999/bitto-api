import { Hono } from "hono";
import { cors } from "hono/cors";
import admin from "firebase-admin";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

// Initialize Firebase Admin
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID,
});

// Initialize Neon
const sql = neon(process.env.DATABASE_URL!);

const app = new Hono();

// CORS
app.use(
  "*",
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  }),
);

// Health check
app.get("/health", (c) => c.json({ status: "ok" }));

// Sync user
app.post("/api/auth/sync", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.split("Bearer ")[1];

  try {
    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    const { uid, email, displayName, photoURL } = await c.req.json();

    // Upsert user to database
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
  } catch (error) {
    console.error("Auth error:", error);
    return c.json({ error: "Invalid token" }, 401);
  }
});

const port = Number(process.env.PORT) || 4000;
console.log(`🚀 Server running on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
