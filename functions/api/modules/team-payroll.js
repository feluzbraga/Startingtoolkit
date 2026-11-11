import { json, getSession } from '../../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const session = await getSession(request, env);
    if (!session) return json({ ok: false, error: 'Authentication required.' }, 401);
    if (!session.active || !session.business_plan_id) return json({ ok: false, error: 'Active license and business plan required.' }, 403);
    const row = await env.DB.prepare('SELECT data_json, updated_at FROM team_payroll_data WHERE business_plan_id = ?').bind(session.business_plan_id).first();
    return json({ ok: true, data: row ? JSON.parse(row.data_json) : null, updatedAt: row?.updated_at || null });
  } catch (error) { return json({ ok: false, error: 'Could not load team and payroll data.' }, 500); }
}

export async function onRequestPost({ request, env }) {
  try {
    const session = await getSession(request, env);
    if (!session) return json({ ok: false, error: 'Authentication required.' }, 401);
    if (!session.active || !session.business_plan_id) return json({ ok: false, error: 'Active license and business plan required.' }, 403);
    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > 100000) return json({ ok: false, error: 'Module data is too large.' }, 413);
    const body = await request.json();
    if (!body || typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) return json({ ok: false, error: 'Invalid module data.' }, 400);
    const serialized = JSON.stringify(body.data);
    if (serialized.length > 100000) return json({ ok: false, error: 'Module data is too large.' }, 413);
    await env.DB.prepare(`INSERT INTO team_payroll_data (business_plan_id, data_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(business_plan_id) DO UPDATE SET data_json = excluded.data_json, updated_at = CURRENT_TIMESTAMP`).bind(session.business_plan_id, serialized).run();
    return json({ ok: true, saved: true, updatedAt: new Date().toISOString() });
  } catch (error) { return json({ ok: false, error: 'Could not save team and payroll data.' }, 500); }
}
