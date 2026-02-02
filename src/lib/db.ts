import { sql } from "../db/client.js";

/** Returns true if user has access to file (owner or collaborator) */
export async function userCanAccessFile(
  fileId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await sql`
    SELECT 1
    FROM files f
    LEFT JOIN file_collaborators fc ON f.id = fc.file_id
    WHERE f.id = ${fileId}
      AND f.deleted_at IS NULL
      AND (f.owner_id = ${userId} OR fc.user_id = ${userId})
    LIMIT 1
  `;
  return !!row;
}

/** Returns true if user owns the file */
export async function userOwnsFile(
  fileId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await sql`
    SELECT 1
    FROM files
    WHERE id = ${fileId}
      AND owner_id = ${userId}
      AND deleted_at IS NULL
    LIMIT 1
  `;
  return !!row;
}
