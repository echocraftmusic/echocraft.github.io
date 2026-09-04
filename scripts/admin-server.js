'use strict';

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const ROOT = process.cwd();
const HOST = '127.0.0.1';
const PORT = Number(process.env.ECHOCRAFT_ADMIN_PORT || 3030);
const MUSIC_PATH = path.join(ROOT, 'music', 'music.json');
const PENDING_PATH = path.join(ROOT, 'music', 'pending-releases.json');
const PREVIEW_DIR = path.join(ROOT, 'music', 'previews');

function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function normalize(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function safeFileName(name) {
  const cleaned = String(name || 'preview.mp3')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || 'preview.mp3';
}

function htmlDecode(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/');
}

function fetchText(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 6) return reject(new Error('Too many redirects while loading HyperFollow.'));
    const parsed = new URL(url);
    const transport = parsed.protocol === 'http:' ? http : https;
    const req = transport.get(parsed, {
      headers: {
        'User-Agent': 'Mozilla/5.0 EchoCraftAdmin/1.0',
        Accept: 'text/html,application/xhtml+xml'
      }
    }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = new URL(res.headers.location, parsed).toString();
        res.resume();
        return resolve(fetchText(next, redirects + 1));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`HyperFollow returned HTTP ${res.statusCode}.`));
        }
        resolve({ body, finalUrl: parsed.toString() });
      });
    });
    req.setTimeout(20000, () => req.destroy(new Error('HyperFollow request timed out.')));
    req.on('error', reject);
  });
}

function metaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, 'i')
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return htmlDecode(match[1]);
  }
  return '';
}

function firstMatchingUrl(html, patterns) {
  const decoded = htmlDecode(html);
  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match) return htmlDecode(match[0]).replace(/["'<>\\]+$/g, '');
  }
  return '';
}


function safeDecodeURIComponent(value) {
  let current = String(value || '');
  for (let i = 0; i < 3; i++) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch { break; }
  }
  return htmlDecode(current);
}

