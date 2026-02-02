import type { Context } from "hono";

export interface User {
  id: string;
  firebaseUid: string;
  email: string;
}

export type Variables = { user: User };

export type AuthContext = Context<{ Variables: Variables }>;

export interface File {
  id: string;
  owner_id: string;
  name: string;
  file_type: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** File metadata only. Placement in canvas_elements. */
export interface Asset {
  id: string;
  file_id: string;
  name: string;
  file_type: string;
  r2_url: string;
  thumbnail_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type CanvasElementType = "rectangle" | "line" | "text" | "asset";

export interface CanvasElement {
  id: string;
  file_id: string;
  type: CanvasElementType;
  sort_index: number;
  props: Record<string, unknown>;
  asset_id: string | null;
  created_at: string;
  updated_at: string;
}
