import { Hono } from "hono";
import { sql } from "../db/client.js";
import { authMiddleware } from "../middleware/auth.js";
import { createFileSchema, updateFileSchema } from "../schemas/file.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import type { Variables } from "../types/index.js";

const files = new Hono<{ Variables: Variables }>();

files.use("*", authMiddleware);

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

// Get files
files.get("/", async (c) => {
  const user = c.get("user");
  const view = c.req.query("view") || "all";
  const sort = c.req.query("sort") || "last-modified";
  const sortClause = getSortClause(sort);

  console.log(
    `📋 [FILES] Fetching files for user ${user.id}, view: ${view}, sort: ${sort}`,
  );

  let result;

  switch (view) {
    case "all":
      result = await sql`
        SELECT DISTINCT f.* 
        FROM files f
        LEFT JOIN file_collaborators fc ON f.id = fc.file_id
        WHERE f.deleted_at IS NULL
          AND (f.owner_id = ${user.id} OR fc.user_id = ${user.id})
        ORDER BY ${sql.unsafe(sortClause)}
      `;
      break;

    case "my-files":
      result = await sql`
        SELECT * FROM files
        WHERE owner_id = ${user.id}
          AND deleted_at IS NULL
        ORDER BY ${sql.unsafe(sortClause)}
      `;
      break;

    case "shared":
      result = await sql`
        SELECT f.* 
        FROM files f
        INNER JOIN file_collaborators fc ON f.id = fc.file_id
        WHERE fc.user_id = ${user.id}
          AND f.owner_id != ${user.id}
          AND f.deleted_at IS NULL
        ORDER BY ${sql.unsafe(sortClause)}
      `;
      break;

    case "trash":
      result = await sql`
        SELECT * FROM files
        WHERE owner_id = ${user.id}
          AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `;
      break;

    default:
      throw new ValidationError("Invalid view parameter");
  }

  console.log(`✅ [FILES] Found ${result.length} files`);
  return c.json(result);
});

// Create file
files.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const { name, file_type } = createFileSchema.parse(body);

  console.log(`➕ [FILES] Creating file "${name}" (${file_type}) for user ${user.id}`);

  const result = await sql`
    INSERT INTO files (name, owner_id, file_type)
    VALUES (${name}, ${user.id}, ${file_type})
    RETURNING *
  `;

  console.log(`✅ [FILES] File created:`, result[0].id);
  return c.json(result[0], 201);
});

// Get single file
files.get("/:id", async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("id");

  console.log(`🔍 [FILES] Fetching file ${fileId} for user ${user.id}`);

  const result = await sql`
    SELECT f.* 
    FROM files f
    LEFT JOIN file_collaborators fc ON f.id = fc.file_id
    WHERE f.id = ${fileId}
      AND f.deleted_at IS NULL
      AND (f.owner_id = ${user.id} OR fc.user_id = ${user.id})
  `;

  if (result.length === 0) {
    console.log(`❌ [FILES] File not found: ${fileId}`);
    throw new NotFoundError("File not found");
  }

  console.log(`✅ [FILES] File found: ${result[0].name}`);
  return c.json(result[0]);
});

// Update file
files.patch("/:id", async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("id");
  const body = await c.req.json();

  const validated = updateFileSchema.parse(body);

  console.log(`✏️ [FILES] Updating file ${fileId}`, validated);

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
    UPDATE files
    SET ${sql.unsafe(setClauses.join(", "))}
    WHERE id = ${fileId}
      AND owner_id = ${user.id}
      AND deleted_at IS NULL
    RETURNING *
  `;

  if (result.length === 0) {
    console.log(`❌ [FILES] File not found or unauthorized: ${fileId}`);
    throw new NotFoundError("File not found or unauthorized");
  }

  console.log(`✅ [FILES] File updated: ${result[0].name}`);
  return c.json(result[0]);
});

// Delete file (soft delete)
files.delete("/:id", async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("id");

  console.log(`🗑️ [FILES] Soft deleting file ${fileId}`);

  const result = await sql`
    UPDATE files
    SET deleted_at = NOW()
    WHERE id = ${fileId}
      AND owner_id = ${user.id}
      AND deleted_at IS NULL
    RETURNING *
  `;

  if (result.length === 0) {
    console.log(`❌ [FILES] File not found: ${fileId}`);
    throw new NotFoundError("File not found or already deleted");
  }

  console.log(`✅ [FILES] File moved to trash: ${result[0].name}`);
  return c.json(result[0]);
});

// Restore file
files.post("/:id/restore", async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("id");

  console.log(`♻️ [FILES] Restoring file ${fileId}`);

  const result = await sql`
    UPDATE files
    SET deleted_at = NULL, updated_at = NOW()
    WHERE id = ${fileId}
      AND owner_id = ${user.id}
      AND deleted_at IS NOT NULL
    RETURNING *
  `;

  if (result.length === 0) {
    console.log(`❌ [FILES] File not found in trash: ${fileId}`);
    throw new NotFoundError("File not found in trash");
  }

  console.log(`✅ [FILES] File restored: ${result[0].name}`);
  return c.json(result[0]);
});

// Permanently delete file
files.delete("/:id/permanent", async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("id");

  console.log(`💥 [FILES] Permanently deleting file ${fileId}`);

  const result = await sql`
    DELETE FROM files
    WHERE id = ${fileId}
      AND owner_id = ${user.id}
    RETURNING id, name
  `;

  if (result.length === 0) {
    console.log(`❌ [FILES] File not found: ${fileId}`);
    throw new NotFoundError("File not found");
  }

  console.log(`✅ [FILES] File permanently deleted: ${result[0].name}`);
  return c.json({ success: true, id: result[0].id });
});

export default files;
