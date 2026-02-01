export interface Asset {
  id: string;
  canvas_id: string;
  name: string;
  file_type: string;
  asset_category: "image" | "audio" | "tilemap" | "animation" | "data";
  file_size: number;
  r2_key: string;
  r2_url: string;
  thumbnail_url: string | null;
  metadata: {
    width?: number;
    height?: number;
    duration?: number;
    fps?: number;
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface CreateAssetInput {
  canvas_id: string;
  name: string;
  file_type: string;
  asset_category: Asset["asset_category"];
  file_size: number;
  r2_key: string;
  r2_url: string;
  thumbnail_url?: string;
  metadata?: Asset["metadata"];
}
