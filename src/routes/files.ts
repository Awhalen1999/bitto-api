import { Hono } from "hono";
import { sql } from "../db/client.js";
import { authMiddleware } from "../middleware/auth.js";
import { createFileSchema, updateFileSchema } from "../schemas/file.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import type { Variables } from "../types/index.js";

const files = new Hono<{ Variables: Variables }>();
files.use("*", authMiddleware);

const SORT_MAP: Record<string, string> = {
  "last-modified": "updated_at DESC",
  "name-asc": "name ASC",
  "name-desc": "name DESC",
  newest: "created_at DESC",
};

files.get("/", async (c) => {
  const user = c.get("user");
  const view = c.req.query("view") ?? "all";
  const sort = c.req.query("sort") ?? "last-modified";
  const sortClause = SORT_MAP[sort] ?? SORT_MAP["last-modified"];

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
        WHERE owner_id = ${user.id} AND deleted_at IS NULL
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
        WHERE owner_id = ${user.id} AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `;
      break;
    default:
      throw new ValidationError("Invalid view parameter");
  }

  log("files", "List", { userId: user.id, view, count: result.length });
  return c.json(result);
});

files.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const { name, file_type } = createFileSchema.parse(body);

  const [file] = await sql`
    INSERT INTO files (name, owner_id, file_type)
    VALUES (${name}, ${user.id}, ${file_type})
    RETURNING *
  `;

  log("files", "Created", { id: file.id, name: file.name });
  return c.json(file, 201);
});

files.get("/:id", async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("id");

  const [file] = await sql`
    SELECT f.*
    FROM files f
    LEFT JOIN file_collaborators fc ON f.id = fc.file_id
    WHERE f.id = ${fileId}
      AND f.deleted_at IS NULL
      AND (f.owner_id = ${user.id} OR fc.user_id = ${user.id})
  `;

  if (!file) {
    throw new NotFoundError("File not found");
  }

  return c.json(file);
});

files.patch("/:id", async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("id");
  const body = await c.req.json();
  const validated = updateFileSchema.parse(body);

  if (validated.name === undefined) {
    throw new ValidationError("No fields to update");
  }

  const [file] = await sql`
    UPDATE files
    SET name = ${validated.name}, updated_at = NOW()
    WHERE id = ${fileId}
      AND owner_id = ${user.id}
      AND deleted_at IS NULL
    RETURNING *
  `;

  if (!file) {
    throw new NotFoundError("File not found or unauthorized");
  }

  log("files", "Updated", { id: file.id });
  return c.json(file);
});

files.delete("/:id", async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("id");

  const [file] = await sql`
    UPDATE files
    SET deleted_at = NOW()
    WHERE id = ${fileId}
      AND owner_id = ${user.id}
      AND deleted_at IS NULL
    RETURNING *
  `;

  if (!file) {
    throw new NotFoundError("File not found or already deleted");
  }

  log("files", "Soft deleted", { id: file.id });
  return c.json(file);
});

files.post("/:id/restore", async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("id");

  const [file] = await sql`
    UPDATE files
    SET deleted_at = NULL, updated_at = NOW()
    WHERE id = ${fileId}
      AND owner_id = ${user.id}
      AND deleted_at IS NOT NULL
    RETURNING *
  `;

  if (!file) {
    throw new NotFoundError("File not found in trash");
  }

  log("files", "Restored", { id: file.id });
  return c.json(file);
});

files.delete("/:id/permanent", async (c) => {
  const user = c.get("user");
  const fileId = c.req.param("id");

  const [file] = await sql`
    DELETE FROM files
    WHERE id = ${fileId} AND owner_id = ${user.id}
    RETURNING id, name
  `;

  if (!file) {
    throw new NotFoundError("File not found");
  }

  log("files", "Permanently deleted", { id: file.id });
  return c.json({ success: true, id: file.id });
});

export default files;
