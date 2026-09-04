'use strict';

const fs = require('fs');
const https = require('https');
const path = require('path');

const CATALOG_PATH = path.join(process.cwd(), 'music', 'music.json');
const PENDING_PATH = path.join(process.cwd(), 'music', 'pending-releases.json');

// Existing Echo Craft Apple Music collection used only to resolve the stable Apple artist ID.
// This avoids depending on the retired YouTube Topic Channel or any GitHub secret.
const SEED_COLLECTION_ID = '1883654531';
const EXPECTED_ARTIST_NAME = 'Echo Craft';

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'EchoCraftReleaseMonitor/1.0',
          Accept: 'application/json'
        }
      },
      res => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(`HTTP ${res.statusCode} from Apple lookup service`)
            );
          }

          try {
            resolve(JSON.parse(body));
          } catch (error) {
            reject(new Error(`Unable to parse Apple response: ${error.message}`));
          }
        });
      }
    );

    req.setTimeout(20000, () => {
      req.destroy(new Error('Apple lookup request timed out'));
    });

    req.on('error', reject);
  });
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function collectionIdFromAppleUrl(value) {
  const match = String(value || '').match(/\/(?:album|us\/album)\/[^/]*\/(\d+)/i);
  return match ? match[1] : '';
}

function highResolutionArtwork(url) {
  return String(url || '')
    .replace(/\/\d+x\d+bb\./, '/1200x1200bb.')
    .replace(/\/\d+x\d+bb-\d+\./, '/1200x1200bb-60.');
}

function dateOnly(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

async function resolveArtistId() {
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(SEED_COLLECTION_ID)}&entity=album&country=US`;
  const data = await requestJson(url);

  const collection = (data.results || []).find(
    item => String(item.collectionId || '') === SEED_COLLECTION_ID
  );

  if (!collection || !collection.artistId) {
    throw new Error('Could not resolve the Echo Craft Apple artist ID from the seed release.');
  }

  if (normalize(collection.artistName) !== normalize(EXPECTED_ARTIST_NAME)) {
    throw new Error(
      `Seed release resolved to unexpected artist: ${collection.artistName || 'unknown'}`
    );
  }

  return String(collection.artistId);
}

async function fetchArtistReleases(artistId) {
  const url = `https://itunes.apple.com/lookup?id=${encodeURIComponent(artistId)}&entity=album&limit=200&country=US`;
  const data = await requestJson(url);

  const releases = (data.results || [])
    .filter(item => item.wrapperType === 'collection')
    .filter(item => String(item.artistId || '') === String(artistId))
    .filter(item => normalize(item.artistName) === normalize(EXPECTED_ARTIST_NAME))
    .map(item => ({
      collectionId: String(item.collectionId),
      type: Number(item.trackCount || 0) > 1 ? 'album' : 'single',
      title: item.collectionName || 'Untitled Release',
      artist: item.artistName || EXPECTED_ARTIST_NAME,
      releaseDate: dateOnly(item.releaseDate),
      cover: highResolutionArtwork(item.artworkUrl100),
      apple: item.collectionViewUrl || '',
      trackCount: Number(item.trackCount || 0),
      genre: item.primaryGenreName || '',
      source: 'apple-music-catalog'
    }));

  releases.sort((a, b) => {
    const byDate = String(b.releaseDate).localeCompare(String(a.releaseDate));
    return byDate || a.title.localeCompare(b.title);
  });

  return releases;
}

function getKnownReleaseKeys(catalog, pending) {
  const ids = new Set();
  const titles = new Set();

  for (const item of [...(catalog.items || []), ...(pending.items || [])]) {
    const id = item.collectionId || collectionIdFromAppleUrl(item.apple);
    if (id) ids.add(String(id));
    if (item.title) titles.add(normalize(item.title));
  }

  return { ids, titles };
}

async function main() {
  console.log('Echo Craft release monitor starting...');
  console.log('Source: Apple/iTunes public catalog (no API key required)');

  const catalog = readJson(CATALOG_PATH, { items: [] });
  const pending = readJson(PENDING_PATH, { artist: EXPECTED_ARTIST_NAME, items: [] });

  const artistId = await resolveArtistId();
  console.log(`Resolved Echo Craft Apple artist ID: ${artistId}`);

  const releases = await fetchArtistReleases(artistId);
  console.log(`Found ${releases.length} Echo Craft catalog releases.`);

  const known = getKnownReleaseKeys(catalog, pending);
  const newReleases = releases.filter(release => {
    if (known.ids.has(release.collectionId)) return false;
    // Title fallback protects older catalog entries whose Apple URL might not expose an ID cleanly.
    if (known.titles.has(normalize(release.title))) return false;
    return true;
  });

  if (newReleases.length === 0) {
    console.log('No new releases detected. Nothing to change.');
    return;
  }

  const detectedAt = new Date().toISOString();
  const additions = newReleases.map(release => ({
    ...release,
    status: 'pending',
    detectedAt,
    note: 'Detected automatically. Add HyperFollow/Spotify/preview details before publishing to music/music.json.'
  }));

  const output = {
    artist: EXPECTED_ARTIST_NAME,
    artistId,
    source: 'Apple/iTunes public catalog',
    instructions: 'Pending releases are intentionally not shown on the website until their richer Echo Craft metadata is added to music/music.json.',
    items: [...additions, ...(pending.items || [])]
  };

  fs.writeFileSync(PENDING_PATH, JSON.stringify(output, null, 2) + '\n');

  console.log(`Detected ${additions.length} new release(s):`);
  additions.forEach(item => {
    console.log(`  • ${item.title} (${item.releaseDate || 'date unavailable'}) [${item.type}]`);
  });
  console.log(`Saved to ${PENDING_PATH}`);
}

main().catch(error => {
  console.error(`Release monitor error: ${error.message}`);
  process.exitCode = 1;
});
