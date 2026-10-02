// Metadata om en signeringslank.  GET /api/sign-load?t=<token>
import { NO_STORE, loadRequest, store, writeMeta } from '../../cflib/sign.js';

export async function onRequest(context) {
  const { request, env } = context;
  const { fel, token, meta, status } = await loadRequest(env, new URL(request.url));
  if (fel) return fel;

  // A record signed before 2026-10-02 still carries the expiry it was written with (37 days on
  // the record, 90 on the signature page), and nothing else ever touches it again. The first
  // read after that lifts the expiry off the record, the signature page and an old KV-stored
  // report, and marks the record so it is done once. Best effort: a read must never fail on it.
  if (status === 'signed' && !meta.permanent) {
    try {
      await writeMeta(env, token, { ...meta, permanent: true });
      const cert = await store(env).get('cert/' + token, 'text');
      if (cert) await store(env).put('cert/' + token, cert);
      if (!meta.pdfId) {
        const pdf = await store(env).get('pdf/' + token, 'text');
        if (pdf) await store(env).put('pdf/' + token, pdf);
      }
    } catch (e) {}
  }

  return Response.json({
    status,
    ref: meta.ref, type: meta.type, address: meta.address, apt: meta.apt,
    inspector: meta.inspector, filename: meta.filename,
    recipientName: meta.recipientName, recipientRole: meta.recipientRole,
    created: meta.created, expires: meta.expires,
    signedAt: meta.signedAt, signedName: meta.signedName, signedRole: meta.signedRole
  }, { headers: NO_STORE });
}
