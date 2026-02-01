import { z } from "zod";

export const createAssetSchema = z.object({
  canvas_id: z.string().uuid(),
  name: z.string().min(1).max(255).trim(),
  file_type: z.string().min(1), // MIME type: "image/png"
  r2_url: z.string().url(),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().positive().default(100),
  height: z.number().positive().default(100),
  z_index: z.number().int().default(0),
});

export const updateAssetSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  z_index: z.number().int().optional(),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
