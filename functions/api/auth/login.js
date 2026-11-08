import { json, cookieHeader, readJson, verifyPassword, createSession } from '../../_shared/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) return json({ ok: false, error: 'Database binding DB is missing.' }, 500);
    const body = await readJson(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return json({ ok: false, error: 'Enter your email and password.' }, 400);
    const user = await env.DB.prepare('SELECT id, email, password_hash, preferred_language FROM users WHERE email = ?').bind(email).first();
    if (!user || !(await verifyPassword(password, user.password_hash))) return json({ ok: false, error: 'Email or password is incorrect.' }, 401);
    const license = await env.DB.prepare(`SELECT id, status, valid_until FROM licenses WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`).bind(user.id).first();
    if (!license || license.status !== 'active' || !license.valid_until || new Date(license.valid_until).getTime() <= Date.now()) {
      return json({ ok: false, error: 'This account does not have an active license.' }, 403);
    }
    const token = await createSession(env.DB, user.id);
    return json({ ok: true, user: { id: user.id, email: user.email, language: user.preferred_language }, license: { status: license.status, validUntil: license.valid_until } }, 200, { 'Set-Cookie': cookieHeader(token, 7 * 86400) });
  } catch (error) {
    return json({ ok: false, error: 'Could not sign in.' }, 500);
  }
}
