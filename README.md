# Loyoly Setup

Internal tool for Loyoly CSMs: design a brand's loyalty program (points, VIP tiers,
missions, rewards, referral) from its customer export and estimate its economics.

- **Front**: React 19 + Vite + Tailwind 4 (`src/`)
- **API**: Vercel serverless functions (`api/`) — HubSpot clients, brand analysis (Claude), Fireflies
- **Auth**: Google sign-in restricted to `@loyoly.io`, exchanged for a Supabase session
- **Data**: every program is saved to Supabase (`vip_programs`) as you edit, shared by the whole team

## Points model

Points are never stored, only derived (`src/utils/pointsModel.js`):

- `settings.earnRate` — points per € spent (1, 5 or 10; follows the AOV rule — ≥ 50€ → 1, below → 10 — until chosen)
- `settings.cashbackRate` — % of spend given back; points value = earn rate × 100 ÷ cashback (pts for 1€)
- missions store `basePoints` (1 pt/€ grid), points rewards store `pointsValueEur`, tiers store € / order thresholds

Saved programs carry a format version; `migrateProgramState` (`src/utils/programStore.js`) upgrades older ones without changing their figures.

## Setup sheet

The Dashboard exports the program structure — points ratio, missions, points rewards, referral,
VIP tiers and their perks — for Claude Cowork to configure it in Loyoly
(`src/utils/setupSheet.js`): **Exporter la fiche de setup (PDF)** prints it through the browser
(text stays selectable), **Copier pour Claude** copies the same content as Markdown.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # front only (no /api)
npm run dev:full             # front + /api through `vercel dev`
npm test                     # unit tests (points model, calculations, migrations)
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
