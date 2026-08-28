// Motpart till "Mat wifi" i appen. Tre sma andpunkter som latar telefonen mata
// forbindelsen mot Beaps egen server, utan nagon tredjepartstjanst.
//
//   GET  /api/speed-ping             -> nagra byte, for latensmatning
//   GET  /api/speed-down?bytes=N     -> N byte slumpdata, for nedladdning
//   POST /api/speed-up               -> raknar mottagna byte, for uppladdning
//
// Slumpdata anvands med flit: den gar inte att komprimera, sa gzip pa vagen kan
// inte blasa upp siffrorna till nagot som ser battre ut an verkligheten.

const CHUNK = 65536;                 // crypto.getRandomValues tar hogst sa mycket at gangen
const DOWN_DEFAULT = 4 * 1024 * 1024;
const DOWN_MAX = 8 * 1024 * 1024;

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow'
};

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path.endsWith('/speed-ping')) {
    return new Response('p', { headers: { ...NO_STORE, 'Content-Type': 'text/plain' } });
  }

  if (path.endsWith('/speed-down')) {
    const asked = parseInt(url.searchParams.get('bytes') || '', 10);
    const want = Math.min(Math.max(Number.isFinite(asked) ? asked : DOWN_DEFAULT, CHUNK), DOWN_MAX);
    let sent = 0;
    const stream = new ReadableStream({
      pull(controller) {
        if (sent >= want) { controller.close(); return }
        const n = Math.min(CHUNK, want - sent);
        const buf = new Uint8Array(n);
        crypto.getRandomValues(buf);
        controller.enqueue(buf);
        sent += n;
      }
    });
    return new Response(stream, {
      headers: { ...NO_STORE, 'Content-Type': 'application/octet-stream' }
    });
  }

  if (path.endsWith('/speed-up')) {
    if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    let bytes = 0;
    if (req.body) {
      const reader = req.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.length;
      }
    }
    return Response.json({ bytes }, { headers: NO_STORE });
  }

  return new Response('Not found', { status: 404 });
};

export const config = { path: ['/api/speed-ping', '/api/speed-down', '/api/speed-up'] };
