# Echo Craft: Site Integrity Guardrails

**Owner approval is required before any release, catalog, media, checkout, or site-data modification.**

## Verified recovery point
- Known working storefront commit: `1539982ebf3d5e6c094782574e16ae158a405a60`
- Confirmed by owner on 2026-10-10: both Albums and Music displayed correctly in Firefox private mode.
- `music/music.json` blob SHA at this checkpoint: `083ed6a6e6b73359831f0c8ea28bb003c633adf4` (38 releases, 4 albums).
- This baseline represents the last *owner-confirmed* storefront state. Do not replace the baseline merely because a deployment succeeded.

## Non-negotiable release process
1. **Stop and obtain permission** before editing catalog JSON, cover art, preview MP3s, product metadata, pricing, navigation, checkout, worker bindings/secrets, or existing functional logic. A request to alter layout does NOT grant permission to alter content or data.
2. **Compare current files with the baseline** and inspect all changes before committing. Keep changes scoped to the feature authorized.
3. **Use a branch or isolated preview first** for structural changes; do not test experimental functionality on the live site. Run syntax, catalog/schema, and interaction tests, including desktop/tablet/mobile layouts.
4. **Preserve all existing content**. No bulk replacements of working components, silent imports, unrelated refactoring, deletion of tracks, or overwriting release prices as a side effect.
5. **Verify the actual deployed site**, not only the GitHub commit or Cloudflare editor. Confirm all albums and singles load, previews work, and navigation works. Wait for deployment completion and use cache-busting where appropriate.
6. **If anything breaks or data changes without authorization: STOP further work, investigate, restore the affected files from the last owner-confirmed baseline, verify deployment and live behavior, and tell the owner precisely what changed.** Do not continue a new feature until the owner verifies recovery.
7. **Never confuse GitHub Pages with Cloudflare Workers**: a GitHub source commit does not deploy a manually managed Cloudflare Worker. Never change production secrets, payment modes, or live Worker code without specific owner approval.
8. **Always retain a recovery reference** and document the files and commits changed. Do not declare a live fix successful solely from source inspection.

## Layout-only work
- Preserve exact music catalog contents, release count, cover paths, tracks, and playback behavior.
- Center the desktop/laptop/tablet content in a bounded max-width area. Do not let cards grow without limit as screens widen. Keep phone spacing separately responsive.
- Any storefront changes must be tested before live deployment.

## What these guardrails can and cannot do
These are mandatory project operating rules and a durable restore reference. A repository markdown file cannot, by itself, make changes technically impossible or provide immediate autonomous incident monitoring/rollback. Enforceable protection additionally requires GitHub branch protection/rulesets, CI tests and an approved deployment workflow. Never claim that an unconfigured automated rollback or approval gate exists.
