create or replace function public.wcl_review_level_submission(p_submission_id uuid,p_status text,p_note text default null)
returns uuid language plpgsql security definer set search_path=''
as $$
declare s public.level_submissions%rowtype; v_level_id uuid;
begin
 if auth.uid() is null or not wcl_private.has_permission('submissions.review') then raise exception 'Missing permission: submissions.review' using errcode='42501'; end if;
 if p_status not in ('approved','rejected') then raise exception 'Review status must be approved or rejected'; end if;
 if p_note is not null and char_length(p_note)>1000 then raise exception 'Review note is too long'; end if;
 select * into s from public.level_submissions where id=p_submission_id for update;
 if not found or s.status<>'pending' then raise exception 'Pending level submission not found'; end if;
 if p_status='approved' then
  insert into public.levels(name,creator,description,points,difficulty,length,youtube_url,status,created_by)
  values(s.name,s.creator,s.description,s.suggested_points,s.difficulty,s.length,s.youtube_url,'published',s.submitter_id)
  returning id into v_level_id;
 end if;
 update public.level_submissions set status=p_status,reviewer_id=auth.uid(),reviewed_at=now(),review_note=nullif(trim(p_note),'') where id=p_submission_id;
 return v_level_id;
end;
$$;
revoke all on function public.wcl_review_level_submission(uuid,text,text) from public,anon;
grant execute on function public.wcl_review_level_submission(uuid,text,text) to authenticated;
