\set ON_ERROR_STOP on

begin;

insert into auth.users (id, instance_id, aud, role, email)
values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'sync-one@example.test'),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'sync-two@example.test');

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-1111-1111-111111111111',
  true
);

insert into public.financial_workspaces (
  workspace_id, owner_id, schema_version, workspace, updated_at
) values (
  'workspace-one',
  '11111111-1111-1111-1111-111111111111',
  2,
  '{"id":"workspace-one","schemaVersion":2}'::jsonb,
  '2026-10-23T12:00:00Z'
);

do $$
begin
  if (select count(*) from public.financial_workspaces) <> 1 then
    raise exception 'owner should see exactly one workspace';
  end if;
end;
$$;

select public.delete_cloud_financial_workspaces();

do $$
declare
  state record;
begin
  select * into state from public.get_cloud_sync_control();
  if state.sync_enabled or state.deleted_at is null then
    raise exception 'cloud deletion did not disable account-wide sync';
  end if;

  begin
    insert into public.financial_workspaces (
      workspace_id, owner_id, schema_version, workspace
    ) values (
      'stale-second-device',
      '11111111-1111-1111-1111-111111111111',
      2,
      '{"id":"stale-second-device","schemaVersion":2}'::jsonb
    );
    raise exception 'stale device write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-2222-2222-222222222222',
  true
);

do $$
begin
  begin
    insert into public.financial_workspaces (
      workspace_id, owner_id, schema_version, workspace
    ) values (
      'cross-account-write',
      '11111111-1111-1111-1111-111111111111',
      2,
      '{"id":"cross-account-write","schemaVersion":2}'::jsonb
    );
    raise exception 'cross-account write unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

insert into public.financial_workspaces (
  workspace_id, owner_id, schema_version, workspace
) values (
  'workspace-two',
  '22222222-2222-2222-2222-222222222222',
  2,
  '{"id":"workspace-two","schemaVersion":2}'::jsonb
);

do $$
begin
  if (select count(*) from public.financial_workspaces) <> 1 then
    raise exception 'account isolation failed';
  end if;
end;
$$;

delete from public.financial_workspaces where workspace_id = 'workspace-two';

do $$
declare
  state record;
begin
  select * into state from public.get_cloud_sync_control();
  if state.sync_enabled then
    raise exception 'legacy direct deletion did not pause account-wide sync';
  end if;
  begin
    insert into public.financial_workspaces (
      workspace_id, owner_id, schema_version, workspace
    ) values (
      'legacy-recreation',
      '22222222-2222-2222-2222-222222222222',
      2,
      '{"id":"legacy-recreation","schemaVersion":2}'::jsonb
    );
    raise exception 'legacy recreation unexpectedly succeeded';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-1111-1111-111111111111',
  true
);
select * from public.resume_cloud_financial_sync(
  '{"id":"workspace-one-restored","schemaVersion":2}'::jsonb
);

select * from public.replace_cloud_financial_workspace(
  'workspace-one-restored',
  (select updated_at from public.financial_workspaces
   where workspace_id = 'workspace-one-restored'),
  '{"id":"workspace-one-recovered","schemaVersion":2}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.financial_workspaces
    where workspace_id = 'workspace-one-recovered'
  ) then
    raise exception 'conflict recovery replacement failed';
  end if;

  begin
    perform public.replace_cloud_financial_workspace(
      'workspace-one-recovered',
      '2026-10-23T13:00:00Z',
      '{"id":"should-not-replace","schemaVersion":2}'::jsonb
    );
    raise exception 'stale conflict recovery unexpectedly succeeded';
  exception
    when serialization_failure then null;
  end;
end;
$$;

rollback;
