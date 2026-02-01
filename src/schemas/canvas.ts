import { z } from "zod";

export const canvasObjectSchema = z.object({
  id: z.string(),
  type: z.enum(['asset', 'group']),
  assetId: z.string().uuid().optional(),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().optional(),
  groupId: z.string().optional(),
  zIndex: z.number().int(),
  label: z.string().optional(),
});

export const canvasDataSchema = z.object({
  version: z.number().int().default(1),
  objects: z.array(canvasObjectSchema).default([]),
  viewport: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
    scale: z.number().positive().default(1),
  }).default({ x: 0, y: 0, scale: 1 }),
});

export const createCanvasSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long").trim(),
});

export const updateCanvasSchema = z
  .object({
    name: z.string().min(1).max(100).trim().optional(),
    canvas_data: canvasDataSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.canvas_data !== undefined, {
    message: "At least one field must be provided",
  });

export type CreateCanvasInput = z.infer<typeof createCanvasSchema>;
export type UpdateCanvasInput = z.infer<typeof updateCanvasSchema>;
export type CanvasData = z.infer<typeof canvasDataSchema>;
export type CanvasObject = z.infer<typeof canvasObjectSchema>;