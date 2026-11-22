// Shared by the /api functions (the leading underscore keeps Vercel from
// exposing this file as an endpoint).
//
// The front sends the Supabase session as `Authorization: Bearer <token>`.
// We ask Supabase Auth who the token belongs to and only let the Loyoly
// team (@loyoly.io, Google sign-in) through. Returns the user, or null after having answered 401/403.

const ALLOWED_DOMAIN = 'loyoly.io';

// The Loyoly team: a @loyoly.io account signed in with Google (same rule as
// public.is_loyoly() and isTeamUser in src/lib/supabase.js). A @loyoly.io
// address signed up with a password is an agency or brand account.
export function isTeamUser(user) {
  if (!user?.email?.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)) return false;
  const app = user.app_metadata || {};
  return app.provider === 'google' || (Array.isArray(app.providers) && app.providers.includes('google'));
}

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
    if (!isTeamUser(user)) {
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

// The site analysis also serves the partner agencies (/agency: approved,
// thirty per agency, agency_consume_analysis) and the self-serve brands
// (/kit): a signed-in account with a confirmed email, within its quota
// (brand_consume_analysis, five per account). Returns the user, or null
// after having answered.
export async function requireAnalysisUser(req, res) {
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
    const headers = { apikey: supabaseKey, Authorization: `Bearer ${token}` };
    const resp = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
    if (!resp.ok) {
      res.status(401).json({ error: 'Invalid or expired session', code: 'UNAUTHENTICATED' });
      return null;
    }
    const user = await resp.json();
    if (isTeamUser(user)) return user;
    if (!user?.email_confirmed_at) {
      res.status(403).json({ error: 'Email not confirmed', code: 'EMAIL_NOT_CONFIRMED' });
      return null;
    }
    const rpc = name => fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}',
    });
    // An agency member: its agency's quota (null when the caller is none).
    const agencyResp = await rpc('agency_consume_analysis');
    const agency = agencyResp.ok ? await agencyResp.json() : null;
    if (agency === 'ok') return user;
    if (agency === 'not_approved') {
      res.status(403).json({ error: 'Agency not approved yet', code: 'AGENCY_NOT_APPROVED' });
      return null;
    }
    if (agency === 'quota') {
      res.status(429).json({ error: 'Analysis limit reached for this agency', code: 'QUOTA' });
      return null;
    }
    const quota = await fetch(`${supabaseUrl}/rest/v1/rpc/brand_consume_analysis`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}',
    });
    if (!quota.ok) {
      res.status(403).json({ error: 'Brand account unavailable', code: 'FORBIDDEN' });
      return null;
    }
    if ((await quota.json()) !== true) {
      res.status(429).json({ error: 'Analysis limit reached for this account', code: 'QUOTA' });
      return null;
    }
    return user;
  } catch (err) {
    console.error('Auth check failed:', err);
    res.status(503).json({ error: 'Could not verify session', code: 'AUTH_UNAVAILABLE' });
    return null;
  }
}
