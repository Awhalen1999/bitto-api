import { z } from "zod";

/** Asset = file metadata only. Placement lives in canvas_elements. */
export const createAssetSchema = z.object({
  file_id: z.string().uuid(),
  name: z.string().min(1).max(255).trim(),
  file_type: z.string().min(1),
  r2_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateAssetSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  thumbnail_url: z.string().url().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
