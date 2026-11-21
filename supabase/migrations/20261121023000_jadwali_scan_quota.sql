create table public.jadwali_scan_usage (
    day date primary key,
    requests integer not null check (requests between 0 and 40)
);
alter table public.jadwali_scan_usage enable row level security;
revoke all on public.jadwali_scan_usage from anon, authenticated;

create function public.jadwali_reserve_scan()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
    today date := (statement_timestamp() at time zone 'UTC')::date;
begin
    delete from public.jadwali_scan_usage where day < today - 7;
    insert into public.jadwali_scan_usage as usage (day, requests)
    values (today, 1)
    on conflict (day) do update set requests = usage.requests + 1
        where usage.requests < 40;
    return found;
end;
$$;
revoke all on function public.jadwali_reserve_scan() from public, anon, authenticated;
grant select, insert, update, delete on public.jadwali_scan_usage to service_role;
grant execute on function public.jadwali_reserve_scan() to service_role;
