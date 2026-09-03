-- Register or transfer a physical device's Expo token without relaxing RLS.
-- Expo tokens can persist across logout, so a direct client upsert can collide
-- with a row owned by the previous signed-in user.

create or replace function public.register_push_token(
  p_expo_push_token text,
  p_platform text,
  p_device_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  if nullif(btrim(p_expo_push_token), '') is null then
    raise exception 'Push token is required' using errcode = '22023';
  end if;
  if p_platform not in ('android', 'ios') then
    raise exception 'Unsupported push platform' using errcode = '22023';
  end if;

  insert into public.push_tokens(
    user_id, expo_push_token, platform, device_name, enabled, last_seen_at
  ) values (
    current_user_id, btrim(p_expo_push_token), p_platform,
    nullif(btrim(p_device_name), ''), true, timezone('utc'::text, now())
  )
  on conflict (expo_push_token) do update
  set user_id = current_user_id,
      platform = excluded.platform,
      device_name = excluded.device_name,
      enabled = true,
      last_seen_at = excluded.last_seen_at;
end;
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon;
grant execute on function public.register_push_token(text, text, text) to authenticated;
