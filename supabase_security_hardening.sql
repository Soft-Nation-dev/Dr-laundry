-- Keep the staff role helper outside the exposed public API schema while
-- retaining SECURITY DEFINER to avoid recursive profile RLS evaluation.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role in ('driver', 'admin')
  );
$$;

revoke all on function private.is_staff() from public, anon;
grant execute on function private.is_staff() to authenticated;

alter policy "Drivers can view customer profiles"
  on public.profiles using (private.is_staff());
alter policy "Drivers can view all orders"
  on public.orders using (private.is_staff());
alter policy "Drivers can update order status or claim tasks"
  on public.orders using (private.is_staff()) with check (private.is_staff());
alter policy "Drivers/Admins can view all order items"
  on public.order_items using (private.is_staff());
alter policy "Drivers and admins can insert tracking logs"
  on public.order_tracking with check (private.is_staff());
alter policy "Drivers and admins can view all tracking logs"
  on public.order_tracking using (private.is_staff());

drop function if exists public.is_staff();

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.create_order_notification() from public, anon, authenticated;
