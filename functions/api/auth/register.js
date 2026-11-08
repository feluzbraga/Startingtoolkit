import { json, cookieHeader, readJson, hashPassword, createSession } from '../../_shared/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return json({ ok: false, error: 'Database binding DB is missing.' }, 500);
    if (!env.ADMIN_INVITE_CODE) return json({ ok: false, error: 'Registration is not enabled yet.' }, 503);
    const body = await readJson(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const inviteCode = String(body.inviteCode || '');
    const language = ['pt', 'en', 'es'].includes(body.language) ? body.language : 'pt';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: false, error: 'Enter a valid email address.' }, 400);
    if (password.length < 12) return json({ ok: false, error: 'Password must contain at least 12 characters.' }, 400);
    if (inviteCode !== env.ADMIN_INVITE_CODE) return json({ ok: false, error: 'Invalid invitation code.' }, 403);
    const exists = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (exists) return json({ ok: false, error: 'An account with this email already exists.' }, 409);

    const userId = crypto.randomUUID();
    const licenseId = crypto.randomUUID();
    const planId = crypto.randomUUID();
    const now = new Date();
    const validFrom = now.toISOString();
    const validUntil = new Date(now.getTime() + 365 * 86400000).toISOString();
    const passwordHash = await hashPassword(password);

    await env.DB.batch([
      env.DB.prepare('INSERT INTO users (id, email, password_hash, preferred_language) VALUES (?, ?, ?, ?)').bind(userId, email, passwordHash, language),
      env.DB.prepare(`INSERT INTO licenses (id, user_id, status, valid_from, valid_until, max_businesses) VALUES (?, ?, 'active', ?, ?, 1)`).bind(licenseId, userId, validFrom, validUntil),
      env.DB.prepare('INSERT INTO business_plans (id, license_id, language) VALUES (?, ?, ?)').bind(planId, licenseId, language)
    ]);

    const token = await createSession(env.DB, userId);
    return json({ ok: true, user: { id: userId, email, language }, license: { status: 'active', validUntil, maxBusinesses: 1 } }, 201, { 'Set-Cookie': cookieHeader(token, 7 * 86400) });
  } catch (error) {
    return json({ ok: false, error: 'Could not create account.', detail: error.message }, 500);
  }
}
