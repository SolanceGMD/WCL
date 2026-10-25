-- Store Geometry Dash's numeric level ID separately from WCL's internal UUID.
alter table public.levels add column if not exists gd_level_id text;
alter table public.level_submissions add column if not exists gd_level_id text;

alter table public.levels
  drop constraint if exists levels_gd_level_id_format_check,
  drop constraint if exists levels_gd_level_id_required_check;
alter table public.levels
  add constraint levels_gd_level_id_format_check
    check (gd_level_id is null or gd_level_id ~ '^[0-9]+$'),
  -- Only the existing Conical Happyiness row is allowed to have no GD ID.
  add constraint levels_gd_level_id_required_check
    check (
      gd_level_id is not null
      or (
        id = 'c9ae0f64-f455-4434-9137-084d45e703b4'::uuid
        and regexp_replace(lower(name), '[^a-z]', '', 'g') in ('conicalhappiness', 'conicalhappyiness')
      )
    );

alter table public.level_submissions
  drop constraint if exists level_submissions_gd_level_id_format_check,
  drop constraint if exists level_submissions_gd_level_id_required_check;
alter table public.level_submissions
  add constraint level_submissions_gd_level_id_format_check
    check (gd_level_id is null or gd_level_id ~ '^[0-9]+$'),
  -- Preserve one historical approved submission; all new submissions need a GD ID.
  add constraint level_submissions_gd_level_id_required_check
    check (
      gd_level_id is not null
      or id = '0c577d62-589c-4d89-a867-ade5f6044f82'::uuid
    );

create unique index if not exists levels_gd_level_id_unique
  on public.levels (gd_level_id) where gd_level_id is not null;

create or replace function public.wcl_review_level_submission(p_submission_id uuid, p_status text, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare s public.level_submissions%rowtype; v_level_id uuid;
begin
 if auth.uid() is null or not wcl_private.has_permission('submissions.review') then raise exception 'Missing permission: submissions.review' using errcode='42501'; end if;
 if p_status not in ('approved','rejected') then raise exception 'Review status must be approved or rejected'; end if;
 if p_note is not null and char_length(p_note)>1000 then raise exception 'Review note is too long'; end if;
 select * into s from public.level_submissions where id=p_submission_id for update;
 if not found or s.status<>'pending' then raise exception 'Pending level submission not found'; end if;
 if p_status='approved' then
  insert into public.levels(name,gd_level_id,creator,description,points,difficulty,length,youtube_url,status,created_by)
  values(s.name,s.gd_level_id,s.creator,s.description,s.suggested_points,s.difficulty,s.length,s.youtube_url,'published',s.submitter_id)
  returning id into v_level_id;
 end if;
 update public.level_submissions set status=p_status,reviewer_id=auth.uid(),reviewed_at=now(),review_note=nullif(trim(p_note),'')
 where id=p_submission_id;
 return v_level_id;
end;
$function$;
