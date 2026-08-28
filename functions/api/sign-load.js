// Metadata om en signeringslank.  GET /api/sign-load?t=<token>
import { NO_STORE, loadRequest } from '../../cflib/sign.js';

export async function onRequest(context) {
  const { request, env } = context;
  const { fel, meta, status } = await loadRequest(env, new URL(request.url));
  if (fel) return fel;

  return Response.json({
    status,
    ref: meta.ref, type: meta.type, address: meta.address, apt: meta.apt,
    inspector: meta.inspector, filename: meta.filename,
    recipientName: meta.recipientName, recipientRole: meta.recipientRole,
    created: meta.created, expires: meta.expires,
    signedAt: meta.signedAt, signedName: meta.signedName, signedRole: meta.signedRole
  }, { headers: NO_STORE });
}
