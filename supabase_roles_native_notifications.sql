-- Role hierarchy, superadmin bootstrap, native push tokens, and scheduled readiness notices.
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

alter table public.profiles add column if not exists email text;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('customer', 'driver', 'admin', 'superadmin'));

update public.profiles p
set email = lower(u.email)
from auth.users u
where u.id = p.id and (p.email is null or p.email is distinct from lower(u.email));

update public.profiles p
set role = 'superadmin', updated_at = timezone('utc'::text, now())
from auth.users u
where u.id = p.id
  and lower(u.email) in ('ifeanyieee8105@gmail.com', 'drlaundry6@gmail.com');

create or replace function private.current_app_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'customer'
  );
$$;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_app_role() in ('driver', 'admin', 'superadmin');
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_app_role() in ('admin', 'superadmin');
$$;

create or replace function private.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_app_role() = 'superadmin';
$$;

revoke all on function private.current_app_role() from public, anon;
revoke all on function private.is_staff() from public, anon;
revoke all on function private.is_admin() from public, anon;
revoke all on function private.is_superadmin() from public, anon;
grant execute on function private.current_app_role() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_superadmin() to authenticated;

create or replace function private.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if lower(coalesce(old.email, '')) in ('ifeanyieee8105@gmail.com', 'drlaundry6@gmail.com')
     and new.role <> 'superadmin' then
    raise exception 'Reserved superadmin accounts cannot be demoted';
  end if;
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not private.is_superadmin() then
    raise exception 'Only a superadmin can change account roles';
  end if;
  if new.email is distinct from old.email and auth.uid() is not null then
    raise exception 'Profile email is managed by Supabase Auth';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role_before_update on public.profiles;
create trigger protect_profile_role_before_update
before update of role, email on public.profiles
for each row execute function private.protect_profile_role();

drop policy if exists "Superadmins can update all profiles" on public.profiles;
create policy "Superadmins can update all profiles"
on public.profiles for update
to authenticated
using ((select private.is_superadmin()))
with check ((select private.is_superadmin()));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  assigned_role text;
begin
  assigned_role := case
    when lower(new.email) in ('ifeanyieee8105@gmail.com', 'drlaundry6@gmail.com')
      then 'superadmin'
    else 'customer'
  end;

  insert into public.profiles (id, email, name, phone_number, address, role)
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'phone_number', new.raw_user_meta_data->>'phoneNumber', ''),
    coalesce(new.raw_user_meta_data->>'address', ''),
    assigned_role
  )
  on conflict (id) do update set
    email = excluded.email,
    role = case when excluded.role = 'superadmin' then 'superadmin' else public.profiles.role end,
    updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  device_name text,
  enabled boolean not null default true,
  last_seen_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.push_tokens enable row level security;
grant select, insert, update, delete on public.push_tokens to authenticated;

drop policy if exists "Users can view their push tokens" on public.push_tokens;
create policy "Users can view their push tokens"
on public.push_tokens for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can register push tokens" on public.push_tokens;
create policy "Users can register push tokens"
on public.push_tokens for insert to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can refresh push tokens" on public.push_tokens;
create policy "Users can refresh push tokens"
on public.push_tokens for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can remove push tokens" on public.push_tokens;
create policy "Users can remove push tokens"
on public.push_tokens for delete to authenticated
using ((select auth.uid()) = user_id);

create index if not exists push_tokens_user_enabled_idx
on public.push_tokens (user_id, enabled);

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

alter table public.notifications
  add column if not exists dedupe_key text,
  add column if not exists push_requested_at timestamp with time zone,
  add column if not exists push_request_id bigint;

create unique index if not exists notifications_user_dedupe_idx
on public.notifications (user_id, dedupe_key)
where dedupe_key is not null;

alter table public.orders
  add column if not exists readiness_notified_at timestamp with time zone;

create or replace function public.create_order_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_title text;
  notification_body text;
  notification_key text;
