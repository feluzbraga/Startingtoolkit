import { json, randomToken, sha256 } from '../../_shared/auth.js';
import { sendEmail } from '../../_shared/mailer.js';

function getPath(obj, path) { return path.split('.').reduce((v, k) => v && v[k] !== undefined ? v[k] : undefined, obj); }
function pick(obj, paths) { for (const path of paths) { const value = getPath(obj, path); if (value !== undefined && value !== null && value !== '') return value; } return null; }
function languageFor(payload, env) {
  const offerCode = String(pick(payload, ['data.purchase.offer.code', 'data.purchase.offer.key', 'data.offer.code']) || '').toUpperCase();
  if (env.HOTMART_OFFER_PT && offerCode === env.HOTMART_OFFER_PT.toUpperCase()) return 'pt';
  if (env.HOTMART_OFFER_EN && offerCode === env.HOTMART_OFFER_EN.toUpperCase()) return 'en';
  if (env.HOTMART_OFFER_ES && offerCode === env.HOTMART_OFFER_ES.toUpperCase()) return 'es';
  const locale = String(pick(payload, ['data.buyer.locale', 'data.purchase.shopper.locale', 'data.buyer.language']) || '').toLowerCase();
  if (locale.startsWith('pt')) return 'pt';
  if (locale.startsWith('es')) return 'es';
  if (locale.startsWith('en')) return 'en';
  const currency = String(pick(payload, ['data.purchase.price.currency_code', 'data.purchase.currency_code']) || '').toUpperCase();
  const country = String(pick(payload, ['data.buyer.address.country', 'data.buyer.country']) || '').toUpperCase();
  if (currency === 'BRL' || country === 'BR') return 'pt';
  if (['ES', 'MX', 'AR', 'CO', 'CL', 'SPAIN', 'MEXICO', 'ARGENTINA', 'COLOMBIA', 'CHILE'].includes(country)) return 'es';
  return 'en';
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.HOTMART_HOTTOK || !env.HOTMART_PRODUCT_ID) return json({ ok: false, error: 'Webhook configuration is incomplete.' }, 503);
  let rawBody, payload;
  try {
    rawBody = await request.text();
    if (rawBody.length > 256000) return json({ ok: false, error: 'Payload too large.' }, 413);
    payload = JSON.parse(rawBody);
  } catch { return json({ ok: false, error: 'Invalid JSON.' }, 400); }

  // Hotmart 2.0 sends the Hottok in the JSON body. Keep header support for
  // compatible senders, but validate either value against the configured secret.
  const supplied = request.headers.get('X-HOTMART-HOTTOK') || String(payload?.hottok || '');
  if (supplied !== env.HOTMART_HOTTOK) return json({ ok: false, error: 'Unauthorized webhook.' }, 401);

  const eventType = String(pick(payload, ['event', 'data.event', 'data.purchase.status']) || 'UNKNOWN').toUpperCase();
  const transactionValue = pick(payload, ['data.purchase.transaction', 'data.purchase.transaction_id', 'data.transaction']);
  const transactionId = transactionValue ? String(transactionValue) : null;
  const email = String(pick(payload, ['data.buyer.email', 'buyer.email']) || '').trim().toLowerCase();
  const productId = String(pick(payload, ['data.product.id', 'product.id']) || '');
  const productName = String(pick(payload, ['data.product.name', 'product.name']) || '');
  // Hotmart's own postback test uses a synthetic product ID (123456) and a
  // product name containing "test postback". A valid Hottok plus this marker
  // identifies a test payload; acknowledge it without creating accounts,
  // licenses, or sending emails.
  const isHotmartTest = /test\s*postback/i.test(productName);
  if (isHotmartTest) return json({ ok: true, test: true, ignored: true, event: eventType });
  if (productId !== String(env.HOTMART_PRODUCT_ID)) return json({ ok: false, error: 'Unexpected or missing product ID.' }, 400);

  const abandoned = ['PURCHASE_OUT_OF_SHOPPING_CART', 'CART_ABANDONED', 'ABANDONED_CART'].includes(eventType);
  const approved = ['PURCHASE_APPROVED', 'PURCHASE_COMPLETE', 'APPROVED', 'COMPLETED'].includes(eventType);
  const revoked = ['PURCHASE_REFUNDED', 'PURCHASE_CHARGEBACK', 'PURCHASE_CANCELED', 'PURCHASE_EXPIRED', 'PURCHASE_PROTEST', 'REFUNDED', 'CHARGEBACK'].includes(eventType);
  if (!abandoned && !approved && !revoked) return json({ ok: true, ignored: true, event: eventType });
  if (!abandoned && (!transactionId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return json({ ok: false, error: 'Missing transaction or valid buyer email.' }, 400);

  const suppliedEventId = pick(payload, ['id', 'data.id', 'event_id']);
  const eventId = suppliedEventId ? String(suppliedEventId) : `body:${await sha256(rawBody)}`;
  try {
    const prior = await env.DB.prepare('SELECT id, processing_status FROM hotmart_webhook_events WHERE event_id = ? LIMIT 1').bind(eventId).first();
    if (prior?.processing_status === 'processed') return json({ ok: true, duplicate: true });
    if (!prior) {
      await env.DB.prepare("INSERT INTO hotmart_webhook_events (id, event_id, transaction_id, event_type, buyer_email, processing_status) VALUES (?, ?, ?, ?, ?, 'received')")
        .bind(crypto.randomUUID(), eventId, transactionId, eventType, email || null).run();
    } else {
      await env.DB.prepare("UPDATE hotmart_webhook_events SET processing_status = 'received', error_message = NULL WHERE event_id = ?").bind(eventId).run();
    }

    if (abandoned) {
      // Registro analítico apenas: não cria conta, não libera licença e não envia marketing.
      await env.DB.prepare("UPDATE hotmart_webhook_events SET processing_status = 'processed', processed_at = CURRENT_TIMESTAMP WHERE event_id = ?").bind(eventId).run();
      return json({ ok: true, processed: true, recorded: 'cart_abandonment' });
    }

    if (approved) {
      const existing = await env.DB.prepare('SELECT id, email_sent_at FROM purchase_access_tokens WHERE transaction_id = ? LIMIT 1').bind(transactionId).first();
      if (!existing?.email_sent_at) {
        const rawToken = randomToken(32), tokenHash = await sha256(rawToken), language = languageFor(payload, env);
        const expiresAt = new Date(Date.now() + 48 * 3600000).toISOString();
        let tokenId = existing?.id;
        if (existing) {
          await env.DB.prepare("UPDATE purchase_access_tokens SET token_hash = ?, buyer_email = ?, language = ?, expires_at = ?, purchase_status = 'approved', used_at = NULL, activation_claimed_at = NULL WHERE id = ?")
            .bind(tokenHash, email, language, expiresAt, existing.id).run();
        } else {
          tokenId = crypto.randomUUID();
          await env.DB.prepare('INSERT INTO purchase_access_tokens (id, transaction_id, buyer_email, language, token_hash, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
            .bind(tokenId, transactionId, email, language, tokenHash, expiresAt).run();
        }
        const base = (env.APP_BASE_URL || 'https://app.startingtoolkit.com').replace(/\/$/, '');
        await sendEmail(env, { to: email, language, type: 'activation', url: `${base}/create-account.html?token=${encodeURIComponent(rawToken)}` });
        await env.DB.prepare('UPDATE purchase_access_tokens SET email_sent_at = CURRENT_TIMESTAMP WHERE id = ?').bind(tokenId).run();
      }
    } else if (revoked) {
      const purchase = await env.DB.prepare('SELECT license_id FROM purchase_access_tokens WHERE transaction_id = ? LIMIT 1').bind(transactionId).first();
      await env.DB.prepare("UPDATE purchase_access_tokens SET purchase_status = 'revoked' WHERE transaction_id = ?").bind(transactionId).run();
      if (purchase?.license_id) {
        await env.DB.prepare("UPDATE licenses SET status = 'revoked' WHERE id = ?").bind(purchase.license_id).run();
        await env.DB.prepare('DELETE FROM sessions WHERE user_id = (SELECT user_id FROM licenses WHERE id = ?)').bind(purchase.license_id).run();
      }
    }
    await env.DB.prepare("UPDATE hotmart_webhook_events SET processing_status = 'processed', processed_at = CURRENT_TIMESTAMP, error_message = NULL WHERE event_id = ?").bind(eventId).run();
    return json({ ok: true, processed: true });
  } catch (error) {
    await env.DB.prepare("UPDATE hotmart_webhook_events SET processing_status = 'error', error_message = ? WHERE event_id = ?")
      .bind(String(error?.message || 'Processing failed').slice(0, 500), eventId).run().catch(() => {});
    return json({ ok: false, error: 'Could not process Hotmart event.' }, 500);
  }
}
