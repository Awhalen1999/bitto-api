import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import admin from "firebase-admin";
import "dotenv/config";

import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import fileRoutes from "./routes/files.js";
import assetRoutes from "./routes/assets.js";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

const app = new Hono();

// Global middleware
app.use("*", requestLogger);
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  }),
);

// Health check (public route)
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// API routes (protected)
app.route("/api/auth", authRoutes);
app.route("/api/files", fileRoutes);
app.route("/api/assets", assetRoutes);

// Error handlers
app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError(errorHandler);

// Start server
const port = Number(process.env.PORT) || 4000;
serve({ fetch: app.fetch, port });
console.log(`🚀 Bitto API running on http://localhost:${port}`);
