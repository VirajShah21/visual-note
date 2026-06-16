create table if not exists public.visual_note_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.visual_note_workspaces enable row level security;

grant select, insert, update on public.visual_note_workspaces to authenticated;

drop policy if exists read_workspace on public.visual_note_workspaces;
create policy read_workspace
  on public.visual_note_workspaces
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists insert_workspace on public.visual_note_workspaces;
create policy insert_workspace
  on public.visual_note_workspaces
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists update_workspace on public.visual_note_workspaces;
create policy update_workspace
  on public.visual_note_workspaces
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.visual_note_user_owns_notebook(target_notebook_id text)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1
    from public.visual_note_workspaces workspace
    where workspace.user_id = auth.uid()
      and exists (
        select 1
        from jsonb_array_elements(coalesce(workspace.workspace -> 'notebooks', '[]'::jsonb)) notebook
        where notebook ->> 'id' = target_notebook_id
      )
  );
$$;

create table if not exists public.visual_note_s3_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  endpoint_url text,
  region text not null default 'us-east-1',
  force_path_style boolean not null default false,
  access_key_id text not null,
  encrypted_secret_access_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visual_note_notebook_storage (
  notebook_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null references public.visual_note_s3_connections(id) on delete cascade,
  bucket_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, notebook_id)
);

create table if not exists public.visual_note_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  notebook_id text not null,
  connection_id uuid not null references public.visual_note_s3_connections(id) on delete restrict,
  bucket_name text not null,
  object_key text not null,
  content_type text not null,
  file_name text not null,
  byte_size bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, bucket_name, object_key)
);

alter table public.visual_note_s3_connections enable row level security;
alter table public.visual_note_notebook_storage enable row level security;
alter table public.visual_note_assets enable row level security;

revoke all on public.visual_note_s3_connections from authenticated;
revoke all on public.visual_note_notebook_storage from authenticated;
revoke all on public.visual_note_assets from authenticated;

grant select, insert, update, delete on public.visual_note_s3_connections to service_role;
grant select, insert, update, delete on public.visual_note_notebook_storage to service_role;
grant select, insert, update, delete on public.visual_note_assets to service_role;

drop policy if exists read_s3_connections on public.visual_note_s3_connections;
create policy read_s3_connections
  on public.visual_note_s3_connections
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists insert_s3_connections on public.visual_note_s3_connections;
create policy insert_s3_connections
  on public.visual_note_s3_connections
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists update_s3_connections on public.visual_note_s3_connections;
create policy update_s3_connections
  on public.visual_note_s3_connections
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists delete_s3_connections on public.visual_note_s3_connections;
create policy delete_s3_connections
  on public.visual_note_s3_connections
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists read_notebook_storage on public.visual_note_notebook_storage;
create policy read_notebook_storage
  on public.visual_note_notebook_storage
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists insert_notebook_storage on public.visual_note_notebook_storage;
create policy insert_notebook_storage
  on public.visual_note_notebook_storage
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.visual_note_user_owns_notebook(notebook_id)
    and exists (
      select 1
      from public.visual_note_s3_connections connection
      where connection.id = connection_id
        and connection.user_id = auth.uid()
    )
  );

drop policy if exists update_notebook_storage on public.visual_note_notebook_storage;
create policy update_notebook_storage
  on public.visual_note_notebook_storage
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.visual_note_user_owns_notebook(notebook_id)
    and exists (
      select 1
      from public.visual_note_s3_connections connection
      where connection.id = connection_id
        and connection.user_id = auth.uid()
    )
  );

drop policy if exists delete_notebook_storage on public.visual_note_notebook_storage;
create policy delete_notebook_storage
  on public.visual_note_notebook_storage
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists read_assets on public.visual_note_assets;
create policy read_assets
  on public.visual_note_assets
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists insert_assets on public.visual_note_assets;
create policy insert_assets
  on public.visual_note_assets
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and public.visual_note_user_owns_notebook(notebook_id)
    and exists (
      select 1
      from public.visual_note_s3_connections connection
      where connection.id = connection_id
        and connection.user_id = auth.uid()
    )
  );

drop policy if exists update_assets on public.visual_note_assets;
create policy update_assets
  on public.visual_note_assets
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and public.visual_note_user_owns_notebook(notebook_id)
    and exists (
      select 1
      from public.visual_note_s3_connections connection
      where connection.id = connection_id
        and connection.user_id = auth.uid()
    )
  );

drop policy if exists delete_assets on public.visual_note_assets;
create policy delete_assets
  on public.visual_note_assets
  for delete
  to authenticated
  using (auth.uid() = user_id);
