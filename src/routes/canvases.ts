import { Hono } from "hono";
import { sql } from "../db/client.js";
import { authMiddleware } from "../middleware/auth.js";
import { createCanvasSchema, updateCanvasSchema } from "../schemas/canvas.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import type { Variables } from "../types/index.js";

const canvases = new Hono<{ Variables: Variables }>();

// Apply auth middleware to all routes
canvases.use("*", authMiddleware);

// Helper function for sort clause
function getSortClause(sort: string): string {
  const sortMap: Record<string, string> = {
    "last-modified": "last_edited_at DESC",
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

  let result;

  switch (view) {
    case "all":
      result = await sql`
        SELECT DISTINCT c.* 
        FROM canvases c
        LEFT JOIN canvas_collaborators cc ON c.id = cc.canvas_id
        WHERE c.deleted_at IS NULL
          AND (c.owner_id = ${user.uid} OR cc.user_id = ${user.uid})
        ORDER BY ${sql.unsafe(sortClause)}
      `;
      break;

    case "my-files":
      result = await sql`
        SELECT * FROM canvases
        WHERE owner_id = ${user.uid}
          AND deleted_at IS NULL
        ORDER BY ${sql.unsafe(sortClause)}
      `;
      break;

    case "shared":
      result = await sql`
        SELECT c.* 
        FROM canvases c
        INNER JOIN canvas_collaborators cc ON c.id = cc.canvas_id
        WHERE cc.user_id = ${user.uid}
          AND c.owner_id != ${user.uid}
          AND c.deleted_at IS NULL
        ORDER BY ${sql.unsafe(sortClause)}
      `;
      break;

    case "trash":
      result = await sql`
        SELECT * FROM canvases
        WHERE owner_id = ${user.uid}
          AND deleted_at IS NOT NULL
        ORDER BY deleted_at DESC
      `;
      break;

    default:
      throw new ValidationError("Invalid view parameter");
  }

  return c.json(result);
});

// Create canvas
canvases.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const { name } = createCanvasSchema.parse(body);

  const result = await sql`
    INSERT INTO canvases (name, owner_id, last_edited_by)
    VALUES (${name}, ${user.uid}, ${user.uid})
    RETURNING *
  `;

  return c.json(result[0], 201);
});

// Get single canvas
canvases.get("/:id", async (c) => {
  const user = c.get("user");
  const canvasId = c.req.param("id");

  const result = await sql`
    SELECT c.* 
    FROM canvases c
    LEFT JOIN canvas_collaborators cc ON c.id = cc.canvas_id
    WHERE c.id = ${canvasId}
      AND c.deleted_at IS NULL
      AND (c.owner_id = ${user.uid} OR cc.user_id = ${user.uid})
  `;

  if (result.length === 0) {
    throw new NotFoundError("Canvas not found");
  }

  return c.json(result[0]);
});

// Update canvas
canvases.patch("/:id", async (c) => {
  const user = c.get("user");
  const canvasId = c.req.param("id");
  const body = await c.req.json();

  const validated = updateCanvasSchema.parse(body);

  // Build update based on what's provided
  let result;

  if (validated.name && validated.canvas_data) {
    result = await sql`
      UPDATE canvases
      SET name = ${validated.name},
          canvas_data = ${validated.canvas_data},
          last_edited_by = ${user.uid},
          last_edited_at = NOW()
      WHERE id = ${canvasId}
        AND owner_id = ${user.uid}
        AND deleted_at IS NULL
      RETURNING *
    `;
  } else if (validated.name) {
    result = await sql`
      UPDATE canvases
      SET name = ${validated.name},
          last_edited_by = ${user.uid},
          last_edited_at = NOW()
      WHERE id = ${canvasId}
        AND owner_id = ${user.uid}
        AND deleted_at IS NULL
      RETURNING *
    `;
  } else if (validated.canvas_data) {
    result = await sql`
      UPDATE canvases
      SET canvas_data = ${validated.canvas_data},
          last_edited_by = ${user.uid},
          last_edited_at = NOW()
      WHERE id = ${canvasId}
        AND owner_id = ${user.uid}
        AND deleted_at IS NULL
      RETURNING *
    `;
  }

  if (!result || result.length === 0) {
    throw new NotFoundError("Canvas not found or unauthorized");
  }

  return c.json(result[0]);
});

// Delete canvas (soft delete)
canvases.delete("/:id", async (c) => {
  const user = c.get("user");
  const canvasId = c.req.param("id");

  const result = await sql`
    UPDATE canvases
    SET deleted_at = NOW()
    WHERE id = ${canvasId}
      AND owner_id = ${user.uid}
      AND deleted_at IS NULL
    RETURNING *
  `;

  if (result.length === 0) {
    throw new NotFoundError("Canvas not found or already deleted");
  }

  return c.json(result[0]);
});

// Restore canvas from trash
canvases.post("/:id/restore", async (c) => {
  const user = c.get("user");
  const canvasId = c.req.param("id");

  const result = await sql`
    UPDATE canvases
    SET deleted_at = NULL
    WHERE id = ${canvasId}
      AND owner_id = ${user.uid}
      AND deleted_at IS NOT NULL
    RETURNING *
  `;

  if (result.length === 0) {
    throw new NotFoundError("Canvas not found in trash");
  }

  return c.json(result[0]);
});

// Permanently delete canvas
canvases.delete("/:id/permanent", async (c) => {
  const user = c.get("user");
  const canvasId = c.req.param("id");

  const result = await sql`
    DELETE FROM canvases
    WHERE id = ${canvasId}
      AND owner_id = ${user.uid}
    RETURNING id
  `;

  if (result.length === 0) {
    throw new NotFoundError("Canvas not found");
  }

  return c.json({ success: true, id: result[0].id });
});

export default canvases;
