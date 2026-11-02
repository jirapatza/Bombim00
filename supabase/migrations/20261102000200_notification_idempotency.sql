-- Safe notification idempotency for the Python checker.
-- A unique reservation is created before delivery; failed/stale reservations may be retried.
create unique index if not exists notification_events_fingerprint_channel_uidx
  on public.notification_events (fingerprint, channel);

drop function if exists public.claim_bombim00_notification(text, text, jsonb);

create or replace function public.claim_bombim00_notification(
  p_fingerprint text,
  p_channel text,
  p_payload jsonb default '{}'::jsonb,
  p_force boolean default false
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows integer;
begin
  if coalesce(p_fingerprint, '') = '' or coalesce(p_channel, '') = '' then
    raise exception 'fingerprint and channel are required';
  end if;
  if p_channel not in ('ntfy', 'line') then
    raise exception 'unsupported notification channel';
  end if;

  insert into public.notification_events
    (fingerprint, channel, delivery_status, payload, created_at)
  values
    (p_fingerprint, p_channel, 'reserved', coalesce(p_payload, '{}'::jsonb), now())
  on conflict (fingerprint, channel) do update
    set delivery_status = 'reserved',
        payload = excluded.payload,
        provider_reference = null,
        sent_at = null,
        created_at = now()
    where p_force
       or public.notification_events.delivery_status = 'failed'
       or (public.notification_events.delivery_status = 'reserved'
           and public.notification_events.created_at < now() - interval '10 minutes');

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

create or replace function public.complete_bombim00_notification(
  p_fingerprint text,
  p_channel text,
  p_success boolean,
  p_provider_reference text default null
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows integer;
begin
  update public.notification_events
     set delivery_status = case when p_success then 'sent' else 'failed' end,
         provider_reference = left(p_provider_reference, 300),
         sent_at = case when p_success then now() else null end
   where fingerprint = p_fingerprint
     and channel = p_channel
     and delivery_status = 'reserved';
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end;
$$;

revoke all on function public.claim_bombim00_notification(text, text, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.complete_bombim00_notification(text, text, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_bombim00_notification(text, text, jsonb, boolean) to service_role;
grant execute on function public.complete_bombim00_notification(text, text, boolean, text) to service_role;
