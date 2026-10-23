create or replace function public.wcl_adjust_points(p_user_id uuid,p_delta integer,p_reason text)
returns integer language plpgsql security definer set search_path=''
as $$
declare v_points integer;
begin
 if auth.uid() is null or not wcl_private.has_permission('points.adjust') then raise exception 'Missing permission: points.adjust' using errcode='42501'; end if;
 if p_delta is null or p_delta=0 or abs(p_delta)>1000000 then raise exception 'Point adjustment must be non-zero and within +/- 1000000'; end if;
 if p_reason is null or char_length(trim(p_reason))<3 or char_length(p_reason)>1000 then raise exception 'A reason between 3 and 1000 characters is required'; end if;
 update public.profiles set points=greatest(0,points+p_delta) where id=p_user_id returning points into v_points;
 if v_points is null then raise exception 'Player profile not found'; end if;
 insert into public.audit_logs(actor_id,action,target_type,target_id,details)
 values(auth.uid(),'adjust_points','profiles',p_user_id::text,jsonb_build_object('delta',p_delta,'new_points',v_points,'reason',trim(p_reason)));
 return v_points;
end;
$$;
revoke all on function public.wcl_adjust_points(uuid,integer,text) from public,anon;
grant execute on function public.wcl_adjust_points(uuid,integer,text) to authenticated;
