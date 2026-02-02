# Canvas MVP — Reference

## Schema

**users** — id, firebase_uid, email, display_name, avatar_url, created_at, updated_at

**files** — id, owner_id, name, file_type, created_at, updated_at, deleted_at

**file_collaborators** — file_id, user_id, role, added_at

**assets** — id, file_id, name, file_type, r2_url, thumbnail_url, metadata, created_at, updated_at

**canvas_elements** — id, file_id, type, sort_index, props, asset_id, created_at, updated_at
- type: rectangle | line | text | asset
- asset_id required when type = asset

## Endpoints

**GET** `/health`

**POST** `/api/auth/sync` — body: { displayName?, photoURL? }

**GET** `/api/files` — ?view=all|my-files|shared|trash&sort=last-modified|name-asc|name-desc|newest

**POST** `/api/files` — body: { name, file_type }

**GET** `/api/files/:id`  
**PATCH** `/api/files/:id` — body: { name? }  
**DELETE** `/api/files/:id`  
**POST** `/api/files/:id/restore`  
**DELETE** `/api/files/:id/permanent`

**GET** `/api/assets/file/:fileId`  
**POST** `/api/assets` — body: { file_id, name, file_type, r2_url, thumbnail_url?, metadata? }  
**GET** `/api/assets/:id`  
**PATCH** `/api/assets/:id` — body: { name?, thumbnail_url?, metadata? }  
**DELETE** `/api/assets/:id`

**GET** `/api/elements` — ?fileId=  
**POST** `/api/elements` — body: { file_id, type, sort_index, props }  
**GET** `/api/elements/:id`  
**PATCH** `/api/elements/:id` — body: { sort_index?, props? }  
**DELETE** `/api/elements/:id`

All except /health and /auth/sync need `Authorization: Bearer <token>`
