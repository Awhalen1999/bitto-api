import { z } from "zod";

export const createAssetSchema = z.object({
  canvas_id: z.string().uuid(),
  name: z.string().min(1).max(255).trim(),
  file_type: z.string().min(1),
  asset_category: z.enum(['image', 'audio', 'tilemap', 'animation', 'data']),
  file_size: z.number().int().positive().max(10 * 1024 * 1024),
  r2_key: z.string().min(1),
  r2_url: z.string().url(),
  thumbnail_url: z.string().url().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateAssetSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;