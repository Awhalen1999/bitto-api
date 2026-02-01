import type { Context } from "hono";

export interface User {
  uid: string;
  email: string;
}

export type Variables = {
  user: User;
};

export type AuthContext = Context<{ Variables: Variables }>;

export interface CanvasData {
  version: number;
  objects: CanvasObject[];
  viewport: {
    x: number;
    y: number;
    scale: number;
  };
}

export interface CanvasObject {
  id: string;
  type: "asset" | "group";
  assetId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  groupId?: string;
  zIndex: number;
  label?: string;
}
