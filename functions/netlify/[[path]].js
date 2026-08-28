// Netlify-mappen ligger kvar i repot sa den sajten fortsatter fungera, men dess
// kallkod ska inte serveras som statiska filer harifran. Functions tar foretrade
// framfor statiska filer pa Cloudflare Pages, sa den har fangar hela /netlify/*.
export async function onRequest() {
  return new Response('Not found', { status: 404 });
}
