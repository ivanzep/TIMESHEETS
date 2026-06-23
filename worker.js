/**
 * Cloudflare Worker — Toggl API CORS proxy
 *
 * Deploy steps:
 *  1. Go to https://dash.cloudflare.com → Workers & Pages → Create
 *  2. Paste this file into the editor
 *  3. Click "Deploy" — you'll get a URL like:
 *       https://toggl-proxy.<yourname>.workers.dev
 *  4. Paste that URL into the "Proxy URL" field in toggl-api.html
 *
 * The worker only forwards GET requests to api.track.toggl.com.
 * Your API token is sent directly to Toggl over HTTPS — it is not
 * logged or stored by this worker.
 */

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '*';

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    const auth = request.headers.get('Authorization');
    if (!auth) {
      return new Response('Authorization header required', { status: 401 });
    }

    const url = new URL(request.url);
    const targetUrl = 'https://api.track.toggl.com' + url.pathname + url.search;

    let upstream;
    try {
      upstream = await fetch(targetUrl, {
        headers: { 'Authorization': auth },
      });
    } catch (err) {
      return new Response('Upstream fetch failed: ' + err.message, { status: 502 });
    }

    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
      },
    });
  },
};
