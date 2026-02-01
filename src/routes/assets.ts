import { Hono } from "hono";
import { sql } from "../db/client.js";
import { authMiddleware } from "../middleware/auth.js";
import { createAssetSchema, updateAssetSchema } from "../schemas/asset.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import type { Variables } from "../types/index.js";

const assets = new Hono<{ Variables: Variables }>();

// Apply auth middleware to all routes
assets.use("*", authMiddleware);

// Get all assets for a canvas
assets.get("/canvas/:canvasId", async (c) => {
  const user = c.get("user");
  const canvasId = c.req.param("canvasId");

  // Verify user has access to canvas
  const canvasCheck = await sql`
    SELECT c.id 
    FROM canvases c
    LEFT JOIN canvas_collaborators cc ON c.id = cc.canvas_id
    WHERE c.id = ${canvasId}
      AND c.deleted_at IS NULL
      AND (c.owner_id = ${user.uid} OR cc.user_id = ${user.uid})
  `;

  if (canvasCheck.length === 0) {
    throw new NotFoundError("Canvas not found or access denied");
  }

  const result = await sql`
    SELECT * FROM assets
    WHERE canvas_id = ${canvasId}
    ORDER BY created_at DESC
  `;

  return c.json(result);
});

// Create asset
assets.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const validated = createAssetSchema.parse(body);

  // Verify user owns the canvas
  const canvasCheck = await sql`
    SELECT id, asset_count 
    FROM canvases
    WHERE id = ${validated.canvas_id}
      AND owner_id = ${user.uid}
      AND deleted_at IS NULL
  `;

  if (canvasCheck.length === 0) {
    throw new NotFoundError("Canvas not found or access denied");
  }

  // Check asset limit (50 per canvas)
  if (canvasCheck[0].asset_count >= 50) {
    throw new ValidationError("Canvas has reached the maximum of 50 assets");
  }

  const result = await sql`
    INSERT INTO assets (
      canvas_id, name, file_type, asset_category, 
      file_size, r2_key, r2_url, thumbnail_url, metadata
    )
    VALUES (
      ${validated.canvas_id}, ${validated.name}, ${validated.file_type}, 
      ${validated.asset_category}, ${validated.file_size}, ${validated.r2_key}, 
      ${validated.r2_url}, ${validated.thumbnail_url || null}, 
      ${validated.metadata ? JSON.stringify(validated.metadata) : "{}"}
    )
    RETURNING *
  `;

  return c.json(result[0], 201);
});

// Get single asset
assets.get("/:id", async (c) => {
  const user = c.get("user");
  const assetId = c.req.param("id");

  const result = await sql`
    SELECT a.* 
    FROM assets a
    INNER JOIN canvases c ON a.canvas_id = c.id
    LEFT JOIN canvas_collaborators cc ON c.id = cc.canvas_id
    WHERE a.id = ${assetId}
      AND c.deleted_at IS NULL
      AND (c.owner_id = ${user.uid} OR cc.user_id = ${user.uid})
  `;

  if (result.length === 0) {
    throw new NotFoundError("Asset not found");
  }

  return c.json(result[0]);
});

// Update asset
assets.patch("/:id", async (c) => {
  const user = c.get("user");
  const assetId = c.req.param("id");
  const body = await c.req.json();

  const validated = updateAssetSchema.parse(body);

  let result;

  if (validated.name && validated.metadata) {
    result = await sql`
      UPDATE assets a
      SET name = ${validated.name},
          metadata = ${JSON.stringify(validated.metadata)},
          updated_at = NOW()
      FROM canvases c
      WHERE a.id = ${assetId}
        AND a.canvas_id = c.id
        AND c.owner_id = ${user.uid}
        AND c.deleted_at IS NULL
      RETURNING a.*
    `;
  } else if (validated.name) {
    result = await sql`
      UPDATE assets a
      SET name = ${validated.name},
          updated_at = NOW()
      FROM canvases c
      WHERE a.id = ${assetId}
        AND a.canvas_id = c.id
        AND c.owner_id = ${user.uid}
        AND c.deleted_at IS NULL
      RETURNING a.*
    `;
  } else if (validated.metadata) {
    result = await sql`
      UPDATE assets a
      SET metadata = ${JSON.stringify(validated.metadata)},
          updated_at = NOW()
      FROM canvases c
      WHERE a.id = ${assetId}
        AND a.canvas_id = c.id
        AND c.owner_id = ${user.uid}
        AND c.deleted_at IS NULL
      RETURNING a.*
    `;
  }

  if (!result || result.length === 0) {
    throw new NotFoundError("Asset not found or unauthorized");
  }

  return c.json(result[0]);
});

// Delete asset
assets.delete("/:id", async (c) => {
  const user = c.get("user");
  const assetId = c.req.param("id");

  const result = await sql`
    DELETE FROM assets a
    USING canvases c
    WHERE a.id = ${assetId}
      AND a.canvas_id = c.id
      AND c.owner_id = ${user.uid}
      AND c.deleted_at IS NULL
    RETURNING a.id, a.canvas_id
  `;

  if (result.length === 0) {
    throw new NotFoundError("Asset not found or unauthorized");
  }

  return c.json({ success: true, id: result[0].id });
});

export default assets;
