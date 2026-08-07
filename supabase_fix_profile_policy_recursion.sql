-- Run this migration once in the Supabase SQL Editor for an existing project.
-- It fixes: infinite recursion detected in policy for relation "profiles".

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

drop policy if exists "Drivers can view customer profiles" on public.profiles;
create policy "Drivers can view customer profiles"
  on public.profiles for select
  using (public.is_staff());

drop policy if exists "Drivers can view all orders" on public.orders;
create policy "Drivers can view all orders"
  on public.orders for select
  using (public.is_staff());

drop policy if exists "Drivers can update order status or claim tasks" on public.orders;
create policy "Drivers can update order status or claim tasks"
  on public.orders for update
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists "Drivers/Admins can view all order items" on public.order_items;
create policy "Drivers/Admins can view all order items"
  on public.order_items for select
  using (public.is_staff());

drop policy if exists "Drivers and admins can insert tracking logs" on public.order_tracking;
create policy "Drivers and admins can insert tracking logs"
  on public.order_tracking for insert
  with check (public.is_staff());

drop policy if exists "Drivers and admins can view all tracking logs" on public.order_tracking;
create policy "Drivers and admins can view all tracking logs"
  on public.order_tracking for select
  using (public.is_staff());