begin
  if new.payment_status <> 'paid' then
    return new;
  end if;

  if tg_op = 'INSERT' or old.payment_status is distinct from new.payment_status then
    notification_title := 'Order confirmed';
    notification_body := 'Your order ' || new.id || ' is confirmed and awaiting pickup.';
    notification_key := 'order:' || new.id || ':paid';
  elsif old.status is distinct from new.status then
    notification_title := case new.status
      when 'processing' then 'Pickup complete'
      when 'out-for-delivery' then 'Fresh laundry on the way'
      when 'delivered' then 'Order delivered'
      when 'cancelled' then 'Order cancelled'
      else 'Order updated'
    end;
    notification_body := case new.status
      when 'processing' then 'Your garments have been picked up and are now being professionally cleaned.'
      when 'out-for-delivery' then 'Your clean laundry is on its way back to you.'
      when 'delivered' then 'Order ' || new.id || ' has been delivered. Thank you for choosing Dr Laundry.'
      when 'cancelled' then 'Order ' || new.id || ' has been cancelled.'
      else 'There is a new update for order ' || new.id || '.'
    end;
    notification_key := 'order:' || new.id || ':status:' || new.status;
  else
    return new;
  end if;

  insert into public.notifications (user_id, title, body, kind, order_id, route, dedupe_key)
  values (new.user_id, notification_title, notification_body, 'order', new.id, '/track-order', notification_key)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  return new;
end;
$$;

drop trigger if exists on_order_notification on public.orders;
create trigger on_order_notification
after insert or update of status, payment_status on public.orders
for each row execute function public.create_order_notification();

revoke all on function public.create_order_notification() from public, anon, authenticated;

create or replace function private.dispatch_native_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  messages jsonb;
  request_id bigint;
begin
  select jsonb_agg(
    jsonb_build_object(
      'to', pt.expo_push_token,
      'title', new.title,
      'body', new.body,
      'sound', 'default',
      'priority', 'high',
      'channelId', 'order-updates',
      'data', jsonb_build_object(
        'notificationId', new.id
      )
    )
  )
  into messages
  from public.push_tokens pt
  where pt.user_id = new.user_id
    and pt.enabled
    and (
      pt.expo_push_token like 'ExponentPushToken[%]'
      or pt.expo_push_token like 'ExpoPushToken[%]'
    );

  if messages is null or jsonb_array_length(messages) = 0 then
    return new;
  end if;

  select net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    ),
    body := messages,
    timeout_milliseconds := 5000
  ) into request_id;

  update public.notifications
  set push_requested_at = timezone('utc'::text, now()),
      push_request_id = request_id
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists dispatch_native_push_after_notification on public.notifications;
create trigger dispatch_native_push_after_notification
after insert on public.notifications
for each row execute function private.dispatch_native_push();

create or replace function private.enqueue_readiness_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_count integer := 0;
begin
  with due_orders as (
    update public.orders
    set readiness_notified_at = timezone('utc'::text, now())
    where payment_status = 'paid'
      and status = 'processing'
      and readiness_notified_at is null
      and timezone('utc'::text, now()) >= created_at +
        case when is_express then interval '12 hours' else interval '60 hours' end
    returning id, user_id, is_express
  )
  insert into public.notifications (user_id, title, body, kind, order_id, route, dedupe_key)
  select
    user_id,
    case when is_express then 'Express laundry ready' else 'Your laundry is ready' end,
    'Your laundry is ready and will be on its way back to you shortly.',
    'order',
    id,
    '/track-order',
    'order:' || id || ':ready'
  from due_orders
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function private.enqueue_readiness_notifications() from public, anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'dr-laundry-readiness-notifications';
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
  perform cron.schedule(
    'dr-laundry-readiness-notifications',
    '*/15 * * * *',
    'select private.enqueue_readiness_notifications();'
  );
end $$;
