import { z } from "zod";

export const createCanvasSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").trim(),
});

export const updateCanvasSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    canvas_data: z.any().optional(),
  })
  .refine((data) => data.name !== undefined || data.canvas_data !== undefined, {
    message: "At least one field must be provided",
  });

export type CreateCanvasInput = z.infer<typeof createCanvasSchema>;
export type UpdateCanvasInput = z.infer<typeof updateCanvasSchema>;
