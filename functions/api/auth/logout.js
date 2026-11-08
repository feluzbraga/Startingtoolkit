import { json, cookieHeader, cookieValue, sha256 } from '../../_shared/auth.js';

export async function onRequestPost({ request, env }) {
  try {
    const token = cookieValue(request, 'stk_session');
    if (token && env.DB) {
      const tokenHash = await sha256(token);
      await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    }
    return json({ ok: true }, 200, { 'Set-Cookie': cookieHeader('', 0) });
  } catch (error) {
    return json({ ok: false, error: 'Could not sign out.' }, 500, { 'Set-Cookie': cookieHeader('', 0) });
  }
}
