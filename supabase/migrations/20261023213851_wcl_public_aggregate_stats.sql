create or replace function public.wcl_public_stats()
returns table(level_count bigint,player_count bigint,completion_count bigint,points_total bigint)
language sql stable security definer set search_path=''
as $$
 select
  (select count(*) from public.levels where status='published'),
  (select count(*) from public.profiles),
  (select count(*) from public.completion_submissions where status='approved'),
  (select coalesce(sum(points),0) from public.profiles);
$$;
revoke all on function public.wcl_public_stats() from public,anon,authenticated;
grant execute on function public.wcl_public_stats() to anon,authenticated;
