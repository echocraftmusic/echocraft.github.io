# Purchase Files

The admin tab reads the existing catalog. Singles get one full MP3 slot; albums get a slot for each catalog track in its existing order. It supports Browse, drag-and-drop, release/track search, single/album filters, ready/missing status, and authenticated downloads of tagged copies.

## Cloudflare connection

In `echocraft-music-admin`, add an R2 binding named `PURCHASE_FILES` selecting `echocraft-music-downloads`. Keep that bucket's public access disabled. Retain `ADMIN_STAGING` and the existing secrets. Replace the dashboard Worker code with the complete `cloudflare/music-admin-worker.js` and deploy. This is a single self-contained file; `purchase-files.inc.js` is its source reference and does not need a separate upload.

Upload controls remain unavailable until the authenticated Worker reports this storage binding. A GitHub commit alone does not deploy the Cloudflare Worker.

## Files and metadata

MP3 input only, up to 25 MB per track. WAV conversion and album ZIP upload are not included. The saved copy gets ID3v2.3 title, artist, album, track number for albums, release year when present, and the catalog artwork. The browser converts artwork to a JPEG up to 1000 pixels; the Worker tags the MP3. The audio payload is preserved without re-encoding. Existing ID3 metadata is rebuilt; original local files remain unchanged. Keep original masters separately if they contain lyrics or other custom tags.

Singles and albums use separate private paths. Release identity derives from its type and HyperFollow URL (title fallback). Per-track records map catalog entries to private object keys. Replacing a file writes a new object before changing its record. Catalog metadata changes mark saved tags for review. Public preview files contain only existing public catalog information, with uploads disabled.

The feature does not alter catalog prices, previews, artwork, or release publication. It does not activate production checkout, handle payment webhooks, deliver paid customer files, package album ZIPs, or implement the three-download limit. Those are the next commerce steps.

## Verification

`node cloudflare/purchase-files.test.mjs`: owner authentication, origin rejection, private storage, MP3 rejection, per-track records, cover embedding, no-store admin downloads, tag review, unchanged audio payload.

`node cloudflare/music-admin-worker.test.mjs` and `node cloudflare/square-checkout.test.mjs`: existing release manager, themes, and Sandbox regressions.

A real generated MP3 was tagged and checked using ffprobe: MP3 audio, embedded PNG, Unicode title, artist, album, track number, and year were recognized.
