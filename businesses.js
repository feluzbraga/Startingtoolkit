import { json, getSession, cookieValue, sha256 } from '../../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const session = await getSession(request, env);
    if (!session) return json({ ok: false, error: 'Authentication required.' }, 401);
    if (!session.active) return json({ ok: false, error: 'An active license is required.' }, 403);
    const rows = await env.DB.prepare(`
      SELECT bp.id AS business_plan_id, bp.business_name, bp.language,
             l.id AS license_id, l.status, l.valid_from, l.valid_until,
             CASE WHEN l.status = 'active' AND l.valid_from <= ? AND l.valid_until > ? THEN 1 ELSE 0 END AS is_active,
             CASE WHEN bp.id = ? THEN 1 ELSE 0 END AS is_selected
      FROM business_plans bp
      JOIN licenses l ON l.id = bp.license_id
      WHERE l.user_id = ?
      ORDER BY l.created_at DESC
    `).bind(new Date().toISOString(), new Date().toISOString(), session.business_plan_id, session.id).all();
    return json({ ok: true, businesses: rows.results || [] });
  } catch (error) {
    return json({ ok: false, error: 'Could not list businesses.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const session = await getSession(request, env);
    if (!session) return json({ ok: false, error: 'Authentication required.' }, 401);
    if (!session.active) return json({ ok: false, error: 'An active license is required.' }, 403);
    const body = await request.json();
    const businessPlanId = String(body.businessPlanId || '').trim();
    if (!businessPlanId) return json({ ok: false, error: 'Business selection is required.' }, 400);

    const owned = await env.DB.prepare(`
      SELECT bp.id AS business_plan_id, bp.business_name, bp.language,
             l.id AS license_id, l.status, l.valid_from, l.valid_until
      FROM business_plans bp
      JOIN licenses l ON l.id = bp.license_id
      WHERE bp.id = ? AND l.user_id = ?
      LIMIT 1
    `).bind(businessPlanId, session.id).first();
    if (!owned) return json({ ok: false, error: 'Business not found for this account.' }, 404);
    if (owned.status !== 'active' || !owned.valid_from || new Date(owned.valid_from).getTime() > Date.now() || !owned.valid_until || new Date(owned.valid_until).getTime() <= Date.now()) {
      return json({ ok: false, error: 'This business license is not active.' }, 403);
    }

    const token = cookieValue(request, 'stk_session');
    if (!token) return json({ ok: false, error: 'Authentication required.' }, 401);
    const tokenHash = await sha256(token);
    await env.DB.prepare(`UPDATE sessions SET active_business_plan_id = ?, last_used_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`)
      .bind(owned.business_plan_id, session.session_id, session.id).run();
    return json({ ok: true, business: { id: owned.business_plan_id, name: owned.business_name || '', language: owned.language } });
  } catch (error) {
    return json({ ok: false, error: 'Could not switch business.' }, 500);
  }
}
