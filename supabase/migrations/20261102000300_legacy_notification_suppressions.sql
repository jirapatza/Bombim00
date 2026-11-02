-- Preserve legacy JSON "sent" flags as global suppression markers without
-- inventing which delivery channel (LINE or ntfy) actually succeeded.
create table if not exists public.notification_suppressions (
  fingerprint text primary key,
  reason text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.notification_suppressions enable row level security;
revoke all on public.notification_suppressions from anon, authenticated;
grant all on public.notification_suppressions to service_role;

create or replace function public.sync_bombim00_legacy_suppressions()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_rows integer;
begin
  insert into public.notification_suppressions (fingerprint, reason, payload)
  select fingerprint,
         'legacy_sent_status',
         jsonb_build_object('channel_unknown', true, 'source', 'legacy_json_status')
    from public.lottery_results
   where coalesce(notification_status, payload->>'สถานะการแจ้งเตือน', payload->>'notification_status') = 'sent'
  on conflict (fingerprint) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

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

  -- Historical "sent" flags do not identify a channel. Suppress both channels
  -- conservatively rather than fabricating historical delivery records.
  if not p_force and exists (
    select 1 from public.notification_suppressions
     where fingerprint = p_fingerprint
  ) then
    return false;
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

revoke all on function public.sync_bombim00_legacy_suppressions() from public, anon, authenticated;
grant execute on function public.sync_bombim00_legacy_suppressions() to service_role;
revoke all on function public.claim_bombim00_notification(text, text, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.claim_bombim00_notification(text, text, jsonb, boolean) to service_role;
