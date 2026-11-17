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

    const selected = await env.DB.prepare(`
      SELECT l.id AS license_id, l.status, l.valid_from, l.valid_until,
             bp.id AS business_plan_id, bp.business_name, bp.language
      FROM licenses l
      JOIN business_plans bp ON bp.license_id = l.id
      WHERE l.user_id = ? AND l.status = 'active'
        AND l.valid_from <= ? AND l.valid_until > ?
      ORDER BY l.created_at DESC LIMIT 1
    `).bind(user.id, new Date().toISOString(), new Date().toISOString()).first();
    if (!selected) return json({ ok: false, error: 'This account does not have an active license.' }, 403);

    const token = await createSession(env.DB, user.id, selected.business_plan_id);
    return json({
      ok: true,
      user: { id: user.id, email: user.email, language: user.preferred_language },
      license: { status: selected.status, validFrom: selected.valid_from, validUntil: selected.valid_until },
      business: { id: selected.business_plan_id, name: selected.business_name || '', language: selected.language }
    }, 200, { 'Set-Cookie': cookieHeader(token, 7 * 86400) });
  } catch (error) {
    return json({ ok: false, error: 'Could not sign in.' }, 500);
  }
}
