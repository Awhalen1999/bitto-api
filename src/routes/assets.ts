import { Hono } from "hono";
import { sql } from "../db/client.js";
import { authMiddleware } from "../middleware/auth.js";
import { createAssetSchema, updateAssetSchema } from "../schemas/asset.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import type { Variables } from "../types/index.js";

const assets = new Hono<{ Variables: Variables }>();

assets.use("*", authMiddleware);

// Get all assets for a file
assets.get("/file/:fileId", async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("fileId");

  console.log(`📦 [ASSETS] Fetching assets for file ${fileId}`);

  // Verify user has access to file
  const fileCheck = await sql`
    SELECT f.id 
    FROM files f
    LEFT JOIN file_collaborators fc ON f.id = fc.file_id
    WHERE f.id = ${fileId}
      AND f.deleted_at IS NULL
      AND (f.owner_id = ${user.id} OR fc.user_id = ${user.id})
  `;

  if (fileCheck.length === 0) {
    console.log(`❌ [ASSETS] File not found or access denied: ${fileId}`);
    throw new NotFoundError("File not found or access denied");
  }

  const result = await sql`
    SELECT * FROM assets
    WHERE file_id = ${fileId}
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
    `➕ [ASSETS] Creating asset "${validated.name}" for file ${validated.file_id}`,
  );

  // Verify user owns the file
  const fileCheck = await sql`
    SELECT id
    FROM files
    WHERE id = ${validated.file_id}
      AND owner_id = ${user.id}
      AND deleted_at IS NULL
  `;

  if (fileCheck.length === 0) {
    console.log(`❌ [ASSETS] File not found or access denied`);
    throw new NotFoundError("File not found or access denied");
  }

  // TODO: Check asset limit (50 per file)
  const assetCount = await sql`
    SELECT COUNT(*) as count
    FROM assets
    WHERE file_id = ${validated.file_id}
  `;

  if (Number(assetCount[0].count) >= 50) {
    console.log(`❌ [ASSETS] File has reached maximum of 50 assets`);
    throw new ValidationError("File has reached the maximum of 50 assets");
  }

  // TODO: R2 upload will happen here
  // For now, we accept the r2_url from the client

  const result = await sql`
    INSERT INTO assets (
      file_id, name, file_type, r2_url,
      x, y, width, height, z_index
    )
    VALUES (
      ${validated.file_id}, ${validated.name}, ${validated.file_type},
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
    INNER JOIN files f ON a.file_id = f.id
    LEFT JOIN file_collaborators fc ON f.id = fc.file_id
    WHERE a.id = ${assetId}
      AND f.deleted_at IS NULL
      AND (f.owner_id = ${user.id} OR fc.user_id = ${user.id})
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
    FROM files f
    WHERE a.id = ${assetId}
      AND a.file_id = f.id
      AND f.owner_id = ${user.id}
      AND f.deleted_at IS NULL
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
    USING files f
    WHERE a.id = ${assetId}
      AND a.file_id = f.id
      AND f.owner_id = ${user.id}
      AND f.deleted_at IS NULL
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
