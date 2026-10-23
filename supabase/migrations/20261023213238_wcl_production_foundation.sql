-- WCL production schema. Applied to Supabase project xvdinlyertutpddeilvq.
create extension if not exists pgcrypto;
create schema if not exists wcl_private;
revoke all on schema wcl_private from public, anon;
grant usage on schema wcl_private to authenticated;

create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 gd_username text not null check (char_length(gd_username) between 1 and 32),
 points integer not null default 0 check (points >= 0),
 created_at timestamptz not null default now()
);
create unique index if not exists profiles_gd_username_ci_idx on public.profiles(lower(gd_username));

create table if not exists public.user_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null default 'player' check (role in ('player','moderator','admin')),
 permissions jsonb not null default '{}'::jsonb,
 banned_at timestamptz,
 ban_reason text check (ban_reason is null or char_length(ban_reason)<=1000),
 updated_at timestamptz not null default now()
);

create table if not exists public.levels (
 id uuid primary key default gen_random_uuid(),
 name text not null check (char_length(name) between 1 and 100),
 creator text not null check (char_length(creator) between 1 and 80),
 description text not null default '' check (char_length(description)<=2000),
 points integer not null default 0 check (points between 0 and 1000000),
 difficulty text not null default 'Unrated' check (difficulty in ('Unrated','Easy','Medium','Hard','Insane','Extreme')),
 length text not null default 'Unrated' check (length in ('Unrated','Short','Medium','Long','XL')),
 youtube_url text check (youtube_url is null or youtube_url ~* '^https?://(www\.)?(youtube\.com|youtu\.be)/'),
 thumbnail_url text,
 status text not null default 'published' check (status in ('draft','published','removed')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.level_submissions (
 id uuid primary key default gen_random_uuid(),
 submitter_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 100),
 creator text not null check (char_length(creator) between 1 and 80),
 description text not null default '' check (char_length(description)<=2000),
 suggested_points integer not null default 10 check (suggested_points between 0 and 1000000),
 difficulty text not null default 'Unrated' check (difficulty in ('Unrated','Easy','Medium','Hard','Insane','Extreme')),
 length text not null default 'Unrated' check (length in ('Unrated','Short','Medium','Long','XL')),
 youtube_url text check (youtube_url is null or youtube_url ~* '^https?://(www\.)?(youtube\.com|youtu\.be)/'),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 reviewer_id uuid references auth.users(id) on delete set null,
 review_note text check (review_note is null or char_length(review_note)<=1000),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists public.completion_submissions (
 id uuid primary key default gen_random_uuid(),
 submitter_id uuid not null references auth.users(id) on delete cascade,
 level_id uuid not null references public.levels(id) on delete restrict,
 proof_url text not null check (proof_url ~* '^https?://'),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 points_awarded integer not null default 0 check (points_awarded>=0),
 reviewer_id uuid references auth.users(id) on delete set null,
 review_note text check (review_note is null or char_length(review_note)<=1000),
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index if not exists one_pending_or_approved_completion_per_level on public.completion_submissions(submitter_id,level_id) where status in ('pending','approved');

create table if not exists public.audit_logs (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check (char_length(action) between 1 and 100),
 target_type text not null check (char_length(target_type) between 1 and 80),
 target_id text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create index if not exists levels_status_points_idx on public.levels(status,points desc);
create index if not exists profiles_points_idx on public.profiles(points desc);
create index if not exists level_submissions_status_created_idx on public.level_submissions(status,created_at desc);
create index if not exists completion_submissions_status_created_idx on public.completion_submissions(status,created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs(created_at desc);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.levels enable row level security;
alter table public.level_submissions enable row level security;
alter table public.completion_submissions enable row level security;
alter table public.audit_logs enable row level security;

create or replace function wcl_private.has_permission(p_permission text)
returns boolean language sql stable security definer set search_path=''
as $$ select coalesce((select r.role='admin' or coalesce((r.permissions->>p_permission)::boolean,false) from public.user_roles r where r.user_id=auth.uid() and r.banned_at is null),false); $$;
revoke all on function wcl_private.has_permission(text) from public,anon;
grant execute on function wcl_private.has_permission(text) to authenticated;

create or replace function wcl_private.is_not_banned()
returns boolean language sql stable security definer set search_path=''
as $$ select coalesce((select r.banned_at is null from public.user_roles r where r.user_id=auth.uid()),true); $$;
revoke all on function wcl_private.is_not_banned() from public,anon;
grant execute on function wcl_private.is_not_banned() to authenticated;

create policy "profiles are readable for leaderboard" on public.profiles for select to anon,authenticated using(true);
create policy "users read their own role" on public.user_roles for select to authenticated using(user_id=(select auth.uid()) or wcl_private.has_permission('users.manage'));
create policy "admins and authorized moderators manage roles" on public.user_roles for all to authenticated using(wcl_private.has_permission('users.manage')) with check(wcl_private.has_permission('users.manage'));
create policy "published levels are public" on public.levels for select to anon using(status='published');
create policy "authenticated can read published and staff levels" on public.levels for select to authenticated using(status='published' or wcl_private.has_permission('levels.manage'));
create policy "authorized staff manage levels" on public.levels for all to authenticated using(wcl_private.has_permission('levels.manage')) with check(wcl_private.has_permission('levels.manage'));
create policy "users create their own level submissions" on public.level_submissions for insert to authenticated with check(submitter_id=(select auth.uid()) and status='pending' and reviewer_id is null and reviewed_at is null and wcl_private.is_not_banned());
create policy "users read their own level submissions" on public.level_submissions for select to authenticated using(submitter_id=(select auth.uid()) or wcl_private.has_permission('submissions.review'));
create policy "authorized staff review level submissions" on public.level_submissions for update to authenticated using(wcl_private.has_permission('submissions.review')) with check(wcl_private.has_permission('submissions.review'));
create policy "users submit their own completion proof" on public.completion_submissions for insert to authenticated with check(submitter_id=(select auth.uid()) and status='pending' and points_awarded=0 and reviewer_id is null and reviewed_at is null and wcl_private.is_not_banned());
create policy "users read their own completion submissions" on public.completion_submissions for select to authenticated using(submitter_id=(select auth.uid()) or wcl_private.has_permission('submissions.review'));
create policy "authorized staff review completion submissions" on public.completion_submissions for update to authenticated using(wcl_private.has_permission('submissions.review')) with check(wcl_private.has_permission('submissions.review'));
create policy "staff read audit logs" on public.audit_logs for select to authenticated using(wcl_private.has_permission('audit.view'));

create or replace function wcl_private.on_auth_user_created()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_name text;
begin
 v_name:=coalesce(nullif(trim(new.raw_user_meta_data->>'gd_username'),''),'Player_'||left(new.id::text,8));
 insert into public.profiles(id,gd_username,points) values(new.id,left(v_name,32),0) on conflict(id) do nothing;
 insert into public.user_roles(user_id,role,permissions) values(new.id,'player','{}'::jsonb) on conflict(user_id) do nothing;
 return new;
end;
$$;
create trigger wcl_auth_user_created after insert on auth.users for each row execute function wcl_private.on_auth_user_created();

create or replace function wcl_private.apply_completion_award()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_points integer;
begin
 if new.status='approved' and old.status is distinct from 'approved' then
  select l.points into v_points from public.levels l where l.id=new.level_id and l.status='published';
  if v_points is null then raise exception 'Cannot approve completion for an unpublished level'; end if;
  new.points_awarded:=v_points; new.reviewed_at:=coalesce(new.reviewed_at,now());
  if new.reviewer_id is null then new.reviewer_id:=auth.uid(); end if;
 elsif new.status<>'approved' then new.points_awarded:=0;
 end if;
 return new;
end;
$$;
create trigger wcl_completion_before_update before update of status on public.completion_submissions for each row execute function wcl_private.apply_completion_award();

create or replace function wcl_private.credit_completion_points()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.status='approved' and old.status is distinct from 'approved' then
  update public.profiles set points=points+new.points_awarded where id=new.submitter_id;
 end if;
 if old.status='approved' and new.status<>'approved' then
  update public.profiles set points=greatest(0,points-old.points_awarded) where id=old.submitter_id;
 end if;
 return new;
end;
$$;
create trigger wcl_completion_after_update after update of status on public.completion_submissions for each row execute function wcl_private.credit_completion_points();

create or replace function wcl_private.audit_row_change()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_target text; v_details jsonb;
begin
 if tg_op='DELETE' then v_target:=coalesce(to_jsonb(old)->>'id',to_jsonb(old)->>'user_id');v_details:=jsonb_build_object('before',to_jsonb(old));
 elsif tg_op='INSERT' then v_target:=coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id');v_details:=jsonb_build_object('after',to_jsonb(new));
 else v_target:=coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id');v_details:=jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new));end if;
 insert into public.audit_logs(actor_id,action,target_type,target_id,details) values(auth.uid(),lower(tg_op),tg_table_name,v_target,v_details);
 if tg_op='DELETE' then return old;else return new;end if;
end;
$$;
create trigger wcl_audit_levels after insert or update or delete on public.levels for each row execute function wcl_private.audit_row_change();
create trigger wcl_audit_level_submissions after update on public.level_submissions for each row execute function wcl_private.audit_row_change();
create trigger wcl_audit_completion_submissions after update on public.completion_submissions for each row execute function wcl_private.audit_row_change();
create trigger wcl_audit_user_roles after insert or update or delete on public.user_roles for each row execute function wcl_private.audit_row_change();

grant select on public.profiles to anon,authenticated;
grant select on public.levels to anon,authenticated;
grant select,update on public.user_roles to authenticated;
grant select,insert,update on public.level_submissions to authenticated;
grant select,insert,update on public.completion_submissions to authenticated;
grant select,insert,update,delete on public.levels to authenticated;
grant select on public.audit_logs to authenticated;
