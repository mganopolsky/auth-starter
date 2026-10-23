# auth-starter

Template for proof-of-concept apps: **Next.js 16 + TypeScript + Supabase Auth with Google sign-in**.
Click "Use this template" on GitHub to start a new app with auth already wired.

## What's included

- Google sign-in via Supabase (authorization code flow with PKCE)
- Session refresh and route protection in `src/proxy.ts` (Next.js 16's replacement for middleware)
- `/login`, `/auth/callback` (with open-redirect protection), `POST /auth/signout`
- `profiles` table with row-level security and a signup trigger (`supabase/migrations/0001_profiles.sql`)
- `google_drive_connections` table with row-level security (`supabase/migrations/0002_google_drive_connections.sql`) and a test for it (`supabase/tests/google_drive_connections_rls.sql`)
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
   The default template setup assumes testing with localhost; Add your server URL to the list once you get it working with localhost. 
6. **Run it.**
   ```bash
   npm ci
   npm run dev
   ```
   Open http://localhost:3000 and sign in.

## Deploying (e.g. Vercel)

Add the deployed URL to Supabase Redirect URLs (`https://<your-domain>/auth/callback`) and to the
Google client's Authorized JavaScript origins, and set the two env vars on the host.

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
- Google Drive folder picker: tested in Chrome only. Safari and private windows can show "The API
  developer key is invalid." See the note under "Google Drive setup".

## Scripts

`npm run dev` | `build` | `start` | `lint` | `typecheck`


## Google Drive setup

Set up Google Cloud and your local env file for the Drive feature.

> **Browser support: tested in Google Chrome only.** The folder picker is Google's own embedded window. In Safari and in private/incognito windows it can fail with "The API developer key is invalid." Use a normal Chrome window for Drive. Other browsers are a known gap.

Use the same Google Cloud project you used for Google sign-in.

### Part 1: Enable two APIs
1. Open https://console.cloud.google.com and select your project in the project picker (top left - `auth-starter`).
2. Left menu: **APIs & Services -> Library**.
3. Search **Google Drive API**, open it, click **Enable**.
4. Click **Library** again, search **Google Picker API**, open it, click **Enable**.

### Part 2: Create the API key
1. Left menu: **APIs & Services -> Credentials**.
2. Click **+ Create credentials -> API key**.
3. **Name:** `picker-key`.
4. **Application restrictions:** select **Websites**.
5. Under **Website restrictions**, click **Add**.
6. Enter `http://localhost:3000/*` and click **Done**.
7. **API restrictions:** select **Restrict key**.
8. Select **Google Picker API** and **Google Drive API**.
9. Click **Create**.
10. Copy the key.
11. Open `.env.local` and add this line, with the key right after the `=`:
    ```
    NEXT_PUBLIC_GOOGLE_PICKER_API_KEY=
    ```

### Part 3: Create the OAuth client
1. On **APIs & Services -> Credentials**, click **+ Create credentials -> OAuth client ID**.
2. **Application type:** **Web application**.
3. **Name:** `drive-client`.
4. Under **Authorized JavaScript origins**, click **+ Add URI** and enter `http://localhost:3000`.
5. Under **Authorized redirect URIs**, click **+ Add URI** and enter `http://localhost:3000/api/drive/callback`.
6. Click **Create**.
7. Open `.env.local` and add these two lines. Paste the **Client ID** after the first `=` and the **Client secret** after the second:
   ```
   GOOGLE_DRIVE_CLIENT_ID=
   GOOGLE_DRIVE_CLIENT_SECRET=
   ```

### Part 4: Add the Drive scope
1. Left menu: **Google Auth Platform -> Data Access**.
2. Click **Add or remove scopes**.
3. Find `https://www.googleapis.com/auth/drive.readonly` and tick it. (Google calls this a **restricted** scope. It is fine for up to 100 test users. A public app needs Google verification first.)
4. Click **Update**, then **Save**.

### Part 5: Find the project number
1. Left menu: **Cloud overview -> Dashboard**.
2. In the **Project info** card, copy the **Project number**.
3. Open `.env.local` and add this line, with the number right after the `=`:
   ```
   NEXT_PUBLIC_GOOGLE_APP_ID=
   ```

### Part 6: Create the encryption key
1. In your terminal, run:
   ```bash
   openssl rand -base64 32
   ```
2. Copy the output.
3. Open `.env.local` and add this line, with the output right after the `=`:
   ```
   DRIVE_TOKEN_ENCRYPTION_KEY=
   ```
4. Save the file.

## Drive database setup

Do this once for each Supabase project.

### Step 1: Create the table
1. In your project folder, open `supabase/migrations/0002_google_drive_connections.sql`.
2. Select all of the text and copy it.
3. Open https://supabase.com/dashboard and click your project.
4. In the left menu, click **SQL Editor**.
5. Click **New query**.
6. Paste the text.
7. Click **Run**.
8. You should see: **Success. No rows returned**.

### Step 2: Check that it is protected
1. In the left menu, click **Authentication**, then **Users**.
2. Make sure at least two users are listed. If not, sign in to the app with two different Google accounts first.
3. In your project folder, open `supabase/tests/google_drive_connections_rls.sql`.
4. Select all of the text and copy it.
5. In the left menu, click **SQL Editor**, then **New query**.
6. Paste the text.
7. Click **Run**.
8. You should see one row with three numbers: `1`, `0`, `0`.
   The column names are `rows_visible_to_a`, `b_rows_visible_to_a`, `b_rows_updated_by_a`.
9. If you see any other numbers, stop. The table is not protected. Do not continue.

The test leaves no data behind.
