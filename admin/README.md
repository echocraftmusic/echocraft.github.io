# Echo Craft Local Music Manager

This admin tool intentionally writes only to the local VS Code project first.

## Start it

From the repository root in the VS Code terminal:

```powershell
node scripts/admin-server.js
```

Then open:

`http://127.0.0.1:3030/admin/`

## Workflow

1. Select a detected pending release, if available.
2. Paste its DistroKid HyperFollow URL and choose **Fetch**.
3. Confirm/edit title, cover, Spotify and Apple Music links.
4. Select the preview MP3.
5. Choose **Publish to Local Site**.
6. The server copies the MP3 to `music/previews/`, updates `music/music.json`, sorts the catalog alphabetically, and removes the matching pending item.
7. Review the local website before committing/pushing to GitHub.

The HyperFollow parser is best-effort because DistroKid does not provide this page as a formal public API. All discovered fields remain editable.
