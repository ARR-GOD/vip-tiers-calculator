# VIP Tiers Calculator — Loyoly

Internal tool for Loyoly CSMs: design a brand's loyalty program (points, VIP tiers,
missions, rewards, referral) from its customer export and estimate its economics.

- **Front**: React 19 + Vite + Tailwind 4 (`src/`)
- **API**: Vercel serverless functions (`api/`) — HubSpot clients, brand analysis (Claude), Fireflies
- **Auth**: Google sign-in restricted to `@loyoly.io`, exchanged for a Supabase session
- **Data**: every program is saved to Supabase (`vip_programs`) as you edit, shared by the whole team

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # front only (no /api)
npm run dev:full             # front + /api through `vercel dev`
```

## Supabase setup

1. Run `supabase/migrations/20261018000000_vip_programs.sql` in the SQL editor
   (creates the `vip_programs` table, its trigger and the `@loyoly.io` access rules).
2. **Authentication → Sign In / Providers → Google**: enable it and add the Google
   OAuth Web client ID (the same as `VITE_GOOGLE_CLIENT_ID`) to the authorized client IDs.
3. Keep **Confirm email** enabled so nobody can claim an `@loyoly.io` address without owning it.

## Google OAuth client

In Google Cloud Console → Credentials → the Web client: add every origin the app is
served from to **Authorized JavaScript origins** (`http://localhost:5173`, the Vercel
production domain, preview domains if needed).

## Deployment (Vercel)

Set the variables of `.env.example` in the Vercel project (Production + Preview).
`VITE_*` values are baked into the front at build time: redeploy after changing them.
