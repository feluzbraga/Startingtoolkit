import { json, getSession } from '../../_shared/auth.js';

export async function onRequestGet({ request, env }) {
  try {
    const session = await getSession(request, env);
    if (!session) return json({ ok: false, authenticated: false }, 401);
    if (!session.active) return json({ ok: false, authenticated: true, licenseActive: false, error: 'License expired or inactive.' }, 403);
    return json({
      ok: true,
      authenticated: true,
      user: { id: session.id, email: session.email, language: session.preferred_language },
      license: { id: session.license_id, status: session.license_status, validFrom: session.valid_from, validUntil: session.valid_until, maxBusinesses: session.max_businesses },
      business: { id: session.business_plan_id, name: session.business_name || '', language: session.business_language || session.preferred_language }
    });
  } catch (error) {
    return json({ ok: false, error: 'Could not verify session.' }, 500);
  }
}
