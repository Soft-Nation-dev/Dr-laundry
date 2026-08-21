-- Secure, real-time driver tracking for active pickup and delivery tasks.

create table if not exists public.driver_locations_current (
  order_id text primary key references public.orders(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision check (accuracy_meters is null or accuracy_meters between 0 and 5000),
  heading_degrees double precision check (heading_degrees is null or heading_degrees between 0 and 360),
  speed_mps double precision check (speed_mps is null or speed_mps between 0 and 100),
  recorded_at timestamp with time zone not null,
  updated_at timestamp with time zone not null default timezone('utc'::text, now())
);

create table if not exists public.driver_location_history (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy_meters double precision check (accuracy_meters is null or accuracy_meters between 0 and 5000),
  heading_degrees double precision check (heading_degrees is null or heading_degrees between 0 and 360),
  speed_mps double precision check (speed_mps is null or speed_mps between 0 and 100),
  recorded_at timestamp with time zone not null,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists driver_locations_current_driver_idx
  on public.driver_locations_current (driver_id, updated_at desc);

create index if not exists driver_location_history_order_recorded_idx
  on public.driver_location_history (order_id, recorded_at desc);

create index if not exists driver_location_history_driver_recorded_idx
  on public.driver_location_history (driver_id, recorded_at desc);

alter table public.driver_locations_current enable row level security;
alter table public.driver_location_history enable row level security;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.can_access_tracking_order(p_order_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and (
        o.user_id = (select auth.uid())
        or o.driver_id = (select auth.uid())
        or exists (
          select 1
          from public.profiles p
          where p.id = (select auth.uid())
            and p.role in ('admin', 'superadmin')
        )
      )
  );
$$;

revoke all on function private.can_access_tracking_order(text) from public, anon;
grant execute on function private.can_access_tracking_order(text) to authenticated;

drop policy if exists "Order participants can view current driver location"
  on public.driver_locations_current;
create policy "Order participants can view current driver location"
  on public.driver_locations_current for select
  to authenticated
  using ((select private.can_access_tracking_order(order_id)));

drop policy if exists "Order participants can view driver location history"
  on public.driver_location_history;
create policy "Order participants can view driver location history"
  on public.driver_location_history for select
  to authenticated
  using ((select private.can_access_tracking_order(order_id)));

grant select on public.driver_locations_current to authenticated;
grant select on public.driver_location_history to authenticated;
revoke insert, update, delete on public.driver_locations_current from anon, authenticated;
revoke insert, update, delete on public.driver_location_history from anon, authenticated;

create or replace function public.publish_driver_location(
  p_order_id text,
  p_latitude double precision,
  p_longitude double precision,
  p_accuracy_meters double precision default null,
  p_heading_degrees double precision default null,
  p_speed_mps double precision default null,
  p_recorded_at timestamp with time zone default timezone('utc'::text, now())
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  safe_recorded_at timestamp with time zone;
  result jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if p_latitude not between -90 and 90
     or p_longitude not between -180 and 180
     or (p_accuracy_meters is not null and p_accuracy_meters not between 0 and 5000)
     or (p_heading_degrees is not null and p_heading_degrees not between 0 and 360)
     or (p_speed_mps is not null and p_speed_mps not between 0 and 100) then
    raise exception 'Invalid location payload' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and o.driver_id = caller_id
      and o.driver_task_status in ('accepted', 'arrived')
      and o.status in ('pickup-confirmed', 'out-for-delivery')
  ) then
    raise exception 'No active assigned journey was found' using errcode = '42501';
  end if;

  safe_recorded_at := least(
    timezone('utc'::text, now()) + interval '1 minute',
    greatest(
      coalesce(p_recorded_at, timezone('utc'::text, now())),
      timezone('utc'::text, now()) - interval '5 minutes'
    )
  );

  insert into public.driver_locations_current (
    order_id, driver_id, latitude, longitude, accuracy_meters,
    heading_degrees, speed_mps, recorded_at, updated_at
  ) values (
    p_order_id, caller_id, p_latitude, p_longitude, p_accuracy_meters,
    p_heading_degrees, p_speed_mps, safe_recorded_at, timezone('utc'::text, now())
  )
  on conflict (order_id) do update set
    driver_id = excluded.driver_id,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    accuracy_meters = excluded.accuracy_meters,
    heading_degrees = excluded.heading_degrees,
    speed_mps = excluded.speed_mps,
    recorded_at = excluded.recorded_at,
    updated_at = excluded.updated_at
  where excluded.recorded_at >= public.driver_locations_current.recorded_at;

  if not exists (
    select 1
    from public.driver_location_history h
    where h.order_id = p_order_id
      and h.created_at > timezone('utc'::text, now()) - interval '10 seconds'
  ) then
    insert into public.driver_location_history (
      order_id, driver_id, latitude, longitude, accuracy_meters,
      heading_degrees, speed_mps, recorded_at
    ) values (
      p_order_id, caller_id, p_latitude, p_longitude, p_accuracy_meters,
      p_heading_degrees, p_speed_mps, safe_recorded_at
    );
  end if;

  select to_jsonb(location_row)
  into result
  from public.driver_locations_current location_row
  where location_row.order_id = p_order_id;

  return result;
end;
$$;

revoke all on function public.publish_driver_location(
  text, double precision, double precision, double precision,
  double precision, double precision, timestamp with time zone
) from public, anon;
grant execute on function public.publish_driver_location(
  text, double precision, double precision, double precision,
  double precision, double precision, timestamp with time zone
) to authenticated;

create or replace function public.broadcast_driver_location()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform realtime.broadcast_changes(
    'tracking:' || new.order_id,
    'location',
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return null;
end;
$$;

revoke all on function public.broadcast_driver_location() from public, anon, authenticated;

drop trigger if exists broadcast_driver_location_after_write
  on public.driver_locations_current;
create trigger broadcast_driver_location_after_write
after insert or update on public.driver_locations_current
for each row execute function public.broadcast_driver_location();

drop policy if exists "Order participants can receive tracking broadcasts"
  on realtime.messages;
create policy "Order participants can receive tracking broadcasts"
  on realtime.messages for select
  to authenticated
  using (
    extension = 'broadcast'
    and topic like 'tracking:%'
    and (select private.can_access_tracking_order(substr(topic, 10)))
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'driver_locations_current'
  ) then
    alter publication supabase_realtime add table public.driver_locations_current;
  end if;
end;
$$;
