import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const ALLOWED_DOMAIN = 'loyoly.io';

// null when the env vars are missing — App shows a configuration notice.
export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

export function isLoyolyEmail(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

// fetch() for our /api functions: forwards the Supabase session so the
// serverless side can check the caller is a signed-in @loyoly.io account.
export async function apiFetch(path, options = {}) {
  const { data } = supabase ? await supabase.auth.getSession() : { data: {} };
  const token = data?.session?.access_token;
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(path, { ...options, headers });
}
