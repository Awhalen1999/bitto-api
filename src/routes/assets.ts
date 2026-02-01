import { Hono } from "hono";
import { sql } from "../db/client.js";
import { authMiddleware } from "../middleware/auth.js";
import { createAssetSchema, updateAssetSchema } from "../schemas/asset.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import type { Variables } from "../types/index.js";

const assets = new Hono<{ Variables: Variables }>();

assets.use("*", authMiddleware);

// Get all assets for a canvas
assets.get("/canvas/:canvasId", async (c) => {
  const user = c.get("user");
  const canvasId = c.req.param("canvasId");

  console.log(`📦 [ASSETS] Fetching assets for canvas ${canvasId}`);

  // Verify user has access to canvas
  const canvasCheck = await sql`
    SELECT c.id 
    FROM canvases c
    LEFT JOIN canvas_collaborators cc ON c.id = cc.canvas_id
    WHERE c.id = ${canvasId}
      AND c.deleted_at IS NULL
      AND (c.owner_id = ${user.id} OR cc.user_id = ${user.id})
  `;

  if (canvasCheck.length === 0) {
    console.log(`❌ [ASSETS] Canvas not found or access denied: ${canvasId}`);
    throw new NotFoundError("Canvas not found or access denied");
  }

  const result = await sql`
    SELECT * FROM assets
    WHERE canvas_id = ${canvasId}
    ORDER BY z_index ASC, created_at ASC
  `;

  console.log(`✅ [ASSETS] Found ${result.length} assets`);
  return c.json(result);
});

// Create asset
assets.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const validated = createAssetSchema.parse(body);

  console.log(
    `➕ [ASSETS] Creating asset "${validated.name}" for canvas ${validated.canvas_id}`,
  );

  // Verify user owns the canvas
  const canvasCheck = await sql`
    SELECT id
    FROM canvases
    WHERE id = ${validated.canvas_id}
      AND owner_id = ${user.id}
      AND deleted_at IS NULL
  `;

  if (canvasCheck.length === 0) {
    console.log(`❌ [ASSETS] Canvas not found or access denied`);
    throw new NotFoundError("Canvas not found or access denied");
  }

  // TODO: Check asset limit (50 per canvas)
  const assetCount = await sql`
    SELECT COUNT(*) as count
    FROM assets
    WHERE canvas_id = ${validated.canvas_id}
  `;

  if (Number(assetCount[0].count) >= 50) {
    console.log(`❌ [ASSETS] Canvas has reached maximum of 50 assets`);
    throw new ValidationError("Canvas has reached the maximum of 50 assets");
  }

  // TODO: R2 upload will happen here
  // For now, we accept the r2_url from the client

  const result = await sql`
    INSERT INTO assets (
      canvas_id, name, file_type, r2_url,
      x, y, width, height, z_index
    )
    VALUES (
      ${validated.canvas_id}, ${validated.name}, ${validated.file_type},
      ${validated.r2_url}, ${validated.x}, ${validated.y},
      ${validated.width}, ${validated.height}, ${validated.z_index}
    )
    RETURNING *
  `;

  console.log(`✅ [ASSETS] Asset created:`, result[0].id);
  return c.json(result[0], 201);
});

// Get single asset
assets.get("/:id", async (c) => {
  const user = c.get("user");
  const assetId = c.req.param("id");

  console.log(`🔍 [ASSETS] Fetching asset ${assetId}`);

  const result = await sql`
    SELECT a.* 
    FROM assets a
    INNER JOIN canvases c ON a.canvas_id = c.id
    LEFT JOIN canvas_collaborators cc ON c.id = cc.canvas_id
    WHERE a.id = ${assetId}
      AND c.deleted_at IS NULL
      AND (c.owner_id = ${user.id} OR cc.user_id = ${user.id})
  `;

  if (result.length === 0) {
    console.log(`❌ [ASSETS] Asset not found: ${assetId}`);
    throw new NotFoundError("Asset not found");
  }

  console.log(`✅ [ASSETS] Asset found: ${result[0].name}`);
  return c.json(result[0]);
});

// Update asset
assets.patch("/:id", async (c) => {
  const user = c.get("user");
  const assetId = c.req.param("id");
  const body = await c.req.json();

  const validated = updateAssetSchema.parse(body);

  console.log(`✏️ [ASSETS] Updating asset ${assetId}`, validated);

  const setClauses: string[] = ["updated_at = NOW()"];
  const values: any[] = [];

  if (validated.name !== undefined) {
    setClauses.push(`name = $${values.length + 1}`);
    values.push(validated.name);
  }
  if (validated.x !== undefined) {
    setClauses.push(`x = $${values.length + 1}`);
    values.push(validated.x);
  }
  if (validated.y !== undefined) {
    setClauses.push(`y = $${values.length + 1}`);
    values.push(validated.y);
  }
  if (validated.width !== undefined) {
    setClauses.push(`width = $${values.length + 1}`);
    values.push(validated.width);
  }
  if (validated.height !== undefined) {
    setClauses.push(`height = $${values.length + 1}`);
    values.push(validated.height);
  }
  if (validated.z_index !== undefined) {
    setClauses.push(`z_index = $${values.length + 1}`);
    values.push(validated.z_index);
  }

  if (setClauses.length === 1) {
    throw new ValidationError("No fields to update");
  }

  const result = await sql`
    UPDATE assets a
    SET ${sql.unsafe(setClauses.join(", "))}
    FROM canvases c
    WHERE a.id = ${assetId}
      AND a.canvas_id = c.id
      AND c.owner_id = ${user.id}
      AND c.deleted_at IS NULL
    RETURNING a.*
  `;

  if (result.length === 0) {
    console.log(`❌ [ASSETS] Asset not found or unauthorized: ${assetId}`);
    throw new NotFoundError("Asset not found or unauthorized");
  }

  console.log(`✅ [ASSETS] Asset updated: ${result[0].name}`);
  return c.json(result[0]);
});

// Delete asset
assets.delete("/:id", async (c) => {
  const user = c.get("user");
  const assetId = c.req.param("id");

  console.log(`🗑️ [ASSETS] Deleting asset ${assetId}`);

  // TODO: Delete from R2 storage

  const result = await sql`
    DELETE FROM assets a
    USING canvases c
    WHERE a.id = ${assetId}
      AND a.canvas_id = c.id
      AND c.owner_id = ${user.id}
      AND c.deleted_at IS NULL
    RETURNING a.id, a.name
  `;

  if (result.length === 0) {
    console.log(`❌ [ASSETS] Asset not found or unauthorized: ${assetId}`);
    throw new NotFoundError("Asset not found or unauthorized");
  }

  console.log(`✅ [ASSETS] Asset deleted: ${result[0].name}`);
  return c.json({ success: true, id: result[0].id });
});

export default assets;
