# Cloud sync authorization rollout

This plan applies to `202610230001_cloud_sync_authorization.sql`. The migration
has not been applied to production.

## Before production

1. Export a database backup and confirm point-in-time recovery is available.
2. Apply the migration to an isolated or staging Supabase project.
3. Run `tests/sql/cloud-sync-authorization.sql` against staging.
4. Verify two test accounts cannot read or write each other's workspaces.
5. Delete one test account's cloud data and verify an already-open second
   browser cannot insert or update a workspace until Resume sync is chosen.
   Also verify a legacy client's direct table deletion activates the same
   account-wide pause.
6. Verify Resume sync uploads the local workspace and reads it back before the
   UI reports success.
7. Verify both conflict choices download the copy being replaced and preserve
   transaction, payment, and balance-correction IDs.

## Safe production order

1. Put the application deployment on hold; existing clients remain compatible.
2. Apply the additive database migration. Existing users and workspace rows are
   preserved and receive an enabled sync-control row.
3. Run read-only checks for control-row coverage and orphaned workspaces.
4. Run the SQL security test with dedicated synthetic production test accounts
   only, then remove those accounts.
5. Deploy the application commit that uses the new RPCs.
6. Smoke-test deletion, local edits while paused, deliberate resume, conflict
   recovery, sign-out, and sign-in with synthetic data.

## Rollback

1. Roll back the application first to the last release that does not call the
   new RPCs.
2. Keep `cloud_sync_controls` and its restrictive write protection in place
   during investigation; this is the safer degraded state because deleted data
   cannot be recreated.
3. If the database objects themselves must be removed, first export
   `cloud_sync_controls` and `financial_workspaces`, then drop the recovery RPC,
   resume/delete/status RPCs, authorization trigger and restrictive policy, the
   signup trigger/helper, and finally `cloud_sync_controls`.
4. Restoring deleted workspace rows is intentionally not automatic. Use only a
   verified user backup or point-in-time database recovery with the user's
   explicit direction.

The migration is additive and does not rewrite financial JSON. Its deletion RPC
does intentionally remove that signed-in user's cloud workspace after explicit
confirmation, while leaving local IndexedDB data unchanged.
