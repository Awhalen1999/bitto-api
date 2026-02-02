import { Hono } from "hono";
import { sql } from "../db/client.js";
import { authMiddleware } from "../middleware/auth.js";
import { createAssetSchema, updateAssetSchema } from "../schemas/asset.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import { userCanAccessFile, userOwnsFile } from "../lib/db.js";
import type { Variables } from "../types/index.js";

const ASSET_LIMIT_PER_FILE = 50;

const assets = new Hono<{ Variables: Variables }>();
assets.use("*", authMiddleware);

/** List assets for a file (library). Placement is in canvas_elements. */
assets.get("/file/:fileId", async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("fileId");

  const canAccess = await userCanAccessFile(fileId, user.id);
  if (!canAccess) {
    throw new NotFoundError("File not found or access denied");
  }

  const result = await sql`
    SELECT * FROM assets
    WHERE file_id = ${fileId}
    ORDER BY created_at ASC
  `;

  log("assets", "List", { fileId, count: result.length });
  return c.json(result);
});

assets.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const validated = createAssetSchema.parse(body);

  const owns = await userOwnsFile(validated.file_id, user.id);
  if (!owns) {
    throw new NotFoundError("File not found or access denied");
  }

  const [{ count }] = await sql`
    SELECT COUNT(*)::int as count FROM assets WHERE file_id = ${validated.file_id}
  `;
  if (count >= ASSET_LIMIT_PER_FILE) {
    throw new ValidationError(`File has reached maximum of ${ASSET_LIMIT_PER_FILE} assets`);
  }

  const [asset] = await sql`
    INSERT INTO assets (file_id, name, file_type, r2_url, thumbnail_url, metadata)
    VALUES (
      ${validated.file_id},
      ${validated.name},
      ${validated.file_type},
      ${validated.r2_url},
      ${validated.thumbnail_url ?? null},
      ${validated.metadata ? JSON.stringify(validated.metadata) : "{}"}
    )
    RETURNING *
  `;

  log("assets", "Created", { id: asset.id, fileId: validated.file_id });
  return c.json(asset, 201);
});

/** Get single asset (e.g. when user clicks for details, r2_url, etc.) */
assets.get("/:id", async (c) => {
  const user = c.get("user");
  const assetId = c.req.param("id");

  const [asset] = await sql`
    SELECT a.*
    FROM assets a
    INNER JOIN files f ON a.file_id = f.id
    LEFT JOIN file_collaborators fc ON f.id = fc.file_id
    WHERE a.id = ${assetId}
      AND f.deleted_at IS NULL
      AND (f.owner_id = ${user.id} OR fc.user_id = ${user.id})
  `;

  if (!asset) {
    throw new NotFoundError("Asset not found");
  }

  return c.json(asset);
});

assets.patch("/:id", async (c) => {
  const user = c.get("user");
  const assetId = c.req.param("id");
  const body = await c.req.json();
  const validated = updateAssetSchema.parse(body);

  const updates: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  let i = 1;

  if (validated.name !== undefined) {
    updates.push(`name = $${i++}`);
    params.push(validated.name);
  }
  if (validated.thumbnail_url !== undefined) {
    updates.push(`thumbnail_url = $${i++}`);
    params.push(validated.thumbnail_url);
  }
  if (validated.metadata !== undefined) {
    updates.push(`metadata = $${i++}::jsonb`);
    params.push(JSON.stringify(validated.metadata));
  }

  if (updates.length === 1) {
    throw new ValidationError("No fields to update");
  }

  params.push(assetId, user.id);

  const result = await sql.query(
    `
    UPDATE assets a
    SET ${updates.join(", ")}
    FROM files f
    LEFT JOIN file_collaborators fc ON f.id = fc.file_id
    WHERE a.id = $${i++}
      AND a.file_id = f.id
      AND f.deleted_at IS NULL
      AND (f.owner_id = $${i} OR fc.user_id = $${i})
    RETURNING a.*
    `,
    params,
  );

  if (result.length === 0) {
    throw new NotFoundError("Asset not found or unauthorized");
  }

  log("assets", "Updated", { id: assetId });
  return c.json(result[0]);
});

assets.delete("/:id", async (c) => {
  const user = c.get("user");
  const assetId = c.req.param("id");

  const [asset] = await sql`
    DELETE FROM assets a
    USING files f
    LEFT JOIN file_collaborators fc ON f.id = fc.file_id
    WHERE a.id = ${assetId}
      AND a.file_id = f.id
      AND f.deleted_at IS NULL
      AND (f.owner_id = ${user.id} OR fc.user_id = ${user.id})
    RETURNING a.id, a.name
  `;

  if (!asset) {
    throw new NotFoundError("Asset not found or unauthorized");
  }

  log("assets", "Deleted", { id: asset.id });
  return c.json({ success: true, id: asset.id });
});

export default assets;
