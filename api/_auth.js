// Shared by the /api functions (the leading underscore keeps Vercel from
// exposing this file as an endpoint).
//
// The front sends the Supabase session as `Authorization: Bearer <token>`.
// We ask Supabase Auth who the token belongs to and only let @loyoly.io
// accounts through. Returns the user, or null after having answered 401/403.

const ALLOWED_DOMAIN = 'loyoly.io';

export async function requireLoyolyUser(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    res.status(503).json({ error: 'Supabase not configured', code: 'NO_SUPABASE' });
    return null;
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required', code: 'UNAUTHENTICATED' });
    return null;
  }

  try {
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      res.status(401).json({ error: 'Invalid or expired session', code: 'UNAUTHENTICATED' });
      return null;
    }
    const user = await resp.json();
    if (!user?.email?.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) {
      res.status(403).json({ error: `Access restricted to @${ALLOWED_DOMAIN} accounts`, code: 'FORBIDDEN' });
      return null;
    }
    return user;
  } catch (err) {
    console.error('Auth check failed:', err);
    res.status(503).json({ error: 'Could not verify session', code: 'AUTH_UNAVAILABLE' });
    return null;
  }
}
