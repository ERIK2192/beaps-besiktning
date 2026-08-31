// Download measurement. GET /api/speed-down?bytes=N
//
// Random data is used on purpose: it can't be compressed, so gzip in transit can't
// inflate the numbers into something that looks better than reality.
const CHUNK = 65536;                 // crypto.getRandomValues takes at most this much at a time
const DEFAULT = 4 * 1024 * 1024;
const MAX = 8 * 1024 * 1024;

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const asked = parseInt(url.searchParams.get('bytes') || '', 10);
  const want = Math.min(Math.max(Number.isFinite(asked) ? asked : DEFAULT, CHUNK), MAX);

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
    headers: {
      'Content-Type': 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}
