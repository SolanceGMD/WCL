-- Follow-up fixes for the WCL initial schema.
grant select on public.profiles to anon, authenticated;
grant select on public.levels to anon, authenticated;
grant select, update on public.user_roles to authenticated;
grant select, insert, update on public.level_submissions to authenticated;
grant select, insert, update on public.completion_submissions to authenticated;
grant select, insert, update, delete on public.levels to authenticated;
grant select on public.audit_logs to authenticated;
drop policy if exists "published levels are public" on public.levels;
drop policy if exists "authenticated can read published and staff levels" on public.levels;
create policy "published levels are public" on public.levels for select to anon using (status = 'published');
create policy "authenticated can read published and staff levels" on public.levels for select to authenticated using (status = 'published' or wcl_private.has_permission('levels.manage'));
create or replace function wcl_private.audit_row_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_actor uuid; v_action text; v_target text; v_details jsonb;
begin
 v_actor:=auth.uid();v_action:=lower(tg_op);
 if tg_op='DELETE' then v_target:=coalesce(to_jsonb(old)->>'id',to_jsonb(old)->>'user_id');v_details:=jsonb_build_object('before',to_jsonb(old));
 elsif tg_op='INSERT' then v_target:=coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id');v_details:=jsonb_build_object('after',to_jsonb(new));
 else v_target:=coalesce(to_jsonb(new)->>'id',to_jsonb(new)->>'user_id');v_details:=jsonb_build_object('before',to_jsonb(old),'after',to_jsonb(new));end if;
 insert into public.audit_logs(actor_id,action,target_type,target_id,details) values(v_actor,v_action,tg_table_name,v_target,v_details);
 if tg_op='DELETE' then return old;else return new;end if;
end;
$$;
