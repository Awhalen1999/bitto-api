import { Hono } from "hono";
import { sql } from "../db/client.js";
import { authMiddleware } from "../middleware/auth.js";
import { createCanvasSchema, updateCanvasSchema } from "../schemas/canvas.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import type { Variables } from "../types/index.js";

const canvases = new Hono<{ Variables: Variables }>();

canvases.use("*", authMiddleware);

// Helper: sort clause
function getSortClause(sort: string): string {
  const sortMap: Record<string, string> = {
    "last-modified": "updated_at DESC",
    "name-asc": "name ASC",
    "name-desc": "name DESC",
    newest: "created_at DESC",
  };
  return sortMap[sort] || sortMap["last-modified"];
}

// Get canvases
canvases.get("/", async (c) => {
  const user = c.get("user");
  const view = c.req.query("view") || "all";
  const sort = c.req.query("sort") || "last-modified";
  const sortClause = getSortClause(sort);

  console.log(
    `📋 [CANVASES] Fetching canvases for user ${user.id}, view: ${view}, sort: ${sort}`,
  );

  let result;

  switch (view) {
    case "all":
      result = await sql`
        SELECT DISTINCT c.* 
        FROM canvases c
        LEFT JOIN canvas_collaborators cc ON c.id = cc.canvas_id
        WHERE c.deleted_at IS NULL
          AND (c.owner_id = ${user.id} OR cc.user_id = ${user.id})
        ORDER BY ${sql.unsafe(sortClause)}
      `;
      break;

    case "my-files":
      result = await sql`
        SELECT * FROM canvases
        WHERE owner_id = ${user.id}
          AND deleted_at IS NULL
        ORDER BY ${sql.unsafe(sortClause)}
      `;
      break;

    case "shared":
      result = await sql`
        SELECT c.* 
        FROM canvases c
        INNER JOIN canvas_collaborators cc ON c.id = cc.canvas_id
        WHERE cc.user_id = ${user.id}
          AND c.owner_id != ${user.id}
          AND c.deleted_at IS NULL
        ORDER BY ${sql.unsafe(sortClause)}
      `;
      break;

    case "trash":
      result = await sql`
        SELECT * FROM canvases
        WHERE owner_id = ${user.id}
          AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `;
      break;

    default:
      throw new ValidationError("Invalid view parameter");
  }

  console.log(`✅ [CANVASES] Found ${result.length} canvases`);
  return c.json(result);
});

// Create canvas
canvases.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const { name } = createCanvasSchema.parse(body);

  console.log(`➕ [CANVASES] Creating canvas "${name}" for user ${user.id}`);

  const result = await sql`
    INSERT INTO canvases (name, owner_id)
    VALUES (${name}, ${user.id})
    RETURNING *
  `;

  console.log(`✅ [CANVASES] Canvas created:`, result[0].id);
  return c.json(result[0], 201);
});

// Get single canvas
canvases.get("/:id", async (c) => {
  const user = c.get("user");
  const canvasId = c.req.param("id");

  console.log(`🔍 [CANVASES] Fetching canvas ${canvasId} for user ${user.id}`);

  const result = await sql`
    SELECT c.* 
    FROM canvases c
    LEFT JOIN canvas_collaborators cc ON c.id = cc.canvas_id
    WHERE c.id = ${canvasId}
      AND c.deleted_at IS NULL
      AND (c.owner_id = ${user.id} OR cc.user_id = ${user.id})
  `;

  if (result.length === 0) {
    console.log(`❌ [CANVASES] Canvas not found: ${canvasId}`);
    throw new NotFoundError("Canvas not found");
  }

  console.log(`✅ [CANVASES] Canvas found: ${result[0].name}`);
  return c.json(result[0]);
});

// Update canvas
canvases.patch("/:id", async (c) => {
  const user = c.get("user");
  const canvasId = c.req.param("id");
  const body = await c.req.json();

  const validated = updateCanvasSchema.parse(body);

  console.log(`✏️ [CANVASES] Updating canvas ${canvasId}`, validated);

  const setClauses: string[] = ["updated_at = NOW()"];
  const values: any[] = [];

  if (validated.name !== undefined) {
    setClauses.push(`name = $${values.length + 1}`);
    values.push(validated.name);
  }

  if (setClauses.length === 1) {
    throw new ValidationError("No fields to update");
  }

  const result = await sql`
    UPDATE canvases
    SET ${sql.unsafe(setClauses.join(", "))}
    WHERE id = ${canvasId}
      AND owner_id = ${user.id}
      AND deleted_at IS NULL
    RETURNING *
  `;

  if (result.length === 0) {
    console.log(`❌ [CANVASES] Canvas not found or unauthorized: ${canvasId}`);
    throw new NotFoundError("Canvas not found or unauthorized");
  }

  console.log(`✅ [CANVASES] Canvas updated: ${result[0].name}`);
  return c.json(result[0]);
});

// Delete canvas (soft delete)
canvases.delete("/:id", async (c) => {
  const user = c.get("user");
  const canvasId = c.req.param("id");

  console.log(`🗑️ [CANVASES] Soft deleting canvas ${canvasId}`);

  const result = await sql`
    UPDATE canvases
    SET deleted_at = NOW()
    WHERE id = ${canvasId}
      AND owner_id = ${user.id}
      AND deleted_at IS NULL
    RETURNING *
  `;

  if (result.length === 0) {
    console.log(`❌ [CANVASES] Canvas not found: ${canvasId}`);
    throw new NotFoundError("Canvas not found or already deleted");
  }

  console.log(`✅ [CANVASES] Canvas moved to trash: ${result[0].name}`);
  return c.json(result[0]);
});

// Restore canvas
canvases.post("/:id/restore", async (c) => {
  const user = c.get("user");
  const canvasId = c.req.param("id");

  console.log(`♻️ [CANVASES] Restoring canvas ${canvasId}`);

  const result = await sql`
    UPDATE canvases
    SET deleted_at = NULL, updated_at = NOW()
    WHERE id = ${canvasId}
      AND owner_id = ${user.id}
      AND deleted_at IS NOT NULL
    RETURNING *
  `;

  if (result.length === 0) {
    console.log(`❌ [CANVASES] Canvas not found in trash: ${canvasId}`);
    throw new NotFoundError("Canvas not found in trash");
  }

  console.log(`✅ [CANVASES] Canvas restored: ${result[0].name}`);
  return c.json(result[0]);
});

// Permanently delete canvas
canvases.delete("/:id/permanent", async (c) => {
  const user = c.get("user");
  const canvasId = c.req.param("id");

  console.log(`💥 [CANVASES] Permanently deleting canvas ${canvasId}`);

  const result = await sql`
    DELETE FROM canvases
    WHERE id = ${canvasId}
      AND owner_id = ${user.id}
    RETURNING id, name
  `;

  if (result.length === 0) {
    console.log(`❌ [CANVASES] Canvas not found: ${canvasId}`);
    throw new NotFoundError("Canvas not found");
  }

  console.log(`✅ [CANVASES] Canvas permanently deleted: ${result[0].name}`);
  return c.json({ success: true, id: result[0].id });
});

export default canvases;
