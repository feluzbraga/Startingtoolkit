import { json, readJson, sha256, hashPassword, createSession, cookieHeader } from '../../_shared/auth.js';

export async function onRequestPost({ request, env }) {
  let claimedPurchaseId = null;
  try {
    if (!env.DB) return json({ ok: false, error: 'Database is unavailable.' }, 500);
    const body = await readJson(request);
    const token = String(body.token || '');
    const password = String(body.password || '');
    const language = ['pt', 'en', 'es'].includes(body.language) ? body.language : 'en';
    if (password.length < 12) return json({ ok: false, error: 'Password must contain at least 12 characters.' }, 400);
    const tokenHash = await sha256(token);
    const purchase = await env.DB.prepare(`SELECT * FROM purchase_access_tokens WHERE token_hash = ? AND used_at IS NULL AND purchase_status = 'approved' AND expires_at > ? LIMIT 1`).bind(tokenHash, new Date().toISOString()).first();
    if (!purchase) return json({ ok: false, error: 'This activation link is invalid or has expired. Request a new link.' }, 400);
    const claim = await env.DB.prepare(`UPDATE purchase_access_tokens SET activation_claimed_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL AND (activation_claimed_at IS NULL OR datetime(activation_claimed_at) < datetime('now', '-10 minutes'))`).bind(purchase.id).run();
    if (!claim.meta || claim.meta.changes !== 1) return json({ ok: false, error: 'This activation link is already being used. Refresh the page or request a new link.' }, 409);

    claimedPurchaseId = purchase.id;
    let user = await env.DB.prepare('SELECT id, email FROM users WHERE email = ? LIMIT 1').bind(purchase.buyer_email).first();
    const passwordHash = await hashPassword(password);
    if (user) {
      await env.DB.prepare('UPDATE users SET password_hash = ?, preferred_language = ? WHERE id = ?').bind(passwordHash, language || purchase.language, user.id).run();
    } else {
      const userId = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO users (id, email, password_hash, preferred_language) VALUES (?, ?, ?, ?)').bind(userId, purchase.buyer_email, passwordHash, language || purchase.language).run();
      user = { id: userId, email: purchase.buyer_email };
    }

    const licenseId = crypto.randomUUID();
    const planId = crypto.randomUUID();
    const start = new Date();
    const end = new Date(start.getTime() + 365 * 86400000);
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO licenses (id, user_id, status, valid_from, valid_until, max_businesses) VALUES (?, ?, 'active', ?, ?, 1)`).bind(licenseId, user.id, start.toISOString(), end.toISOString()),
      env.DB.prepare('INSERT INTO business_plans (id, license_id, language) VALUES (?, ?, ?)').bind(planId, licenseId, language || purchase.language),
      env.DB.prepare('UPDATE purchase_access_tokens SET license_id = ? WHERE id = ?').bind(licenseId, purchase.id)
    ]);
    await env.DB.prepare('UPDATE purchase_access_tokens SET used_at = CURRENT_TIMESTAMP, activation_claimed_at = NULL WHERE id = ? AND used_at IS NULL').bind(purchase.id).run();
    const sessionToken = await createSession(env.DB, user.id, planId);
    claimedPurchaseId = null;
    return json({ ok: true, user: { id: user.id, email: user.email }, redirect: '/modules/dashboard.html' }, 200, { 'Set-Cookie': cookieHeader(sessionToken, 7 * 86400) });
  } catch (error) {
    if (claimedPurchaseId && env.DB) await env.DB.prepare('UPDATE purchase_access_tokens SET activation_claimed_at = NULL WHERE id = ? AND used_at IS NULL').bind(claimedPurchaseId).run().catch(() => {});
    return json({ ok: false, error: 'Could not activate account.' }, 500);
  }
}
