// Latency measurement. GET /api/speed-ping
export async function onRequest() {
  return new Response('p', {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}
