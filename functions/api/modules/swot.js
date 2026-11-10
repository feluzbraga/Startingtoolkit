import { json, getSession } from '../../_shared/auth.js';

const MODULE_KEY = 'swot';

export async function onRequestGet({ request, env }) {
  try {
    const session = await getSession(request, env);
    if (!session) return json({ ok: false, error: 'Authentication required.' }, 401);
    if (!session.active || !session.business_plan_id) return json({ ok: false, error: 'Active license and business plan required.' }, 403);
    const row = await env.DB.prepare(
      'SELECT data_json, updated_at FROM module_data WHERE business_plan_id = ? AND module_key = ?'
    ).bind(session.business_plan_id, MODULE_KEY).first();
    return json({ ok: true, data: row ? JSON.parse(row.data_json) : null, updatedAt: row?.updated_at || null });
  } catch (error) {
    return json({ ok: false, error: 'Could not load module data.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    const session = await getSession(request, env);
    if (!session) return json({ ok: false, error: 'Authentication required.' }, 401);
    if (!session.active || !session.business_plan_id) return json({ ok: false, error: 'Active license and business plan required.' }, 403);
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > 60000) return json({ ok: false, error: 'Module data is too large.' }, 413);
    const body = await request.json();
    if (!body || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return json({ ok: false, error: 'Invalid module data.' }, 400);
    const serialized = JSON.stringify(body.data);
    if (serialized.length > 50000) return json({ ok: false, error: 'Module data is too large.' }, 413);
    await env.DB.prepare(`
      INSERT INTO module_data (id, business_plan_id, module_key, data_json, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(business_plan_id, module_key)
      DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP
    `).bind(crypto.randomUUID(), session.business_plan_id, MODULE_KEY, serialized).run();
    return json({ ok: true, saved: true, updatedAt: new Date().toISOString() });
  } catch (error) {
    return json({ ok: false, error: 'Could not save module data.' }, 500);
  }
}