function findServiceUrl(html, hostPattern) {
  const decoded = htmlDecode(html);
  const candidates = new Set();

  // Direct and JSON-escaped URLs.
  const urlMatches = decoded.match(/https?:\\?\/\\?\/[^\\s\"'<>]+/gi) || [];
  for (const raw of urlMatches) candidates.add(safeDecodeURIComponent(raw.replace(/\\\//g, '/')));

  // URLs hidden inside redirect/query parameters such as ?url=https%3A%2F%2F...
  const encodedMatches = decoded.match(/(?:https?%3A%2F%2F|https?%253A%252F%252F)[^\s\"'<>]+/gi) || [];
  for (const raw of encodedMatches) candidates.add(safeDecodeURIComponent(raw));

  for (let candidate of candidates) {
    candidate = candidate.replace(/[),.;\\\"']+$/g, '');
    if (hostPattern.test(candidate)) return candidate;
  }
  return '';
}

function parseHyperFollow(html, originalUrl) {
  const titleRaw = metaContent(html, 'og:title') || metaContent(html, 'twitter:title');
  const description = metaContent(html, 'og:description') || '';
  const cover = metaContent(html, 'og:image') || metaContent(html, 'twitter:image');

  let title = titleRaw
    .replace(/\s*[-|–—]\s*HyperFollow.*$/i, '')
    .replace(/\s*[-|–—]\s*Echo Craft.*$/i, '')
    .trim();

  // DistroKid pages sometimes use "Artist - Release" as the OG title.
  title = title.replace(/^Echo Craft\s*[-|–—:]\s*/i, '').trim();

  const spotify = firstMatchingUrl(html, [
    /https:\/\/open\.spotify\.com\/(?:album|track)\/[A-Za-z0-9]+[^\s"'<>]*/i
  ]) || findServiceUrl(html, /^https?:\/\/open\.spotify\.com\/(?:album|track)\//i);
  const apple = firstMatchingUrl(html, [
    /https:\/\/music\.apple\.com\/[A-Za-z0-9/_?=&.%+-]+/i,
    /https:\/\/itunes\.apple\.com\/[A-Za-z0-9/_?=&.%+-]+/i
  ]) || findServiceUrl(html, /^https?:\/\/(?:music|itunes)\.apple\.com\//i);

  return {
    hyperfollow: originalUrl,
    title,
    artist: 'Echo Craft',
    cover,
    spotify,
    apple,
    description
  };
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.ico': 'image/x-icon'
  })[ext] || 'application/octet-stream';
}

function serveStatic(req, res, pathname) {
  let relative = decodeURIComponent(pathname);
  if (relative === '/') relative = '/index.html';
  if (relative.endsWith('/')) relative += 'index.html';

  const requested = path.resolve(ROOT, '.' + relative);
  if (!requested.startsWith(path.resolve(ROOT))) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.stat(requested, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': contentType(requested), 'Cache-Control': 'no-store' });
    fs.createReadStream(requested).pipe(res);
  });
}

function readBody(req, maxBytes = 30 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.setEncoding('utf8');
    req.on('data', chunk => {
      size += Buffer.byteLength(chunk);
      if (size > maxBytes) {
        reject(new Error('Upload is too large for the local admin server.'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function handleApi(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/status') {
    return sendJson(res, 200, { ok: true, mode: 'local', root: ROOT });
  }

  if (req.method === 'GET' && pathname === '/api/pending') {
    return sendJson(res, 200, readJson(PENDING_PATH, { artist: 'Echo Craft', items: [] }));
  }

  if (req.method === 'GET' && pathname === '/api/catalog') {
    return sendJson(res, 200, readJson(MUSIC_PATH, { items: [] }));
  }

  if (req.method === 'POST' && pathname === '/api/hyperfollow') {
    try {
      const payload = JSON.parse(await readBody(req));
      const url = String(payload.url || '').trim();
      if (!/^https?:\/\/(?:www\.)?distrokid\.com\/hyperfollow\//i.test(url)) {
        return sendJson(res, 400, { error: 'Please paste a valid DistroKid HyperFollow URL.' });
      }
      const { body, finalUrl } = await fetchText(url);
      return sendJson(res, 200, { ok: true, finalUrl, ...parseHyperFollow(body, url) });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  if (req.method === 'POST' && pathname === '/api/publish') {
    try {
      const payload = JSON.parse(await readBody(req));
      const entry = payload.entry || {};
      const preview = payload.preview || null;

      const title = String(entry.title || '').trim();
      if (!title) return sendJson(res, 400, { error: 'Song title is required.' });
      if (!String(entry.hyperfollow || '').trim()) {
        return sendJson(res, 400, { error: 'HyperFollow URL is required.' });
      }

      fs.mkdirSync(PREVIEW_DIR, { recursive: true });
      let previewPath = String(entry.preview || '').trim();
      if (preview && preview.name && preview.dataBase64) {
        const fileName = safeFileName(preview.name.endsWith('.mp3') ? preview.name : `${preview.name}.mp3`);
        const absolute = path.join(PREVIEW_DIR, fileName);
        fs.writeFileSync(absolute, Buffer.from(preview.dataBase64, 'base64'));
        previewPath = `music/previews/${fileName}`;
      }

      const catalog = readJson(MUSIC_PATH, { items: [] });
      const now = new Date().toISOString();
      const finished = {
        type: entry.type || 'single',
        title,
        artist: String(entry.artist || 'Echo Craft').trim() || 'Echo Craft',
        releaseDate: String(entry.releaseDate || '').trim(),
        cover: String(entry.cover || '').trim(),
        preview: previewPath,
        hyperfollow: String(entry.hyperfollow || '').trim(),
        spotify: String(entry.spotify || '').trim(),
        apple: String(entry.apple || '').trim(),
        itunes: String(entry.itunes || '').trim(),
        updated: now,
        created: String(entry.created || '').trim() || now
      };

      const items = Array.isArray(catalog.items) ? catalog.items : [];
      const matchIndex = items.findIndex(item =>
        normalize(item.title) === normalize(finished.title) ||
        (finished.hyperfollow && item.hyperfollow === finished.hyperfollow)
      );
      if (matchIndex >= 0) {
        finished.created = items[matchIndex].created || finished.created;
        items[matchIndex] = { ...items[matchIndex], ...finished };
      } else {
        items.push(finished);
      }
      items.sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), undefined, { sensitivity: 'base' }));
      writeJson(MUSIC_PATH, { ...catalog, items });

      const pending = readJson(PENDING_PATH, { artist: 'Echo Craft', items: [] });
      const pendingItems = Array.isArray(pending.items) ? pending.items : [];
      pending.items = pendingItems.filter(item => {
        if (entry.collectionId && String(item.collectionId) === String(entry.collectionId)) return false;
        return normalize(item.title) !== normalize(finished.title) &&
          normalize(String(item.title || '').replace(/\s*-\s*Single$/i, '')) !== normalize(finished.title);
      });
      writeJson(PENDING_PATH, pending);

      return sendJson(res, 200, {
        ok: true,
        message: `${finished.title} saved to the local Echo Craft music catalog.`,
        preview: previewPath,
        totalItems: items.length
      });
    } catch (error) {
      return sendJson(res, 500, { error: error.message });
    }
  }

  sendJson(res, 404, { error: 'Unknown API endpoint.' });
}

const server = http.createServer(async (req, res) => {
  try {
    const parsed = new URL(req.url, `http://${req.headers.host || `${HOST}:${PORT}`}`);
    if (parsed.pathname.startsWith('/api/')) {
      return await handleApi(req, res, parsed.pathname);
    }
    serveStatic(req, res, parsed.pathname);
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('Echo Craft Admin server is running.');
  console.log(`Open: http://${HOST}:${PORT}/admin/`);
  console.log('Press Ctrl+C in this terminal when you are finished.');
  console.log('');
});
