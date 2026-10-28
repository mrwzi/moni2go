# moni2go architecture

moni2go separates financial rules from presentation and persistence. The UI
must call domain functions instead of recreating calculations inside React
components.

## Main boundaries

- `src/domain/` contains the frozen V1 monthly-baseline and scenario engine.
- `src/v2/domain/` contains framework-independent money, account, budget,
  calendar, recurrence, and workspace contracts.
- `src/v2/storage/` owns validated IndexedDB persistence, migration, and local
  export/import behavior.
- `src/v2/react/` adapts the local repository for React components.
- `src/components/` contains browser-facing workflows grouped by feature.
- `src/app/` contains Next.js routes and route-level composition.
- `tests/unit/`, `tests/components/`, and `tests/e2e/` verify the corresponding
  boundaries.

The domain layer never imports React, Next.js, browser storage, or Supabase.
Personal financial values reach Supabase only for an authenticated user with
cloud synchronization enabled. Local writes complete first; version-aware
cloud writes then run after saves, reconnection, app resume, and periodic
background checks. A conflict preserves the local copy instead of silently
overwriting either revision.

## Money and dates

- Monetary truth is stored as integer CAD cents.
- Formatting belongs at the UI boundary.
- Calendar dates use validated `YYYY-MM-DD` values and domain calendar helpers.
- Financial date arithmetic must not use implicit JavaScript date parsing.

## Account feature

`src/components/accounts/` is split by responsibility:

- `AccountsManager.tsx` coordinates workspace changes and the account editor.
- `AccountRows.tsx` renders asset and liability rows.
- `QuickActivityDialog.tsx` owns the money-in and money-out form.
- `account-options.ts` contains user-facing labels and stable input choices.

All balance changes use `applyAssetAccountActivity` from the V2 domain. The UI
does not calculate balances independently.

## Planning feature

The planning UI creates editable category envelopes. It does not move money at
a bank. Suggested paycheque splits use the user's saved category proportions,
required debt information, and deterministic integer-cent rounding.

## Persistence sources

- IndexedDB is the authoritative on-device V2 workspace store.
- The original local-storage baseline remains for V1 compatibility.
- Supabase authentication and version-aware workspace synchronization are
  optional.
- Demo profiles are synthetic and remain distinct from user-entered data.

## Change checklist

Before merging a change:

1. Keep formulas and validation in the domain layer.
2. Add or update the closest unit/component/browser test.
3. Run `npm run typecheck`, `npm run lint`, `npm test`, and
   `npm run format:check`.
4. Run `npm run build` for route, bundling, and production validation.
5. Run the relevant Playwright flow for user-facing changes.
