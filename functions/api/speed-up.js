// Uppladdningsmatning. POST /api/speed-up  -> raknar mottagna byte
export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  let bytes = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.length;
    }
  }
  return Response.json({ bytes }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow'
    }
  });
}
