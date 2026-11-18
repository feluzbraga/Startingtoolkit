import { json, sha256 } from '../../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const token = new URL(request.url).searchParams.get('token') || '';
    if (!token || token.length < 32 || !env.DB) return json({ ok: false, error: 'Invalid or expired activation link.' }, 400);
    const row = await env.DB.prepare(`SELECT buyer_email, language, expires_at, used_at, purchase_status, activation_claimed_at FROM purchase_access_tokens WHERE token_hash = ? LIMIT 1`).bind(await sha256(token)).first();
    if (!row || row.used_at || (row.activation_claimed_at && new Date(row.activation_claimed_at.replace(' ', 'T') + 'Z').getTime() > Date.now() - 10 * 60000) || row.purchase_status !== 'approved' || new Date(row.expires_at).getTime() <= Date.now()) return json({ ok: false, error: 'Invalid or expired activation link.' }, 400);
    return json({ ok: true, email: row.buyer_email, language: row.language });
  } catch (error) {
    return json({ ok: false, error: 'Could not validate activation link.' }, 500);
  }
}
