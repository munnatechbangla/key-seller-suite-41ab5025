# Single-image "Optimize" action in the Media Library

Adds one extra small button next to the existing Copy / Rename / Delete buttons on an image card. Pressing it re-saves that one image as a smaller WebP file, in the same place, under the same name and link. Nothing is renamed, moved, or duplicated.

## What happens when the button is pressed

1. The current image is downloaded in the browser.
2. It is redrawn at a maximum of 1200px on its longest side (aspect ratio kept, never enlarged) and re-encoded as WebP at quality 0.85.
3. If the result is not actually smaller, the action stops and reports "already optimized" — the stored file is left untouched.
4. Otherwise the new file is written back to the exact same storage path with `upsert: true`, `contentType: "image/webp"`, `cacheControl: "31536000"`.
5. The existing asset record is updated with the new file size, width, height and type. The path, filename, id and all product references stay the same.
6. The in-memory link cache entry for that path is cleared so the new version shows immediately.

Confirmation dialog before running, toast on success/failure, list refreshed after.

## Files changed

- `src/lib/media/optimize.ts` — add `optimizeBlobToWebp(blob)`: same canvas/1200px/0.85 logic as the upload path, returns `{ blob, width, height }` or `null` when no gain. Existing `optimizeImageFile` untouched.
- `src/lib/media/resolve.ts` — export `clearMediaUrlCache(path)` that deletes one entry from the existing in-memory cache. No other change.
- `src/lib/media.functions.ts` — add `updateAssetMetaFn` (admin-only, same pattern as `renameAssetFn`): updates only `mime_type`, `file_size`, `width`, `height` on the given asset id.
- `src/components/admin/MediaLibrary.tsx` — add one icon button per image card and the mutation that runs steps 1-6.

## Not included

No bulk optimization, no database schema/RLS/bucket changes, no path or filename changes, no layout changes, no change to the existing upload behavior.
