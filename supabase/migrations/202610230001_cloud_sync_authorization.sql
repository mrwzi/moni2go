-- Account-wide cloud deletion protection.
-- This migration is additive: it preserves all existing workspace rows and users.

create table public.cloud_sync_controls (
  user_id uuid primary key references auth.users (id) on delete cascade,
  sync_enabled boolean not null default true,
  generation bigint not null default 1 check (generation > 0),
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.cloud_sync_controls (user_id)
select id from auth.users
on conflict (user_id) do nothing;

alter table public.cloud_sync_controls enable row level security;
revoke all on table public.cloud_sync_controls from anon, authenticated;
grant select on table public.cloud_sync_controls to authenticated;

create policy "Users can read their own cloud sync control"
  on public.cloud_sync_controls for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.create_cloud_sync_control_for_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.cloud_sync_controls (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_cloud_sync_control_after_signup on auth.users;
create trigger create_cloud_sync_control_after_signup
  after insert on auth.users
  for each row execute function public.create_cloud_sync_control_for_user();

-- Close the deployment-time signup window between the initial backfill and
-- trigger installation. This is idempotent and does not modify existing rows.
insert into public.cloud_sync_controls (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function public.require_cloud_sync_enabled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed boolean;
begin
  select sync_enabled into allowed
  from public.cloud_sync_controls
  where user_id = new.owner_id
  for share;

  if allowed is distinct from true then
    raise insufficient_privilege using
      message = 'Cloud sync is paused for this account.';
  end if;
  return new;
end;
$$;

drop trigger if exists require_cloud_sync_enabled_before_write
  on public.financial_workspaces;
create trigger require_cloud_sync_enabled_before_write
  before insert or update on public.financial_workspaces
  for each row execute function public.require_cloud_sync_enabled();

create or replace function public.mark_cloud_sync_deleted_on_workspace_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.cloud_sync_internal_delete', true) = 'on' then
    return old;
  end if;
  update public.cloud_sync_controls set
    sync_enabled = false,
    generation = generation + 1,
    deleted_at = now(),
    updated_at = now()
  where user_id = old.owner_id and sync_enabled;
  return old;
end;
$$;

drop trigger if exists mark_cloud_sync_deleted_before_workspace_delete
  on public.financial_workspaces;
create trigger mark_cloud_sync_deleted_before_workspace_delete
  before delete on public.financial_workspaces
  for each row execute function public.mark_cloud_sync_deleted_on_workspace_delete();

create policy "Cloud writes require account authorization"
  on public.financial_workspaces
  as restrictive
  for all
  to authenticated
  using (
    exists (
      select 1 from public.cloud_sync_controls control
      where control.user_id = owner_id and control.sync_enabled
    )
  )
  with check (
    exists (
      select 1 from public.cloud_sync_controls control
      where control.user_id = owner_id and control.sync_enabled
    )
  );

create or replace function public.get_cloud_sync_control()
returns table (sync_enabled boolean, generation bigint, deleted_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  insert into public.cloud_sync_controls (user_id)
  values (current_user_id)
  on conflict (user_id) do nothing;

  return query
    select control.sync_enabled, control.generation, control.deleted_at
    from public.cloud_sync_controls control
    where control.user_id = current_user_id;
end;
$$;

create or replace function public.delete_cloud_financial_workspaces()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  insert into public.cloud_sync_controls (
    user_id, sync_enabled, generation, deleted_at, updated_at
  ) values (
    current_user_id, false, 1, now(), now()
  )
  on conflict (user_id) do update set
    sync_enabled = false,
    generation = public.cloud_sync_controls.generation + 1,
    deleted_at = now(),
    updated_at = now();

  perform set_config('app.cloud_sync_internal_delete', 'on', true);
  delete from public.financial_workspaces
  where owner_id = current_user_id;
  perform set_config('app.cloud_sync_internal_delete', 'off', true);
end;
$$;

create or replace function public.resume_cloud_financial_sync(p_workspace jsonb)
returns table (
  sync_enabled boolean,
  generation bigint,
  deleted_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  replacement_time timestamptz;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  insert into public.cloud_sync_controls (
    user_id, sync_enabled, generation, deleted_at, updated_at
  ) values (
    current_user_id, true, 1, null, now()
  )
  on conflict (user_id) do update set
    sync_enabled = true,
    generation = public.cloud_sync_controls.generation + 1,
    deleted_at = null,
    updated_at = now();

  perform set_config('app.cloud_sync_internal_delete', 'on', true);
  delete from public.financial_workspaces
  where owner_id = current_user_id;
  perform set_config('app.cloud_sync_internal_delete', 'off', true);

  if p_workspace is not null then
    replacement_time := clock_timestamp();
    insert into public.financial_workspaces (
      workspace_id,
      owner_id,
      schema_version,
      workspace,
      updated_at
    ) values (
      p_workspace ->> 'id',
      current_user_id,
      (p_workspace ->> 'schemaVersion')::integer,
      p_workspace,
      replacement_time
    );
  end if;

  return query
    select
      control.sync_enabled,
      control.generation,
      control.deleted_at,
      replacement_time
    from public.cloud_sync_controls control
    where control.user_id = current_user_id;
end;
$$;

create or replace function public.replace_cloud_financial_workspace(
  p_expected_workspace_id text,
  p_expected_updated_at timestamptz,
  p_workspace jsonb
)
returns table (updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  replacement_time timestamptz := clock_timestamp();
  current_sync_enabled boolean;
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  select control.sync_enabled into current_sync_enabled
  from public.cloud_sync_controls control
  where control.user_id = current_user_id
  for share;

  if current_sync_enabled is distinct from true then
    raise insufficient_privilege using
      message = 'Cloud sync is paused for this account.';
  end if;

  perform 1 from public.financial_workspaces
  where owner_id = current_user_id
    and workspace_id = p_expected_workspace_id
    and financial_workspaces.updated_at = p_expected_updated_at
  for update;
  if not found then
    raise serialization_failure using
      message = 'The cloud workspace changed before conflict recovery.';
  end if;

  perform set_config('app.cloud_sync_internal_delete', 'on', true);
  delete from public.financial_workspaces
  where owner_id = current_user_id;
  perform set_config('app.cloud_sync_internal_delete', 'off', true);

  insert into public.financial_workspaces (
    workspace_id,
    owner_id,
    schema_version,
    workspace,
    updated_at
  ) values (
    p_workspace ->> 'id',
    current_user_id,
    (p_workspace ->> 'schemaVersion')::integer,
    p_workspace,
    replacement_time
  );

  return query select replacement_time;
end;
$$;

revoke all on function public.get_cloud_sync_control() from public, anon;
revoke all on function public.delete_cloud_financial_workspaces() from public, anon;
revoke all on function public.resume_cloud_financial_sync(jsonb) from public, anon;
revoke all on function public.replace_cloud_financial_workspace(text, timestamptz, jsonb)
  from public, anon;
grant execute on function public.get_cloud_sync_control() to authenticated;
grant execute on function public.delete_cloud_financial_workspaces() to authenticated;
grant execute on function public.resume_cloud_financial_sync(jsonb) to authenticated;
grant execute on function public.replace_cloud_financial_workspace(text, timestamptz, jsonb)
  to authenticated;

revoke all on function public.create_cloud_sync_control_for_user() from public;
revoke all on function public.require_cloud_sync_enabled() from public;
revoke all on function public.mark_cloud_sync_deleted_on_workspace_delete()
  from public;

