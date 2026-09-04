# Echo Craft Release Automation

## What changed

The retired workflow depended on a separate YouTube Topic Channel and two GitHub secrets. The Echo Craft catalog is now presented through the main Official Artist Channel's Releases experience, so the old Topic Channel workflow is no longer a reliable source.

## New workflow

`.github/workflows/update-echo-craft-releases.yml` runs daily and can also be started manually.

It uses Apple's public iTunes catalog lookup to identify Echo Craft releases without any API key or GitHub secret. The script resolves the stable Echo Craft Apple artist ID from an existing catalog release, then checks that artist's current releases.

New releases are added to:

`music/pending-releases.json`

They are deliberately **not** added directly to `music/music.json`. The website's live catalog contains richer Echo Craft-specific fields such as local preview MP3s, DistroKid HyperFollow links, Spotify links, and curated cover art. Automatically overwriting that catalog would risk incomplete cards or loss of those fields.

## Publishing a detected release

When a new item appears in `music/pending-releases.json`:

1. Copy the release into `music/music.json`.
2. Add the local `preview` MP3 path when available.
3. Add the DistroKid `hyperfollow` URL.
4. Add the Spotify URL.
5. Keep the detected Apple Music URL and release date.
6. Remove the item from `music/pending-releases.json` after publishing.

## Important

The old `update-music-topic.yml` workflow should remain disabled or be deleted from GitHub Actions. It references the retired Topic Channel workflow and will continue to fail if re-enabled.

The separate `update-youtube.yml` workflow is for ordinary Echo Craft YouTube videos and still expects the `YOUTUBE_API_KEY` repository secret. It is unrelated to this release monitor.
