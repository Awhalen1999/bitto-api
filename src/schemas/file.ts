import { z } from "zod";

export const createFileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").trim(),
  file_type: z.string().min(1),
});

export const updateFileSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
});

export type CreateFileInput = z.infer<typeof createFileSchema>;
export type UpdateFileInput = z.infer<typeof updateFileSchema>;
