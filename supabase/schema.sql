-- Jalankan sekali di Supabase SQL Editor untuk fitur Saling Pantau (Team Board & Shared Styles)

create table if not exists public.projects (
  id text primary key,
  slug text not null,
  title text not null,
  owner text not null,
  status text not null default 'draft',
  style_id text,
  duration_sec integer default 30,
  notes text default '',
  post_json jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.styles (
  id text primary key,
  name text not null,
  owner text not null,
  source_url text,
  engine text not null default 'remotion',
  prompt text not null,
  build_recipe text,
  palette jsonb default '[]'::jsonb,
  notes jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  owner text not null,
  project_id text,
  message text not null,
  created_at timestamptz not null default now()
);

-- Aktifkan Realtime agar perubahan langsung muncul di PC teman
alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.styles;
alter publication supabase_realtime add table public.activity_logs;

-- Karena hanya dipakai berdua dengan anon key privat di .env lokal,
-- izinkan read/write penuh (bisa diperketat dengan Supabase Auth nanti jika perlu).
alter table public.projects enable row level security;
alter table public.styles enable row level security;
alter table public.activity_logs enable row level security;

create policy "team_projects_all" on public.projects for all using (true) with check (true);
create policy "team_styles_all" on public.styles for all using (true) with check (true);
create policy "team_logs_all" on public.activity_logs for all using (true) with check (true);
