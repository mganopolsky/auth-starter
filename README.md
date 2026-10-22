# auth-starter

Template for proof-of-concept apps: **Next.js 16 + TypeScript + Supabase Auth with Google sign-in**.
Click "Use this template" on GitHub to start a new app with auth already wired.

## What's included

- Google sign-in via Supabase (authorization code flow with PKCE)
- Session refresh and route protection in `src/proxy.ts` (Next.js 16's replacement for middleware)
- `/login`, `/auth/callback` (with open-redirect protection), `POST /auth/signout`
- `profiles` table with row-level security and a signup trigger (`supabase/migrations/0001_profiles.sql`)
- CI: lint, typecheck, build on Node 24

## Requirements

- Node 24 (`.nvmrc`)
- A free [Supabase](https://supabase.com) account (free plan: 2 active projects, pauses after 1 week of inactivity)
- A Google Cloud project

## Setup for each new app

1. **Supabase project.** Create a new project. Run `supabase/migrations/0001_profiles.sql` in the SQL Editor.
2. **Env file.** `cp .env.example .env.local`, then fill in the project URL and the **publishable** key
   (Project Settings -> API Keys). Never use or commit the secret key.
3. **Google OAuth client.** In Google Cloud -> Google Auth Platform: configure the consent screen
   (External), then create a **Web application** client with:
   - Authorized JavaScript origin: `http://localhost:3000`
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
4. **Enable the provider.** Supabase -> Authentication -> Sign In / Providers -> Google: paste the
   Client ID and secret.
5. **Redirect URLs.** Supabase -> Authentication -> URL Configuration: Site URL `http://localhost:3000`,
   add Redirect URL `http://localhost:3000/auth/callback`.
6. **Run it.**
   ```bash
   npm ci
   npm run dev
   ```
   Open http://localhost:3000 and sign in.

## Deploying (e.g. Vercel)

Add the deployed URL to Supabase Redirect URLs (`https://<your-domain>/auth/callback`) and to the
Google client's Authorized JavaScript origins, and set the two env vars on the host.
Vercel's free Hobby plan is for non-commercial use only.

## Scopes and verification

Only `openid`, `email`, `profile` are requested, which need no Google app verification.
Publish the consent screen to "In production" so anyone can sign in (in "Testing" it is capped at 100 users).

## Rules for apps built from this template

- Authorize on the server (RLS or server-side session checks). Hiding UI is not access control.
- Every table that references `auth.users(id)` needs RLS and `on delete cascade`, so deleting a user deletes their data.
- Apps holding sensitive data get their own Supabase project.

## Known issues

- `npm audit` reports high-severity advisories in the dev-only lint chain (`eslint-config-next` ->
  `braces`). Production dependencies report 0.
- ESLint 9 is flagged as no longer supported; upgrade tracked for a follow-up.

## Scripts

`npm run dev` | `build` | `start` | `lint` | `typecheck`
