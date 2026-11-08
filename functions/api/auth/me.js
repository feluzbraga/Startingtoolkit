import { json, getSession } from '../../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const session = await getSession(request, env);
    if (!session) return json({ ok: false, authenticated: false }, 401);
    if (!session.active) return json({ ok: false, authenticated: true, licenseActive: false, error: 'License expired or inactive.' }, 403);
    return json({ ok: true, authenticated: true, user: { id: session.id, email: session.email, language: session.preferred_language }, license: { status: session.license_status, validUntil: session.valid_until }, businessPlanId: session.business_plan_id });
  } catch (error) {
    return json({ ok: false, error: 'Could not verify session.' }, 500);
  }
}
