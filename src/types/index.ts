import type { Context } from "hono";

// Auth types
export interface User {
  id: string;
  firebaseUid: string;
  email: string;
}

export type Variables = {
  user: User;
};

export type AuthContext = Context<{ Variables: Variables }>;

// File types
export interface File {
  id: string;
  owner_id: string;
  name: string;
  file_type: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// Asset types
export interface Asset {
  id: string;
  file_id: string;
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
