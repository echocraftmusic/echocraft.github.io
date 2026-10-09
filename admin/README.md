# Echo Craft Music Manager

From the latest repository checkout, run `node scripts/admin-server.js`, then open `http://127.0.0.1:3030/admin/` and sign in.

## Create or edit a release

1. Choose a pending release, select an existing saved release, or enter a new release manually.
2. Choose Single or Album. HyperFollow and streaming links are optional, so unreleased albums can be prepared ahead of distribution.
3. Enter the title, description, cover URL or uploaded JPG/PNG/WEBP, and release date.
4. For albums, add named tracks in order. Upload each preview MP3 or enter its existing path. Move tracks up/down or remove them as needed.
5. Select availability: Available now, Scheduled release, or Draft (hidden). Scheduling uses America/New_York, including daylight saving time. The Christmas preset is October 31, 2026 at midnight Eastern.
6. Save to Local Site. Review the local showcase, then commit and push the updated catalog, covers, previews, and application files to GitHub before the release time.

The release date is catalog metadata; Showcase availability controls when an entry appears. Scheduled entries automatically appear in the showcase at their release time, including on already-open home pages. Albums use `albums/album.html?title=...`; separate pages do not need to be created manually.

Save Draft stores form data in this browser. Uploaded files cannot be stored in browser drafts: select them again after restoring. Saving availability as Draft to the local catalog preserves the release for later editing while hiding it from the showcase.

## Hosting and fulfillment

The manager still runs locally. The hosted GitHub Pages admin cannot save files without this local server. Save to Local Site does not automatically push to GitHub.

Scheduling controls public showcase visibility, not access control: catalog entries and uploaded previews are public repository assets. Upload only preview clips and public promotional artwork. Protected full-song delivery, checkout, and payment-based release gates require the commerce backend and are not provided by this workflow.

The HyperFollow parser is best-effort; discovered fields remain editable.

## When HyperFollow Fetch returns 403

A 403 occurs before parsing. If the page opens in your browser, expand “Fetch blocked? Import a saved HyperFollow page.” Save that loaded page with Ctrl+S as Webpage, HTML Only, then select its HTML file and click Import saved page. Keep the matching HyperFollow URL in the URL field. Review all imported details before saving. Only the HTML text is parsed; uploaded scripts are never executed. This reads promotional metadata and does not download music or publish a release automatically.
