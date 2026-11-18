import { json, readJson, randomToken, sha256 } from '../../_shared/auth.js';
import { sendEmail } from '../../_shared/mailer.js';

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJson(request);
    const email = String(body.email || '').trim().toLowerCase();
    const language = ['pt', 'en', 'es'].includes(body.language) ? body.language : 'en';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      const recent = await env.DB.prepare(`SELECT COUNT(*) AS total FROM purchase_access_tokens WHERE buyer_email = ? AND email_sent_at > datetime('now', '-1 hour')`).bind(email).first();
      if (Number(recent?.total || 0) < 3) {
        const purchase = await env.DB.prepare(`SELECT id FROM purchase_access_tokens WHERE buyer_email = ? AND used_at IS NULL AND purchase_status = 'approved' ORDER BY created_at DESC LIMIT 1`).bind(email).first();
        if (purchase) {
          const raw = randomToken(32);
          const expires = new Date(Date.now() + 48 * 3600000).toISOString();
          await env.DB.prepare('UPDATE purchase_access_tokens SET token_hash = ?, expires_at = ?, email_sent_at = CURRENT_TIMESTAMP WHERE id = ?').bind(await sha256(raw), expires, purchase.id).run();
          const base = env.APP_BASE_URL || new URL(request.url).origin;
          await sendEmail(env, { to: email, language, type: 'activation', url: `${base.replace(/\/$/, '')}/create-account.html?token=${encodeURIComponent(raw)}` });
        }
      }
    }
    return json({ ok: true, message: 'If there is an eligible purchase, a new activation email will be sent.' });
  } catch (error) {
    return json({ ok: false, error: 'Could not send activation email.' }, 500);
  }
}
