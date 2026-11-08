const COOKIE_NAME = 'stk_session';
const SESSION_DAYS = 7;
const PBKDF2_ITERATIONS = 310000;

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders }
  });
}

function cookieValue(request, name) {
  const cookie = request.headers.get('Cookie') || '';
  const part = cookie.split(';').map(v => v.trim()).find(v => v.startsWith(name + '='));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : null;
}

function cookieHeader(value, maxAge) {
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(data, b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password, saltHex = randomToken(16)) {
  const salt = Uint8Array.from(saltHex.match(/.{2}/g), x => parseInt(x, 16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' }, key, 256);
  const hash = Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2$${PBKDF2_ITERATIONS}$${saltHex}$${hash}`;
}

async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, expected] = String(stored || '').split('$');
  if (scheme !== 'pbkdf2' || !iterations || !salt || !expected) return false;
  const actual = await hashPassword(password, salt);
  return constantTimeEqual(actual.split('$')[3], expected);
}

function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readJson(request) {
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 10000) throw new Error('Request too large');
  return await request.json();
}

async function createSession(db, userId) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await db.prepare('INSERT INTO sessions (id, user_id, token_hash, expires_at, last_used_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)')
    .bind(crypto.randomUUID(), userId, tokenHash, expires).run();
  return token;
}

async function getSession(request, env) {
  const token = cookieValue(request, COOKIE_NAME);
  if (!token || !env.DB) return null;
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(`
    SELECT u.id, u.email, u.preferred_language,
           l.id AS license_id, l.status AS license_status, l.valid_until,
           bp.id AS business_plan_id
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN licenses l ON l.user_id = u.id
    LEFT JOIN business_plans bp ON bp.license_id = l.id
    WHERE s.token_hash = ? AND s.expires_at > ?
    ORDER BY l.created_at DESC LIMIT 1
  `).bind(tokenHash, new Date().toISOString()).first();
  if (!row) return null;
  const active = row.license_status === 'active' && row.valid_until && new Date(row.valid_until).getTime() > Date.now();
  if (!active) return { ...row, active: false };
  await env.DB.prepare('UPDATE sessions SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = ?').bind(tokenHash).run();
  return { ...row, active: true };
}

export { COOKIE_NAME, SESSION_DAYS, json, cookieHeader, cookieValue, randomToken, sha256, hashPassword, verifyPassword, readJson, createSession, getSession };
