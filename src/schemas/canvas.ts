import { z } from "zod";

export const createCanvasSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").trim(),
});

export const updateCanvasSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
});

export type CreateCanvasInput = z.infer<typeof createCanvasSchema>;
export type UpdateCanvasInput = z.infer<typeof updateCanvasSchema>;
