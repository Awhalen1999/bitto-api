import type { Context } from "hono";

export interface User {
  uid: string;
  email: string;
}

export type Variables = {
  user: User;
};

export type AuthContext = Context<{ Variables: Variables }>;
