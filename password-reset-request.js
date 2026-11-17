import { json, readJson, randomToken, sha256 } from '../../_shared/auth.js';
import { sendEmail } from '../../_shared/mailer.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJson(request);
    const email = String(body.email || '').trim().toLowerCase();
    const language = ['pt', 'en', 'es'].includes(body.language) ? body.language : 'en';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ ok: true });
    const user = await env.DB.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(email).first();
    // Always return the same response to avoid disclosing registered email addresses.
    if (user) {
      const recent = await env.DB.prepare(`SELECT COUNT(*) AS total FROM password_reset_tokens WHERE user_id = ? AND created_at > datetime('now', '-1 hour')`).bind(user.id).first();
      if (Number(recent?.total || 0) >= 3) return json({ ok: true, message: 'If the account exists, a password reset email will be sent.' });
      const raw = randomToken(32);
      const id = crypto.randomUUID();
      const expires = new Date(Date.now() + 60 * 60000).toISOString();
      await env.DB.prepare('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)').bind(id, user.id, await sha256(raw), expires).run();
      const base = env.APP_BASE_URL || new URL(request.url).origin;
      await sendEmail(env, { to: email, language, type: 'reset', url: `${base.replace(/\/$/, '')}/reset-password.html?token=${encodeURIComponent(raw)}` });
    }
    return json({ ok: true, message: 'If the account exists, a password reset email will be sent.' });
  } catch (error) {
    return json({ ok: false, error: 'Could not process the request.' }, 500);
  }
}
