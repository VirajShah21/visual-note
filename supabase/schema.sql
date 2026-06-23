create table if not exists public.visual_note_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.visual_note_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.visual_note_users(id) on delete cascade,
  session_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.visual_note_workspaces (
  user_id uuid primary key references public.visual_note_users(id) on delete cascade,
  workspace jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.visual_note_workspaces
  drop constraint if exists visual_note_workspaces_user_id_fkey;

alter table public.visual_note_workspaces
  add constraint visual_note_workspaces_user_id_fkey
  foreign key (user_id) references public.visual_note_users(id) on delete cascade;

create table if not exists public.visual_note_notebooks (
  id text primary key,
  user_id uuid not null references public.visual_note_users(id) on delete cascade,
  title text not null,
  slug text not null,
  summary text not null default 'A structured web notebook with sections, topics, views, components, and data.',
  color text not null default '#2f7d5c',
  editor_settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visual_note_notebooks_user_id_idx
  on public.visual_note_notebooks(user_id);

create table if not exists public.visual_note_pages (
  id text primary key,
  user_id uuid not null references public.visual_note_users(id) on delete cascade,
  notebook_id text not null references public.visual_note_notebooks(id) on delete cascade,
  title text not null,
  position integer not null default 0,
  content_object_key text not null,
  topics jsonb not null default '[]'::jsonb,
  views jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists visual_note_pages_user_id_idx
  on public.visual_note_pages(user_id);

create unique index if not exists visual_note_pages_notebook_position_idx
  on public.visual_note_pages(notebook_id, position);

create unique index if not exists visual_note_pages_content_object_key_idx
  on public.visual_note_pages(content_object_key);

create table if not exists public.visual_note_mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.visual_note_users(id) on delete cascade,
  name text not null,
  token_prefix text not null,
  token_hash text not null unique,
  scopes text[] not null default array['visual-note:mcp'],
  last_used_at timestamptz,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.visual_note_s3_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.visual_note_users(id) on delete cascade,
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
  user_id uuid not null references public.visual_note_users(id) on delete cascade,
  connection_id uuid not null references public.visual_note_s3_connections(id) on delete cascade,
  bucket_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, notebook_id)
);

create table if not exists public.visual_note_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.visual_note_users(id) on delete cascade,
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

create index if not exists visual_note_sessions_user_id_idx
  on public.visual_note_sessions(user_id);

create index if not exists visual_note_sessions_expires_at_idx
  on public.visual_note_sessions(expires_at);

create index if not exists visual_note_mcp_tokens_user_id_idx
  on public.visual_note_mcp_tokens(user_id);

create index if not exists visual_note_mcp_tokens_token_prefix_idx
  on public.visual_note_mcp_tokens(token_prefix);

create index if not exists visual_note_s3_connections_user_id_idx
  on public.visual_note_s3_connections(user_id);

create index if not exists visual_note_assets_user_notebook_idx
  on public.visual_note_assets(user_id, notebook_id);

alter table public.visual_note_users enable row level security;
alter table public.visual_note_sessions enable row level security;
alter table public.visual_note_workspaces enable row level security;
alter table public.visual_note_mcp_tokens enable row level security;
alter table public.visual_note_s3_connections enable row level security;
alter table public.visual_note_notebook_storage enable row level security;
alter table public.visual_note_assets enable row level security;
alter table public.visual_note_notebooks enable row level security;
alter table public.visual_note_pages enable row level security;

revoke all on public.visual_note_users from anon;
revoke all on public.visual_note_users from authenticated;
revoke all on public.visual_note_sessions from anon;
revoke all on public.visual_note_sessions from authenticated;
revoke all on public.visual_note_workspaces from anon;
revoke all on public.visual_note_workspaces from authenticated;
revoke all on public.visual_note_mcp_tokens from anon;
revoke all on public.visual_note_mcp_tokens from authenticated;
revoke all on public.visual_note_s3_connections from anon;
revoke all on public.visual_note_s3_connections from authenticated;
revoke all on public.visual_note_notebook_storage from anon;
revoke all on public.visual_note_notebook_storage from authenticated;
revoke all on public.visual_note_assets from anon;
revoke all on public.visual_note_assets from authenticated;

grant select, insert, update, delete on public.visual_note_users to service_role;
grant select, insert, update, delete on public.visual_note_sessions to service_role;
grant select, insert, update, delete on public.visual_note_workspaces to service_role;
grant select, insert, update, delete on public.visual_note_mcp_tokens to service_role;
grant select, insert, update, delete on public.visual_note_s3_connections to service_role;
grant select, insert, update, delete on public.visual_note_notebook_storage to service_role;
grant select, insert, update, delete on public.visual_note_assets to service_role;
grant select, insert, update, delete on public.visual_note_notebooks to service_role;
grant select, insert, update, delete on public.visual_note_pages to service_role;

drop policy if exists read_workspace on public.visual_note_workspaces;
drop policy if exists insert_workspace on public.visual_note_workspaces;
drop policy if exists update_workspace on public.visual_note_workspaces;
drop policy if exists read_s3_connections on public.visual_note_s3_connections;
drop policy if exists insert_s3_connections on public.visual_note_s3_connections;
drop policy if exists update_s3_connections on public.visual_note_s3_connections;
drop policy if exists delete_s3_connections on public.visual_note_s3_connections;
drop policy if exists read_notebook_storage on public.visual_note_notebook_storage;
drop policy if exists insert_notebook_storage on public.visual_note_notebook_storage;
drop policy if exists update_notebook_storage on public.visual_note_notebook_storage;
drop policy if exists delete_notebook_storage on public.visual_note_notebook_storage;
drop policy if exists read_assets on public.visual_note_assets;
drop policy if exists insert_assets on public.visual_note_assets;
drop policy if exists update_assets on public.visual_note_assets;
drop policy if exists delete_assets on public.visual_note_assets;
drop policy if exists read_notebooks on public.visual_note_notebooks;
drop policy if exists insert_notebooks on public.visual_note_notebooks;
drop policy if exists update_notebooks on public.visual_note_notebooks;
drop policy if exists delete_notebooks on public.visual_note_notebooks;
drop policy if exists read_pages on public.visual_note_pages;
drop policy if exists insert_pages on public.visual_note_pages;
drop policy if exists update_pages on public.visual_note_pages;
drop policy if exists delete_pages on public.visual_note_pages;
drop function if exists public.visual_note_user_owns_notebook(text);
