import { z } from "zod";

export const elementTypes = ["rectangle", "line", "text", "asset"] as const;
export type ElementType = (typeof elementTypes)[number];

const assetPropsSchema = z.object({
  asset_id: z.string().uuid(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const createElementSchema = z
  .object({
    file_id: z.string().uuid(),
    type: z.enum(elementTypes),
    sort_index: z.number().int().min(0),
    props: z.record(z.string(), z.any()),
  })
  .refine(
    (data) =>
      data.type !== "asset" || assetPropsSchema.safeParse(data.props).success,
    { message: "Asset elements require props: { asset_id, x, y, width, height }" },
  );

export const updateElementSchema = z.object({
  sort_index: z.number().int().min(0).optional(),
  props: z.record(z.string(), z.any()).optional(),
});

export type CreateElementInput = z.infer<typeof createElementSchema>;
export type UpdateElementInput = z.infer<typeof updateElementSchema>;
