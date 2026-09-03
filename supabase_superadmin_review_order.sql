-- Superadmin-only, disposable driver-review workflow.
-- Review rows remain immutable test records and are excluded from revenue.

alter table public.orders
  add column if not exists is_review_order boolean not null default false;

create index if not exists orders_review_order_idx
  on public.orders (is_review_order, created_at desc)
  where is_review_order;

-- Use a security-definer lookup so related-table policies cannot accidentally
-- reveal review rows through a permissive staff policy.
create or replace function private.is_review_order_id(p_order_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select o.is_review_order
    from public.orders o
    where o.id = p_order_id
  ), false);
$$;

revoke all on function private.is_review_order_id(text) from public, anon, authenticated;
grant execute on function private.is_review_order_id(text) to authenticated;

drop policy if exists "Review orders are superadmin only" on public.orders;
create policy "Review orders are superadmin only"
on public.orders as restrictive for select to authenticated
using (
  not is_review_order
  or (select private.current_app_role()) = 'superadmin'
);

drop policy if exists "Only superadmins can update review orders" on public.orders;
create policy "Only superadmins can update review orders"
on public.orders as restrictive for update to authenticated
using (
  not is_review_order
  or (select private.current_app_role()) = 'superadmin'
)
with check (
  not is_review_order
  or (select private.current_app_role()) = 'superadmin'
);

drop policy if exists "Only superadmins can create review orders" on public.orders;
create policy "Only superadmins can create review orders"
on public.orders as restrictive for insert to authenticated
with check (
  not is_review_order
  or (select private.current_app_role()) = 'superadmin'
);

drop policy if exists "Review order items are superadmin only" on public.order_items;
create policy "Review order items are superadmin only"
on public.order_items as restrictive for select to authenticated
using (
  not (select private.is_review_order_id(order_id))
  or (select private.current_app_role()) = 'superadmin'
);

drop policy if exists "Review tracking is superadmin only" on public.order_tracking;
create policy "Review tracking is superadmin only"
on public.order_tracking as restrictive for select to authenticated
using (
  not (select private.is_review_order_id(order_id))
  or (select private.current_app_role()) = 'superadmin'
);

drop policy if exists "Only superadmins can add review tracking" on public.order_tracking;
create policy "Only superadmins can add review tracking"
on public.order_tracking as restrictive for insert to authenticated
with check (
  not (select private.is_review_order_id(order_id))
  or (select private.current_app_role()) = 'superadmin'
);

drop policy if exists "Review task history is superadmin only" on public.order_driver_task_history;
create policy "Review task history is superadmin only"
on public.order_driver_task_history as restrictive for select to authenticated
using (
  not (select private.is_review_order_id(order_id))
  or (select private.current_app_role()) = 'superadmin'
);

create or replace function private.create_review_order_for(p_owner uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id text :=
    'REVIEW-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS')
    || '-' || upper(substr(replace(p_owner::text, '-', ''), 1, 6));
  v_owner_name text;
  v_pickup_at timestamptz :=
    date_trunc('day', now() + interval '1 day') + interval '8 hours';
begin
  select p.name into v_owner_name
  from public.profiles p
  where p.id = p_owner and p.role = 'superadmin';

  if v_owner_name is null then
    raise exception 'A superadmin profile is required for a review order'
      using errcode = '42501';
  end if;

  -- Keep earlier review attempts as immutable records, but remove them from
  -- all active queues before creating a fresh workflow.
  update public.orders
  set archived_at = now(),
      archived_reason = 'Superseded review workflow',
      available_to_drivers = false,
      driver_id = null,
      updated_at = now()
  where is_review_order
    and archived_at is null;

  insert into public.orders (
    id, user_id, address, note, mode, pickup_day, pickup_window,
    pickup_at, promised_delivery_at, is_express, turnaround_hours,
    status, paid_amount, payment_status, payment_method,
    driver_id, driver_task_type, driver_task_status,
    latitude, longitude, available_to_drivers, availability_source,
    available_at, available_by, available_by_name, available_by_role,
    mode_subtotal, pickup_delivery_fee, shared_pickup_discount,
    express_premium, express_delivery_fee, delivery_confirmation_status,
    is_test_order, is_review_order, archived_at, archived_reason,
    created_at, updated_at
  ) values (
    v_order_id, p_owner,
    '12 Review Avenue, Independence Layout, Enugu',
    'Google Play driver workflow review — safe test order',
    'wash-iron', 'Tomorrow', '8:00 AM - 10:00 AM',
    v_pickup_at, v_pickup_at + interval '72 hours',
    false, 72, 'pickup-confirmed', 5700, 'paid', 'pay_on_delivery',
    null, 'pickup', 'available', 6.4474, 7.4988,
    true, 'staff', now(), p_owner,
    v_owner_name || ' · Review', 'superadmin',
    4200, 1500, 0, 0, 0, 'not_required',
    true, true, null, null, now(), now()
  );

  insert into public.order_items (
    order_id, item_id, name, unit_price, quantity, category, mode
  ) values
    (v_order_id, 'review-polos', 'Polos', 1500, 2, 'regular', 'wash-iron'),
    (v_order_id, 'review-trousers', 'Trousers', 1200, 1, 'regular', 'wash-iron');

  return v_order_id;
end;
$$;

revoke all on function private.create_review_order_for(uuid)
  from public, anon, authenticated;

create or replace function public.create_review_order()
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null
     or (select private.current_app_role()) <> 'superadmin' then
    raise exception 'Only superadmins can create the review workflow'
      using errcode = '42501';
  end if;

  return private.create_review_order_for((select auth.uid()));
end;
$$;

revoke all on function public.create_review_order() from public, anon;
grant execute on function public.create_review_order() to authenticated;

-- Make one review workflow immediately available to both superadmins.
do $$
declare
  v_owner uuid;
begin
  select id into v_owner
  from public.profiles
  where lower(email) = 'drlaundry6@gmail.com'
    and role = 'superadmin'
  limit 1;

  if v_owner is not null
     and not exists (
       select 1 from public.orders
       where is_review_order and archived_at is null
     ) then
    perform private.create_review_order_for(v_owner);
  end if;
end;
$$;
