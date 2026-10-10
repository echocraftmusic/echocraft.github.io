// EchoCraft Music Admin: authentication and connection foundation.
// Album import/publish routes will be added after this deployment is verified.
const SUPABASE_URL = 'https://jryqukxridujdqfuqinz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_1Uyu1Lfzwolx26MvLEHbQg_NXNHzTLW';
const REPO = 'echocraftmusic/echocraft.github.io';
const EMAILS = new Set(['troy.saha@gmail.com', 'echocraft.aimusic@gmail.com']);
const ORIGINS = new Set(['https://echocraftmusic.com', 'https://www.echocraftmusic.com', 'https://echocraftmusic.github.io']);

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Vary': 'Origin'
    };
    const reply = (value, status = 200) =>
      new Response(JSON.stringify(value, null, 2), { status, headers });
    if (origin && !ORIGINS.has(origin)) return reply({ error: 'Origin not allowed.' }, 403);
    if (origin) headers['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS') {
      headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
      headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
      return new Response(null, { status: 204, headers });
    }
    if (request.method !== 'GET') return reply({ error: 'Method not available yet.' }, 405);
    const path = new URL(request.url).pathname;
    if (path === '/' || path === '/health') {
      return reply({
        service: 'EchoCraft Music Admin',
        stage: 'Authentication foundation',
        githubSecretConfigured: Boolean(env.GITHUB_TOKEN),
        message: 'Worker is running. Album import and publishing are not connected yet.'
      });
    }
    if (path !== '/api/status') return reply({ error: 'Route not found.' }, 404);
    const authorization = request.headers.get('Authorization') || '';
    if (!/^Bearer [^\s]+$/.test(authorization)) return reply({ error: 'Please sign in.' }, 401);
    let step = 'Supabase sign-in request';
    try {
      const auth = await fetch(SUPABASE_URL + '/auth/v1/user', {
        headers: { apikey: SUPABASE_KEY, Authorization: authorization },
        redirect: 'error',
        signal: AbortSignal.timeout(15000)
      });
      if (!auth.ok) return reply({ error: 'Session could not be verified. Please sign in again.' }, 401);
      step = 'Supabase sign-in response';
      const user = await auth.json();
      if (!user.id || !user.email_confirmed_at || !EMAILS.has((user.email || '').toLowerCase())) {
        return reply({ error: 'This account does not have admin access.' }, 403);
      }
      if (!env.GITHUB_TOKEN) return reply({ error: 'GITHUB_TOKEN secret is missing.' }, 503);
      const githubToken = String(env.GITHUB_TOKEN).trim();
      if (!/^[A-Za-z0-9_]+$/.test(githubToken)) return reply({ error: 'The saved GitHub token contains unexpected characters. Replace the secret with only the copied token.' }, 503);
      step = 'GitHub catalog request';
      const github = await fetch('https://api.github.com/repos/' + REPO + '/contents/music/music.json?ref=main', {
        headers: {
          Authorization: 'Bearer ' + githubToken,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'EchoCraft-Music-Admin',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        redirect: 'error',
        signal: AbortSignal.timeout(15000)
      });
      if (!github.ok) return reply({ error: 'GitHub catalog connection failed.', githubStatus: github.status }, 502);
      step = 'GitHub catalog response';
      const file = await github.json();
      if (file.encoding !== 'base64' || typeof file.content !== 'string') return reply({ error: 'GitHub returned an unexpected file response.' }, 502);
      step = 'Music catalog decoding';
      const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0));
      const catalog = JSON.parse(new TextDecoder().decode(bytes).replace(/^\uFEFF/, ''));
      if (!Array.isArray(catalog.items)) return reply({ error: 'Unexpected catalog format.' }, 502);
      return reply({ ok: true, catalogReadable: true, itemCount: catalog.items.length, publishingReady: false });
    } catch (error) {
      const kind = ['TypeError', 'SyntaxError', 'TimeoutError', 'AbortError'].includes(error?.name) ? error.name : 'ConnectionError';
      console.error(JSON.stringify({ event: 'admin_connection_failed', step, kind }));
      return reply({ error: 'Connection check failed at: ' + step + ' (' + kind + ').' }, 502);
    }
  }
};
