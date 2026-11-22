// ════════════════════════════════════════════════════════════════════
// Accounts and their spaces — which page a signed-in account belongs to
// ════════════════════════════════════════════════════════════════════
import { isLoyolyEmail } from '../lib/supabase';

// '/loyoly' (team), '/agence' (agency), '/kit' (self-serve brand), or null.
// The metadata only routes: what an account may do is checked by the database.
export function spaceOf(session) {
  const user = session?.user;
  if (!user) return null;
  if (isLoyolyEmail(user.email)) return '/loyoly';
  if (user.user_metadata?.account_type === 'agency') return '/agence';
  if (user.user_metadata?.brand_name) return '/kit';
  return null;
}

// A Supabase Auth or RPC error in the words of a texts object ({ errors }).
export function authErrorText(t, err) {
  const message = err?.message || '';
  const known = Object.keys(t.errors).find(key => message.includes(key));
  return known ? t.errors[known] : (message || t.errors.generic);
}
