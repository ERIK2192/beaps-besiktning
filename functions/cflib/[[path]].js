// Delade hjalpmoduler. De byggs in i funktionerna och behover inte serveras.
export async function onRequest() {
  return new Response('Not found', { status: 404 });
}
