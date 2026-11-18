import { json, readJson, sha256, hashPassword } from '../../_shared/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJson(request);
    const token = String(body.token || '');
    const password = String(body.password || '');
    if (password.length < 12) return json({ ok: false, error: 'Password must contain at least 12 characters.' }, 400);
    const row = await env.DB.prepare(`SELECT id, user_id FROM password_reset_tokens WHERE token_hash = ? AND used_at IS NULL AND expires_at > ? LIMIT 1`).bind(await sha256(token), new Date().toISOString()).first();
    if (!row) return json({ ok: false, error: 'This reset link is invalid or has expired.' }, 400);
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await hashPassword(password), row.user_id),
      env.DB.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').bind(row.id),
      env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(row.user_id)
    ]);
    return json({ ok: true });
  } catch (error) {
    return json({ ok: false, error: 'Could not reset password.' }, 500);
  }
}
