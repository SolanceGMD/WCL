-- Record the player who verified a submitted level and reward that player only after staff approval.
alter table public.level_submissions
  add column if not exists verified_by uuid references auth.users(id) on delete set null;

-- Verification approvals are also completion runs, but they do not need a separate video URL.
alter table public.completion_submissions
  add column if not exists verification_submission_id uuid references public.level_submissions(id) on delete set null;

alter table public.completion_submissions
  alter column proof_url drop not null;

alter table public.completion_submissions
  drop constraint if exists completion_submissions_proof_url_check;

alter table public.completion_submissions
  add constraint completion_submissions_proof_or_verification_check
  check (
    (proof_url is not null and proof_url ~* '^https?://')
    or verification_submission_id is not null
  );

create unique index if not exists completion_submissions_verification_submission_unique
  on public.completion_submissions(verification_submission_id)
  where verification_submission_id is not null;

drop policy if exists "users create their own level submissions" on public.level_submissions;
create policy "users create their own level submissions"
  on public.level_submissions for insert to authenticated
  with check (
    submitter_id = (select auth.uid())
    and status = 'pending'
    and reviewer_id is null
    and reviewed_at is null
    and verified_by is not null
    and wcl_private.is_not_banned()
  );

drop function if exists public.wcl_review_level_submission(uuid,text,text);
create or replace function public.wcl_review_level_submission(
  p_submission_id uuid,
  p_status text,
  p_points integer,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s public.level_submissions%rowtype;
  v_level_id uuid;
  v_run_id uuid;
begin
  if auth.uid() is null or not wcl_private.has_permission('submissions.review') then
    raise exception 'Missing permission: submissions.review' using errcode = '42501';
  end if;
  if p_status not in ('approved','rejected') then
    raise exception 'Review status must be approved or rejected';
  end if;
  if p_points is null or p_points < 0 or p_points > 1000000 then
    raise exception 'Approved points must be between 0 and 1000000';
  end if;
  if p_note is not null and char_length(p_note) > 1000 then
    raise exception 'Review note is too long';
  end if;

  select * into s
  from public.level_submissions
  where id = p_submission_id
  for update;

  if not found or s.status <> 'pending' then
    raise exception 'Pending level submission not found';
  end if;

  if p_status = 'approved' then
    insert into public.levels(name,gd_level_id,creator,description,points,difficulty,length,youtube_url,status,created_by)
    values(s.name,s.gd_level_id,s.creator,s.description,p_points,s.difficulty,s.length,s.youtube_url,'published',s.submitter_id)
    returning id into v_level_id;

    -- Existing submissions without a selected verifier can still be approved,
    -- but they deliberately do not award any retroactive points or create a run.
    if s.verified_by is not null then
      insert into public.completion_submissions(
        submitter_id, level_id, proof_url, status, points_awarded,
        reviewer_id, review_note, reviewed_at, verification_submission_id
      )
      values(s.verified_by, v_level_id, null, 'pending', 0, null, null, null, s.id)
      returning id into v_run_id;

      -- Reuse the normal completion-award triggers so this run is counted and
      -- points are credited atomically only when the level approval succeeds.
      update public.completion_submissions
      set status = 'approved', reviewer_id = auth.uid(), reviewed_at = now()
      where id = v_run_id;
    end if;
  end if;

  update public.level_submissions
  set status = p_status,
      reviewer_id = auth.uid(),
      reviewed_at = now(),
      review_note = nullif(trim(p_note),'')
  where id = p_submission_id;

  return v_level_id;
end;
$function$;

revoke all on function public.wcl_review_level_submission(uuid,text,integer,text) from public, anon;
grant execute on function public.wcl_review_level_submission(uuid,text,integer,text) to authenticated;
