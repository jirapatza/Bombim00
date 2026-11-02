-- Keep updated_at accurate for PostgREST upserts from both Node and Python.
create or replace function public.set_bombim00_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lottery_results_set_updated_at on public.lottery_results;
create trigger lottery_results_set_updated_at
before update on public.lottery_results
for each row execute function public.set_bombim00_updated_at();

drop trigger if exists lottery_catalog_set_updated_at on public.lottery_catalog;
create trigger lottery_catalog_set_updated_at
before update on public.lottery_catalog
for each row execute function public.set_bombim00_updated_at();

drop trigger if exists app_settings_set_updated_at on public.app_settings;
create trigger app_settings_set_updated_at
before update on public.app_settings
for each row execute function public.set_bombim00_updated_at();

drop trigger if exists system_status_set_updated_at on public.system_status;
create trigger system_status_set_updated_at
before update on public.system_status
for each row execute function public.set_bombim00_updated_at();

drop trigger if exists self_healing_history_set_updated_at on public.self_healing_history;
create trigger self_healing_history_set_updated_at
before update on public.self_healing_history
for each row execute function public.set_bombim00_updated_at();

revoke all on function public.set_bombim00_updated_at() from public, anon, authenticated;
