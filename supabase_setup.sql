-- ========================================================
-- DR LAUNDRY DATABASE SCHEMA & RLS SETUP
-- Execute this script in your Supabase SQL Editor
-- ========================================================

-- Enable UUID extension if not enabled
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  phone_number text,
  address text,
  avatar_url text,
  role text default 'customer' check (role in ('customer', 'driver', 'admin')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS on Profiles
alter table public.profiles enable row level security;

-- 2. ORDERS TABLE
create table public.orders (
  id text primary key, -- Custom ID like 'DL-123456'
  user_id uuid references auth.users on delete cascade not null,
  address text not null,
  note text,
  mode text not null,
  pickup_day text not null,
  pickup_window text not null,
  delivery_day text,
  delivery_window text,
  pickup_at timestamp with time zone not null,
  delivery_at timestamp with time zone,
  promised_delivery_at timestamp with time zone not null,
  actual_delivery_at timestamp with time zone,
  is_express boolean not null default false,
  status text not null default 'pickup-confirmed' check (status in ('pickup-confirmed', 'processing', 'out-for-delivery', 'delivered')),
  paid_amount numeric not null,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed')),
  payment_reference text,
  driver_id uuid references auth.users on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS on Orders
alter table public.orders enable row level security;

-- 3. ORDER ITEMS TABLE
create table public.order_items (
  id uuid default gen_random_uuid() primary key,
  order_id text references public.orders(id) on delete cascade not null,
  item_id text not null,
  name text not null,
  unit_price numeric not null,
  quantity integer not null,
  category text not null,
  mode text
);

-- Enable RLS on Order Items
alter table public.order_items enable row level security;

-- 4. ORDER TRACKING LOGS TABLE
create table public.order_tracking (
  id uuid default gen_random_uuid() primary key,
  order_id text references public.orders(id) on delete cascade not null,
  status text not null,
  note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on Order Tracking
alter table public.order_tracking enable row level security;

-- 5. NOTIFICATIONS TABLE
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'general',
  order_id text references public.orders(id) on delete cascade,
  route text,
  read_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

alter table public.notifications enable row level security;

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ========================================================

-- SECURITY DEFINER prevents a profiles policy from querying profiles through
-- RLS again, which would otherwise cause PostgreSQL's infinite recursion error.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role in ('driver', 'admin')
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

-- PROFILES POLICIES
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can create their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Drivers can view customer profiles"
  on public.profiles for select
  using (public.is_staff());

-- ORDERS POLICIES
create policy "Customers can view their own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Customers can create their own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

create policy "Customers can update their own pending orders"
  on public.orders for update
  using (auth.uid() = user_id and status = 'pickup-confirmed')
  with check (auth.uid() = user_id and status = 'pickup-confirmed');

create policy "Drivers can view all orders"
  on public.orders for select
  using (public.is_staff());

create policy "Drivers can update order status or claim tasks"
  on public.orders for update
  using (public.is_staff())
  with check (public.is_staff());

-- ORDER ITEMS POLICIES
create policy "Customers can view their own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id and orders.user_id = auth.uid()
    )
  );

create policy "Customers can insert their own order items"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders
      where orders.id = order_items.order_id and orders.user_id = auth.uid()
    )
  );

create policy "Drivers/Admins can view all order items"
  on public.order_items for select
  using (public.is_staff());

-- ORDER TRACKING POLICIES
create policy "Customers can view tracking logs for their orders"
  on public.order_tracking for select
  using (
    exists (
      select 1 from public.orders
      where orders.id = order_tracking.order_id and orders.user_id = auth.uid()
    )
  );

create policy "Drivers and admins can insert tracking logs"
  on public.order_tracking for insert
  with check (public.is_staff());

create policy "Drivers and admins can view all tracking logs"
  on public.order_tracking for select
  using (public.is_staff());

create policy "Users can view their notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ========================================================
-- AUTOMATIC PROFILE CREATION ON USER SIGNUP
-- ========================================================

-- Trigger function to create a profile automatically when a new user signs up in auth.users
create or replace function public.handle_new_user()
returns trigger as $$
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
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger definition
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.create_order_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_title text;
  notification_body text;
begin
  if tg_op = 'INSERT' then
    notification_title := 'Pickup confirmed';
    notification_body := 'Your order ' || new.id || ' is booked and awaiting pickup.';
  elsif old.status is distinct from new.status then
    notification_title := case new.status
      when 'processing' then 'Laundry in progress'
      when 'out-for-delivery' then 'Fresh laundry on the way'
      when 'delivered' then 'Order delivered'
      else 'Order updated'
    end;
    notification_body := 'There is a new update for order ' || new.id || '.';
  else
    return new;
  end if;

  insert into public.notifications (user_id, title, body, kind, order_id, route)
  values (new.user_id, notification_title, notification_body, 'order', new.id, '/track-order');
  return new;
end;
$$;

create trigger on_order_notification
  after insert or update of status on public.orders
  for each row execute procedure public.create_order_notification();
