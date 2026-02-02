import { Hono } from "hono";
import { sql } from "../db/client.js";
import { authMiddleware } from "../middleware/auth.js";
import {
  createElementSchema,
  updateElementSchema,
} from "../schemas/canvasElement.js";
import { NotFoundError, ValidationError } from "../lib/errors.js";
import { log } from "../lib/logger.js";
import { userCanAccessFile } from "../lib/db.js";
import type { Variables } from "../types/index.js";

const elements = new Hono<{ Variables: Variables }>();
elements.use("*", authMiddleware);

/** List elements for a file, ordered by sort_index (back to front) */
elements.get("/", async (c) => {
  const user = c.get("user");
  const fileId = c.req.query("fileId");

  if (!fileId) {
    throw new ValidationError("fileId query param required");
  }

  const canAccess = await userCanAccessFile(fileId, user.id);
  if (!canAccess) {
    throw new NotFoundError("File not found or access denied");
  }

  const result = await sql`
    SELECT * FROM canvas_elements
    WHERE file_id = ${fileId}
    ORDER BY sort_index ASC
  `;

  log("elements", "List", { fileId, count: result.length });
  return c.json(result);
});

elements.post("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const validated = createElementSchema.parse(body);
  const { file_id: fileId } = validated;

  const canAccess = await userCanAccessFile(fileId, user.id);
  if (!canAccess) {
    throw new NotFoundError("File not found or access denied");
  }

  const assetId =
    validated.type === "asset" &&
    validated.props &&
    typeof validated.props === "object" &&
    "asset_id" in validated.props
      ? (validated.props.asset_id as string)
      : null;

  const [element] = await sql`
    INSERT INTO canvas_elements (file_id, type, sort_index, props, asset_id)
    VALUES (
      ${fileId},
      ${validated.type},
      ${validated.sort_index},
      ${JSON.stringify(validated.props ?? {})},
      ${assetId}
    )
    RETURNING *
  `;

  log("elements", "Created", { id: element.id, fileId, type: element.type });
  return c.json(element, 201);
});

elements.get("/:id", async (c) => {
  const user = c.get("user");
  const elementId = c.req.param("id");

  const [element] = await sql`
    SELECT e.*
    FROM canvas_elements e
    INNER JOIN files f ON e.file_id = f.id
    LEFT JOIN file_collaborators fc ON f.id = fc.file_id
    WHERE e.id = ${elementId}
      AND f.deleted_at IS NULL
      AND (f.owner_id = ${user.id} OR fc.user_id = ${user.id})
  `;

  if (!element) {
    throw new NotFoundError("Element not found");
  }

  return c.json(element);
});

elements.patch("/:id", async (c) => {
  const user = c.get("user");
  const elementId = c.req.param("id");
  const body = await c.req.json();
  const validated = updateElementSchema.parse(body);

  if (
    validated.sort_index === undefined &&
    validated.props === undefined
  ) {
    throw new ValidationError("No fields to update");
  }

  const updates: string[] = ["updated_at = NOW()"];
  const params: unknown[] = [];
  let i = 1;

  if (validated.sort_index !== undefined) {
    updates.push(`sort_index = $${i++}`);
    params.push(validated.sort_index);
  }
  if (validated.props !== undefined) {
    updates.push(`props = $${i++}::jsonb`);
    params.push(JSON.stringify(validated.props));
  }

  params.push(elementId, user.id);

  const result = await sql.query(
    `
    UPDATE canvas_elements e
    SET ${updates.join(", ")}
    FROM files f
    LEFT JOIN file_collaborators fc ON f.id = fc.file_id
    WHERE e.id = $${i++}
      AND e.file_id = f.id
      AND f.deleted_at IS NULL
      AND (f.owner_id = $${i} OR fc.user_id = $${i})
    RETURNING e.*
    `,
    params,
  );

  if (result.length === 0) {
    throw new NotFoundError("Element not found or unauthorized");
  }

  log("elements", "Updated", { id: elementId });
  return c.json(result[0]);
});

elements.delete("/:id", async (c) => {
  const user = c.get("user");
  const elementId = c.req.param("id");

  const [element] = await sql`
    DELETE FROM canvas_elements e
    USING files f
    LEFT JOIN file_collaborators fc ON f.id = fc.file_id
    WHERE e.id = ${elementId}
      AND e.file_id = f.id
      AND f.deleted_at IS NULL
      AND (f.owner_id = ${user.id} OR fc.user_id = ${user.id})
    RETURNING e.id
  `;

  if (!element) {
    throw new NotFoundError("Element not found or unauthorized");
  }

  log("elements", "Deleted", { id: element.id });
  return c.json({ success: true, id: element.id });
});

export default elements;
