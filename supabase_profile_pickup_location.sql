-- Stores a customer's verified pickup location from registration so New Order
-- can prefill a real address without geocoding the same plain text each time.

alter table public.profiles
  add column if not exists address_place_id text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_latitude_valid'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_latitude_valid
      check (latitude is null or latitude between -90 and 90);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_longitude_valid'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_longitude_valid
      check (longitude is null or longitude between -180 and 180);
  end if;
end
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare assigned_role text;
begin
  assigned_role := case
    when lower(new.email) in ('ifeanyieee8105@gmail.com', 'drlaundry6@gmail.com') then 'superadmin'
    else 'customer'
  end;

  insert into public.profiles (
    id,
    email,
    name,
    phone_number,
    address,
    address_place_id,
    latitude,
    longitude,
    role
  )
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(
      new.raw_user_meta_data->>'phone_number',
      new.raw_user_meta_data->>'phoneNumber',
      ''
    ),
    coalesce(new.raw_user_meta_data->>'address', ''),
    nullif(new.raw_user_meta_data->>'address_place_id', ''),
    case
      when jsonb_typeof(new.raw_user_meta_data->'latitude') = 'number'
        then (new.raw_user_meta_data->>'latitude')::double precision
      else null
    end,
    case
      when jsonb_typeof(new.raw_user_meta_data->'longitude') = 'number'
        then (new.raw_user_meta_data->>'longitude')::double precision
      else null
    end,
    assigned_role
  )
  on conflict (id) do update set
    email = excluded.email,
    name = excluded.name,
    phone_number = excluded.phone_number,
    address = excluded.address,
    address_place_id = excluded.address_place_id,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    role = case
      when excluded.role = 'superadmin' then 'superadmin'
      else public.profiles.role
    end,
    updated_at = timezone('utc'::text, now());

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
