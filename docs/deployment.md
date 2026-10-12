# moni2go deployment guide

This guide prepares moni2go for a first production deployment on Vercel. It
does not record a completed deployment. Every item in the post-deployment
section must be checked against the real production URL after deployment.

## Prerequisites

- A GitHub account and repository for the project.
- A Vercel account with access to that repository.
- A current Node.js version supported by the pinned Next.js release.
- npm and the committed `package-lock.json`.
- A clean fresh clone with no generated `.next`, `test-results`, or local
  environment files committed.

Validate a fresh clone before publishing:

```bash
npm ci
npm run check
npm run test:e2e
npm audit --audit-level=low
```

## GitHub setup

1. Create an empty GitHub repository without generated starter files.
2. Confirm the repository contains no `.env` files, credentials, test output,
   screenshots with personal information, or `.vercel` project metadata.
3. Commit the source, documentation, `package.json`, and `package-lock.json`.
4. Push the intended production branch to GitHub.
5. Enable branch protection or required checks if appropriate for the account.
6. Review the rendered README and verify all relative documentation links.

moni2go local/demo mode requires no secrets. Authentication and cloud backup
require the two public Supabase configuration variables documented below.

## Recommended Vercel deployment procedure

1. In Vercel, choose **Add New Project** and import the GitHub repository.
2. Let Vercel detect the **Next.js** framework preset.
3. Keep the repository root as the project root.
4. Use the default dependency installation based on the lockfile. For strict
   reproducibility, configure the install command as `npm ci`.
5. Set the build command to `npm run build`.
6. Leave the output directory on the Next.js framework default; do not set a
   custom static-export directory.
7. Add the Supabase URL and publishable key only when cloud accounts are enabled.
   Never add the secret/service-role key to this application.
8. Deploy a preview first and complete the checklist below.
9. Promote the verified commit to production.
10. After the final production domain is known, add domain-dependent metadata
    as described below and deploy that metadata change.

Do not commit the generated `.vercel/` directory. It may contain local project
linkage identifiers and is ignored by the repository.

## Build command

```bash
npm run build
```

Vercel should detect Next.js automatically. No custom output mode, adapter,
serverless function configuration, or database migration is required.

## Expected output

A successful build compiles TypeScript and reports these application routes:

```text
○ /
○ /_not-found
○ /accounts
○ /build
ƒ /explore
○ /methodology
○ /plan
○ /privacy
ƒ /scenario
○ /settings
```

Static routes are prerendered. `/explore` and `/scenario` are dynamically
rendered because they validate query parameters; they do not persist or process
personal financial inputs on the server. Browser-local baseline restoration
happens after the client loads.

## Environment variables

Local/demo mode requires none. Cloud accounts require:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

See `docs/supabase-setup.md`. Neither value is a service-role secret; access to
financial rows is enforced by authenticated sessions and Row Level Security.

The application contains no runtime reads from `process.env` for product
behavior. `PLAYWRIGHT_BASE_URL` is test-runner configuration only and is not a
Vercel application variable. It can point Playwright at an already-running
preview or local production server.

Do not create placeholder secrets. A future feature that genuinely needs an
environment variable must document its purpose and privacy boundary before it
is added.

## Domain-dependent metadata

The repository intentionally does not invent a canonical domain. After the
final production domain is assigned, review and add as appropriate:

- `metadataBase`
- A canonical URL
- Absolute Open Graph page URL
- `robots.txt` and sitemap host values, if those files are added
- Any production social-preview image URL, but only after a real asset exists

The current title, description, locale, robots indexing directives, and
text-only Open Graph metadata do not require a production domain.

## Post-deployment verification checklist

Do not mark these items complete until they have been tested against the actual
production deployment.

- [ ] **HTTPS:** the production URL redirects to and remains on HTTPS with no
      mixed-content warnings.
- [ ] **`/`:** landing content, primary actions, navigation, footer, title, and
      skip link load correctly.
- [ ] **`/accounts`:** manually add an asset and liability, refresh, and confirm
      exact balances and derived totals persist locally.
- [ ] **`/plan`:** the working what-if entry opens without showing unavailable
      planning features.
- [ ] **`/settings`:** privacy, methodology, and local scenario-data links work.
- [ ] **`/explore`:** all four synthetic profiles render and one can be selected.
- [ ] **`/build`:** the five-field form validates, accepts decimals, and submits.
- [ ] **`/scenario`:** the missing-baseline state is friendly; demo and custom
      baseline query flows load after direct navigation and refresh.
- [ ] **`/methodology`:** metric anchors and “How calculated?” links work.
- [ ] **`/privacy`:** local-data status and clearing control work.
- [ ] **404 behavior:** an unknown URL returns HTTP 404 and renders the branded
      page with working Home and Explore links.
- [ ] **Local-storage persistence:** save a distinctive custom baseline, refresh,
      close/reopen the tab, and confirm it remains in that browser origin.
- [ ] **Local-storage deletion:** clear the saved baseline and confirm a refresh
      does not restore it.
- [ ] **Demo scenario:** run the audited renter housing scenario and confirm the
      documented `$850 → $1,050` results.
- [ ] **Custom scenario:** enter a custom baseline, run a scenario, refresh, and
      confirm the scenario resets while the baseline persists.
- [ ] **Mobile check:** inspect at least one physical or hosted-device mobile
      browser for navigation, form input, focus, disclosures, and table scrolling.
- [ ] **Console check:** complete primary flows with zero unexplained application
      errors or warnings.
- [ ] **Network financial-value leakage:** use a distinctive value such as
      `$12,345.67` and verify it does not appear in request URLs, bodies, logs, or
      error-reporting traffic.
- [ ] **Metadata/title:** inspect page titles, descriptions, Open Graph fields,
      indexing directives, and sharing behavior.
- [ ] **Canonical URL:** after the final production domain is known, configure and
      verify `metadataBase`, canonical URL, and absolute Open Graph URL without
      inventing or retaining a preview-domain canonical.

Also complete the manual checks in `docs/release-checklist.md`, especially real
screen-reader, browser-matrix, zoom, and physical-device verification.

## Rollback procedure

1. In Vercel, open the project’s **Deployments** list.
2. Identify the last deployment that passed the post-deployment checklist.
3. Use Vercel’s rollback/promote action to restore that deployment, or revert the
   faulty commit in Git and deploy the revert.
4. Confirm the production alias points to the restored deployment.
5. Re-run HTTPS, route, 404, console, local-storage, and leakage smoke checks.
6. Record the failed commit, observed symptom, and rollback deployment in the
   repository issue or release notes.

Browser-local baselines are scoped to the production origin and are not part of
the deployment artifact. Rolling back application code should not delete them,
but any storage-schema change must retain the existing migration/reset contract.
