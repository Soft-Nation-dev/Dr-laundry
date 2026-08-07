-- Run once in the Supabase SQL Editor for an existing Dr Laundry project.
-- It keeps profile phone numbers in sync with signup metadata and backfills
-- accounts created before phone persistence was normalized.

alter table public.profiles
  add column if not exists phone_number text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, phone_number, address, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(
      new.raw_user_meta_data->>'phone_number',
      new.raw_user_meta_data->>'phoneNumber',
      ''
    ),
    coalesce(new.raw_user_meta_data->>'address', ''),
    'customer'
  )
  on conflict (id) do update
  set
    name = excluded.name,
    phone_number = excluded.phone_number,
    address = excluded.address,
    updated_at = timezone('utc'::text, now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'Users can create their own profile'
  ) then
    create policy "Users can create their own profile"
      on public.profiles for insert
      with check (auth.uid() = id);
  end if;
end
$$;

update public.profiles as profile
set
  phone_number = coalesce(
    auth_user.raw_user_meta_data->>'phone_number',
    auth_user.raw_user_meta_data->>'phoneNumber',
    profile.phone_number
  ),
  updated_at = timezone('utc'::text, now())
from auth.users as auth_user
where profile.id = auth_user.id
  and coalesce(profile.phone_number, '') = '';
