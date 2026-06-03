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
