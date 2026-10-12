# Supabase authentication and cloud workspace setup

moni2go supports optional accounts and user-controlled cloud workspace backup
through Supabase. The application continues to work in local-only and demo mode
when Supabase is not configured.

## Create the free project

1. Create a free project at [supabase.com](https://supabase.com/).
2. Open the SQL Editor and run
   `supabase/migrations/202610010001_initial_auth_and_workspaces.sql`.
3. In **Authentication → URL Configuration**, set the production Site URL and
   add these redirect URLs:
   - `http://localhost:3000/auth/callback`
   - `https://YOUR-PRODUCTION-DOMAIN/auth/callback`
4. In the project Connect dialog, copy the Project URL and **publishable key**.

## Configure locally

Copy `.env.example` to `.env.local` and replace the example values:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

Never commit `.env.local`. Do not place the Supabase secret/service-role key in
the browser application.

## Configure Vercel

Add the same two variables in Vercel project settings for Preview and
Production. Redeploy after saving them.

## Security model

- Supabase Auth owns passwords and sessions; moni2go never stores passwords.
- PostgreSQL Row Level Security restricts profiles and workspaces to
  `auth.uid() = owner_id`.
- Anonymous visitors receive no table grants.
- The publishable key is intended for browser use; access is controlled by the
  signed-in session and RLS.
- Cloud transfer is explicit. Signing in does not silently upload browser-local
  financial information.
- Demo profiles remain synthetic and are never written into a personal cloud
  workspace.

## Verification

1. Create an account and confirm the email if email confirmation is enabled.
2. Sign in and add a distinctive local account value.
3. In Settings, choose **Save this device to cloud**.
4. In a separate browser profile, sign in and choose **Restore from cloud**.
5. Confirm a second Supabase user cannot read the first user's profile or
   workspace using the RLS policy tests or SQL impersonation tools.
6. Sign out and confirm local data remains on that device while cloud actions
   are unavailable.
