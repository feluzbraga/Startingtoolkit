import { getSession } from './_shared/auth.js';

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/modules/')) return next();

  try {
    const session = await getSession(request, env);
    if (session && session.active) return next();
  } catch (error) {
    // Fail closed: protected pages are not served if session verification fails.
  }

  const loginUrl = new URL('/login.html', url.origin);
  loginUrl.searchParams.set('next', url.pathname + url.search);
  return Response.redirect(loginUrl.toString(), 302);
}
