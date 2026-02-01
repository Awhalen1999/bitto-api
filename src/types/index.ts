import type { Context } from "hono";

// Auth types
export interface User {
  id: string; // Internal database UUID
  firebaseUid: string;
  email: string;
}

export type Variables = {
  user: User;
};

export type AuthContext = Context<{ Variables: Variables }>;

// Canvas types
export interface Canvas {
  id: string;
  owner_id: string;
  name: string;
  viewport_x: number;
  viewport_y: number;
  viewport_scale: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// Asset types
export interface Asset {
  id: string;
  canvas_id: string;
  name: string;
  file_type: string;
  r2_url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  created_at: string;
  updated_at: string;
}
