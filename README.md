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
- missions store `basePoints` and points rewards their price `pointsBase`, both on the 1 pt/€ grid (displayed = base × earn rate); tiers store € / order thresholds

Saved programs carry a format version; `migrateProgramState` (`src/utils/programStore.js`) upgrades older ones without changing their figures.

## Setup sheet

The Dashboard exports the program structure — points ratio, missions, points rewards, referral,
VIP tiers and their perks — for Claude Cowork to configure it in Loyoly
(`src/utils/setupSheet.js`): **Exporter la fiche de setup (PDF)** prints it through the browser
(text stays selectable), **Copier pour Claude** copies the same content as Markdown.

## Client space

The home page lists one folder per client (`src/utils/clientFolders.js`): programs of a
HubSpot company are grouped by company, the others by analyzed brand (domain, else name).
A folder holds several named programs — create, open, rename, duplicate, delete. **Nouveau
client** opens the HubSpot client selection: a client that already has a folder opens it,
otherwise its first program starts.

## Client portal

From a client folder, the CSM generates an access link (`/client/XXXX-XXXX-XXXX`) and
publishes programs from the wizard (**Publier pour le client**). The client — no Google
account — sees the published version only: Missions, Récompenses, Parrainage and Paliers
VIP (the setup sheet content, `src/utils/clientView.js`), comments each page or one of its
items, edits or deletes their own comments and approves pages. CSMs answer and resolve from
the matching wizard steps (**Commentaires client**).

Clients never read the tables: the `client_*` SQL functions check the access code on every
call and return only what was published. Codes can be regenerated or revoked from the folder.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # front only (no /api)
npm run dev:full             # front + /api through `vercel dev`
npm test                     # unit tests (points model, calculations, migrations)
```

## Supabase setup

1. Run the files of `supabase/migrations/` in the SQL editor, in order:
   `20261018000000_vip_programs.sql` (the `vip_programs` table, its trigger and the
   `@loyoly.io` access rules), `20261019000000_program_folders.sql` (several named
   programs per client), then `20261020000000_client_portal.sql` (client portal:
   access codes, publication, comments, approvals).
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
