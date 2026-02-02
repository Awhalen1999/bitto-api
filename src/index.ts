import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import admin from "firebase-admin";

import { requestLogger } from "./middleware/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./routes/auth.js";
import fileRoutes from "./routes/files.js";
import assetRoutes from "./routes/assets.js";
import elementRoutes from "./routes/elements.js";

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.FIREBASE_PROJECT_ID });
}

const app = new Hono();

app.use("*", requestLogger);
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    credentials: true,
  }),
);

app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

app.route("/api/auth", authRoutes);
app.route("/api/files", fileRoutes);
app.route("/api/assets", assetRoutes);
app.route("/api/elements", elementRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError(errorHandler);

const port = Number(process.env.PORT) || 4000;
serve({ fetch: app.fetch, port });
console.log(`[bitto-api] Server running on http://localhost:${port}`);
