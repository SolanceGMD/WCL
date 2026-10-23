-- WCL database foundation.
-- Review and apply only to the dedicated WCL Supabase project.
-- No service-role key belongs in the browser.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  gd_username text not null unique check (char_length(gd_username) between 1 and 32),
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'player' check (role in ('player', 'moderator', 'admin')),
  -- Granular permissions are granted by a trusted admin, never by the account owner.
  permissions jsonb not null default '{}'::jsonb,
  banned_at timestamptz,
  ban_reason text,
  updated_at timestamptz not null default now()
);

create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  creator text not null check (char_length(creator) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  points integer not null default 0 check (points >= 0),
  difficulty text not null default 'Unrated' check (difficulty in ('Unrated', 'Easy', 'Medium', 'Hard', 'Insane', 'Extreme')),
  length text not null default 'Unrated' check (length in ('Unrated', 'Short', 'Medium', 'Long', 'XL')),
  youtube_url text check (youtube_url is null or youtube_url ~* '^https?://(www\.)?(youtube\.com|youtu\.be)/'),
  thumbnail_url text,
  status text not null default 'published' check (status in ('draft', 'published', 'removed')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.level_submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  creator text not null check (char_length(creator) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  suggested_points integer not null default 0 check (suggested_points >= 0),
  youtube_url text check (youtube_url is null or youtube_url ~* '^https?://(www\.)?(youtube\.com|youtu\.be)/'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.completion_submissions (
  id uuid primary key default gen_random_uuid(),
  submitter_id uuid not null references auth.users(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete restrict,
  proof_url text not null check (proof_url ~* '^https?://'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  points_awarded integer not null default 0 check (points_awarded >= 0),
  reviewer_id uuid references auth.users(id) on delete set null,
  review_note text check (review_note is null or char_length(review_note) <= 1000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  target_type text not null check (char_length(target_type) between 1 and 80),
  target_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists levels_status_points_idx on public.levels(status, points desc);
create index if not exists profiles_points_idx on public.profiles(points desc);
create index if not exists level_submissions_status_created_idx on public.level_submissions(status, created_at desc);
create index if not exists completion_submissions_status_created_idx on public.completion_submissions(status, created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.levels enable row level security;
alter table public.level_submissions enable row level security;
alter table public.completion_submissions enable row level security;
alter table public.audit_logs enable row level security;

-- Public challenge list and player leaderboard. Do not expose role/ban details through a public view.
create policy "profiles are readable for leaderboard"
  on public.profiles for select to anon, authenticated using (true);

create policy "users create their own profile"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()) and points = 0);

-- Role records can be read only by their owner. No client-side role insert/update/delete policy.
create policy "users can read their own role record"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "published levels are public"
  on public.levels for select to anon, authenticated
  using (status = 'published');

-- A submitter can create and read their own submission. Review changes are reserved for trusted server-side code.
create policy "users can create their own level submissions"
  on public.level_submissions for insert to authenticated
  with check (submitter_id = (select auth.uid()) and status = 'pending' and reviewer_id is null and reviewed_at is null);

create policy "users can read their own level submissions"
  on public.level_submissions for select to authenticated
  using (submitter_id = (select auth.uid()));

create policy "users can submit their own completion proof"
  on public.completion_submissions for insert to authenticated
  with check (submitter_id = (select auth.uid()) and status = 'pending' and points_awarded = 0 and reviewer_id is null and reviewed_at is null);

create policy "users can read their own completion submissions"
  on public.completion_submissions for select to authenticated
  using (submitter_id = (select auth.uid()));

-- Intentionally no browser INSERT/UPDATE/DELETE policies on audit_logs.
-- Intentionally no browser write policies for role assignments, points, bans, or review outcomes.
-- Add moderator/admin policies only after implementing a trusted permission-checking model.
-- The service role bypasses RLS and must only be used in trusted server-side functions.
