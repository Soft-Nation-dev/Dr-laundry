-- Order-flow polish: shared pickup pricing, customer-confirmed delivery,
-- bundled pickup lifecycle, and richer customer notifications.

alter table public.orders
  add column if not exists address_place_id text,
  add column if not exists mode_subtotal numeric,
  add column if not exists pickup_delivery_fee numeric not null default 1500,
  add column if not exists shared_pickup_discount numeric not null default 0,
  add column if not exists shared_pickup_order_id text,
  add column if not exists express_premium numeric not null default 0,
  add column if not exists express_delivery_fee numeric not null default 0,
  add column if not exists delivery_confirmation_status text not null default 'not_required',
  add column if not exists delivery_address text,
  add column if not exists delivery_address_place_id text,
  add column if not exists delivery_latitude double precision,
  add column if not exists delivery_longitude double precision,
  add column if not exists delivery_confirmed_at timestamptz;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (
  status in ('pickup-confirmed', 'processing', 'ready-for-delivery', 'out-for-delivery', 'delivered', 'cancelled')
);
alter table public.orders drop constraint if exists orders_availability_source_check;
alter table public.orders add constraint orders_availability_source_check check (
  availability_source is null or availability_source in ('auto', 'staff', 'customer')
);
alter table public.orders drop constraint if exists orders_available_by_role_check;
alter table public.orders add constraint orders_available_by_role_check check (
  available_by_role is null or available_by_role in ('system', 'customer', 'admin', 'superadmin')
);
alter table public.order_staff_events drop constraint if exists order_staff_events_action_check;
alter table public.order_staff_events add constraint order_staff_events_action_check check (
  action in ('auto_available', 'made_available', 'cancelled', 'unassigned', 'ready_for_delivery',
             'delivery_confirmed', 'contact_call', 'contact_sms')
);
alter table public.order_staff_events drop constraint if exists order_staff_events_actor_role_check;
alter table public.order_staff_events add constraint order_staff_events_actor_role_check check (
  actor_role in ('system', 'customer', 'driver', 'admin', 'superadmin')
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_shared_pickup_order_id_fkey'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_shared_pickup_order_id_fkey
      foreign key (shared_pickup_order_id) references public.orders(id) on delete restrict;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_shared_pickup_not_self_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_shared_pickup_not_self_check
      check (shared_pickup_order_id is null or shared_pickup_order_id <> id);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_pricing_components_nonnegative_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_pricing_components_nonnegative_check
      check (
        coalesce(mode_subtotal, 0) >= 0 and pickup_delivery_fee >= 0 and
        shared_pickup_discount >= 0 and express_premium >= 0 and express_delivery_fee >= 0
      );
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'orders_delivery_confirmation_status_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders add constraint orders_delivery_confirmation_status_check
      check (delivery_confirmation_status in ('not_required', 'pending', 'confirmed'));
  end if;
end $$;

create index if not exists orders_shared_pickup_lookup_idx
  on public.orders(user_id, address_place_id, pickup_day, pickup_window, created_at)
  where payment_status = 'paid' and status = 'pickup-confirmed' and pickup_completed_at is null;
create index if not exists orders_shared_pickup_order_id_idx
  on public.orders(shared_pickup_order_id) where shared_pickup_order_id is not null;
create index if not exists orders_delivery_confirmation_idx
  on public.orders(user_id, delivery_confirmation_status, status, created_at desc);

create or replace function public.create_pending_order(
  p_order jsonb,
  p_items jsonb,
  p_worker_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  order_id text := p_order->>'id';
  owner_id uuid := (p_order->>'user_id')::uuid;
  requested_method text := coalesce(p_order->>'payment_method', 'paystack');
  requested_anchor_id text := nullif(p_order->>'shared_pickup_order_id', '');
  verified_anchor public.orders%rowtype;
  expires_at timestamptz;
  initial_status text;
  item jsonb;
  supplied_mode_subtotal numeric := (p_order->>'mode_subtotal')::numeric;
  supplied_pickup_fee numeric := (p_order->>'pickup_delivery_fee')::numeric;
  supplied_discount numeric := coalesce((p_order->>'shared_pickup_discount')::numeric, 0);
  supplied_express_premium numeric := coalesce((p_order->>'express_premium')::numeric, 0);
  supplied_express_delivery_fee numeric := coalesce((p_order->>'express_delivery_fee')::numeric, 0);
  supplied_total numeric := (p_order->>'paid_amount')::numeric;
  expected_total numeric;
begin
  if not private.valid_payment_worker_secret(p_worker_secret) then
    raise exception 'Invalid payment worker credentials' using errcode = '42501';
  end if;
  if auth.uid() is null or auth.uid() <> owner_id then
    raise exception 'Order owner does not match the authenticated user' using errcode = '42501';
  end if;
  if requested_method not in ('paystack', 'pay_on_delivery') then
    raise exception 'Unsupported payment method' using errcode = '22023';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one order item is required' using errcode = '22023';
  end if;
  if nullif(trim(coalesce(p_order->>'address_place_id', '')), '') is null then
    raise exception 'A verified pickup address is required' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 7291));

  if requested_method = 'pay_on_delivery' and exists (
    select 1 from public.orders
    where user_id = owner_id
      and (payment_status = 'paid' or payment_method = 'pay_on_delivery')
  ) then
    raise exception 'Pay on delivery is available only for the first order' using errcode = '23505';
  end if;

  if requested_anchor_id is not null then
    select * into verified_anchor
    from public.orders
    where id = requested_anchor_id
      and user_id = owner_id
      and payment_status = 'paid'
      and status = 'pickup-confirmed'
      and pickup_completed_at is null
      and shared_pickup_order_id is null
      and address_place_id = p_order->>'address_place_id'
      and pickup_day = p_order->>'pickup_day'
      and pickup_window = p_order->>'pickup_window'
    for update;
    if not found then
      raise exception 'The shared pickup is no longer eligible. Refresh checkout and try again.' using errcode = '40001';
    end if;
    if abs(supplied_pickup_fee) > 0.01 or abs(supplied_discount - 1500) > 0.01 then
      raise exception 'Shared pickup pricing does not match the secured fee' using errcode = '22023';
    end if;
  else
    if abs(supplied_pickup_fee - 1500) > 0.01 or abs(supplied_discount) > 0.01 then
      raise exception 'Pickup pricing does not match the secured fee' using errcode = '22023';
    end if;
  end if;

  if supplied_mode_subtotal < 0 or supplied_express_premium < 0 or supplied_express_delivery_fee < 0 then
    raise exception 'Pricing components cannot be negative' using errcode = '22023';
  end if;
  expected_total := supplied_mode_subtotal + supplied_pickup_fee + supplied_express_premium + supplied_express_delivery_fee;
  if abs(expected_total - supplied_total) > 0.01 then
    raise exception 'Order total does not match its secured pricing components' using errcode = '22023';
  end if;

  if requested_method = 'paystack' then
    if nullif(p_order->>'payment_reference', '') is null or
       nullif(p_order->>'payment_authorization_url', '') is null then
      raise exception 'Paystack checkout details are required' using errcode = '22023';
    end if;
    expires_at := now() + interval '30 minutes';
    initial_status := 'pending';
  else
    expires_at := null;
    initial_status := 'unpaid';
  end if;

  insert into public.orders (
    id, user_id, address, address_place_id, latitude, longitude, note, mode,
    pickup_day, pickup_window, delivery_day, delivery_window,
    pickup_at, delivery_at, promised_delivery_at, is_express,
    turnaround_hours, status, paid_amount, payment_status, payment_method,
    payment_reference, payment_expires_at, payment_authorization_url,
    mode_subtotal, pickup_delivery_fee, shared_pickup_discount,
    shared_pickup_order_id, express_premium, express_delivery_fee
  ) values (
    order_id, owner_id, p_order->>'address', p_order->>'address_place_id',
    (p_order->>'latitude')::double precision, (p_order->>'longitude')::double precision,
    coalesce(p_order->>'note', ''), p_order->>'mode',
    p_order->>'pickup_day', p_order->>'pickup_window', p_order->>'delivery_day',
    p_order->>'delivery_window', (p_order->>'pickup_at')::timestamptz,
    nullif(p_order->>'delivery_at', '')::timestamptz, (p_order->>'promised_delivery_at')::timestamptz,
    (p_order->>'is_express')::boolean, (p_order->>'turnaround_hours')::integer,
    'pickup-confirmed', supplied_total, initial_status, requested_method,
    case when requested_method = 'paystack' then p_order->>'payment_reference' else null end,
    expires_at,
    case when requested_method = 'paystack' then p_order->>'payment_authorization_url' else null end,
    supplied_mode_subtotal, supplied_pickup_fee, supplied_discount,
    requested_anchor_id, supplied_express_premium, supplied_express_delivery_fee
  );

  if requested_method = 'paystack' then
    insert into public.order_payment_attempts(reference, order_id, amount_kobo, authorization_url, expires_at)
    values (
      p_order->>'payment_reference', order_id, round(supplied_total * 100)::bigint,
      p_order->>'payment_authorization_url', expires_at
    );
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce((item->>'quantity')::integer, 0) <= 0 or coalesce((item->>'unit_price')::numeric, -1) < 0 then
      raise exception 'Invalid order item pricing' using errcode = '22023';
    end if;
    insert into public.order_items(order_id, item_id, name, unit_price, quantity, category, mode)
    values (
      order_id, item->>'item_id', item->>'name', (item->>'unit_price')::numeric,
      (item->>'quantity')::integer, item->>'category', item->>'mode'
    );
  end loop;

  return jsonb_build_object(
    'orderId', order_id, 'paymentMethod', requested_method,
    'paymentStatus', initial_status, 'paymentExpiresAt', expires_at,
    'sharedPickupOrderId', requested_anchor_id, 'sharedPickupDiscount', supplied_discount
  );
end;
$$;

revoke all on function public.create_pending_order(jsonb, jsonb, text) from public, anon, authenticated;
grant execute on function public.create_pending_order(jsonb, jsonb, text) to authenticated;

create or replace function public.auto_release_paid_order()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status = 'paid' and new.payment_method = 'paystack' and
     new.status = 'pickup-confirmed' and not new.available_to_drivers and
     new.shared_pickup_order_id is null then
    update public.orders
    set available_to_drivers = true,
        availability_source = 'auto', available_at = coalesce(new.payment_paid_at, now()),
        available_by = null, available_by_name = 'Auto · Paystack', available_by_role = 'system',
        updated_at = now()
    where id = new.id and not available_to_drivers;
    if found then
      insert into public.order_staff_events(order_id, action, actor_name, actor_role, details)
      values (new.id, 'auto_available', 'Auto · Paystack', 'system', jsonb_build_object('payment_status', 'paid'));
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.auto_release_paid_order() from public, anon, authenticated;

create or replace function public.sync_order_driver_task()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.driver_task_type := case when new.status in ('ready-for-delivery', 'out-for-delivery') then 'delivery' else 'pickup' end;
    new.driver_task_status := case
      when new.status in ('processing', 'delivered', 'cancelled') then 'completed'
      when new.driver_id is not null then 'accepted'
      when new.available_to_drivers then 'available'
      else null
    end;
  elsif new.status is distinct from old.status then
    if new.status = 'pickup-confirmed' then
      new.driver_task_type := 'pickup';
      new.driver_task_status := case
        when new.driver_id is not null then 'accepted'
        when new.available_to_drivers then 'available'
        else null end;
    elsif new.status = 'ready-for-delivery' then
      new.driver_id := null;
      new.driver_task_type := 'delivery';
      new.driver_task_status := case when new.available_to_drivers then 'available' else null end;
      new.driver_arrived_at := null;
    elsif new.status = 'out-for-delivery' then
      new.driver_task_type := 'delivery';
      new.driver_task_status := case
        when new.driver_id is not null then coalesce(new.driver_task_status, 'accepted')
        when new.available_to_drivers then 'available'
        else null end;
    elsif new.status in ('processing', 'delivered', 'cancelled') then
      new.driver_task_status := 'completed';
      if new.status = 'cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;
    end if;
  elsif new.available_to_drivers is distinct from old.available_to_drivers or new.driver_id is distinct from old.driver_id then
    if new.status in ('pickup-confirmed', 'ready-for-delivery', 'out-for-delivery') then
      new.driver_task_status := case
        when new.driver_id is not null then coalesce(new.driver_task_status, 'accepted')
        when new.available_to_drivers then 'available'
        else null end;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_order_driver_task() from public, anon, authenticated;

create or replace function private.propagate_shared_pickup_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.shared_pickup_order_id is not null then return new; end if;
  if new.driver_id is distinct from old.driver_id or new.driver_task_status is distinct from old.driver_task_status then
    update public.orders
    set driver_id = new.driver_id,
        driver_task_status = case when new.status = 'processing' then 'completed' else new.driver_task_status end,
        available_to_drivers = false,
        updated_at = now()
    where shared_pickup_order_id = new.id
      and status = 'pickup-confirmed' and payment_status in ('paid', 'unpaid');
  end if;
  if new.status = 'processing' and old.status is distinct from 'processing' then
    update public.orders
    set status = 'processing', driver_id = new.driver_id, driver_task_type = 'pickup',
        driver_task_status = 'completed', available_to_drivers = false,
        pickup_completed_at = coalesce(new.pickup_completed_at, now()), updated_at = now()
    where shared_pickup_order_id = new.id
      and status = 'pickup-confirmed' and payment_status in ('paid', 'unpaid');
  end if;
  return new;
end;
$$;
drop trigger if exists propagate_shared_pickup_lifecycle_after_update on public.orders;
create trigger propagate_shared_pickup_lifecycle_after_update
after update of driver_id, driver_task_status, status, pickup_completed_at on public.orders
for each row execute function private.propagate_shared_pickup_lifecycle();
revoke all on function private.propagate_shared_pickup_lifecycle() from public, anon, authenticated;

create or replace function public.finalize_order_payment(
  p_reference text, p_amount_kobo bigint, p_currency text,
  p_paid_at timestamptz, p_worker_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.order_payment_attempts%rowtype;
  target public.orders%rowtype;
  anchor public.orders%rowtype;
  expected_kobo bigint;
  finalized_status text := 'pickup-confirmed';
begin
  if not private.valid_payment_worker_secret(p_worker_secret) then
    raise exception 'Invalid payment worker credentials' using errcode = '42501';
  end if;
  select * into attempt from public.order_payment_attempts where reference = p_reference for update;
  if not found then return jsonb_build_object('finalized', false, 'reason', 'not_found'); end if;
  select * into target from public.orders where id = attempt.order_id for update;
  if target.payment_status = 'paid' then
    return jsonb_build_object('finalized', true, 'reason', 'already_paid', 'orderId', target.id);
  end if;
  expected_kobo := round(target.paid_amount * 100)::bigint;
  if upper(coalesce(p_currency, '')) <> 'NGN' or p_amount_kobo <> expected_kobo or attempt.amount_kobo <> expected_kobo then
    return jsonb_build_object('finalized', false, 'reason', 'amount_mismatch');
  end if;
  if p_paid_at is null or (attempt.expires_at is not null and p_paid_at > attempt.expires_at) then
    return jsonb_build_object('finalized', false, 'reason', 'expired');
  end if;
  if target.shared_pickup_order_id is not null then
    select * into anchor from public.orders where id = target.shared_pickup_order_id for update;
    if not found or anchor.user_id <> target.user_id or anchor.status in ('delivered', 'cancelled') then
      return jsonb_build_object('finalized', false, 'reason', 'shared_pickup_unavailable');
    end if;
    if anchor.status = 'processing' then finalized_status := 'processing'; end if;
  end if;
  update public.order_payment_attempts set status = 'paid', paid_at = p_paid_at where reference = p_reference;
  update public.orders
  set payment_status = 'paid', payment_paid_at = p_paid_at,
      payment_marked_by = target.user_id, payment_marked_by_role = 'customer',
      payment_mark_source = 'paystack', payment_marked_at = now(), payment_reference = p_reference,
      status = finalized_status, cancelled_at = null,
      driver_id = case when finalized_status = 'processing' then anchor.driver_id else driver_id end,
      pickup_completed_at = case when finalized_status = 'processing' then anchor.pickup_completed_at else pickup_completed_at end,
      available_to_drivers = case when shared_pickup_order_id is not null then false else available_to_drivers end,
      updated_at = now()
  where id = target.id;
  insert into public.order_payment_events(order_id, event_type, actor_id, actor_role, source, amount, payment_reference)
  values (target.id, 'marked_paid', target.user_id, 'customer', 'paystack', target.paid_amount, p_reference);
  return jsonb_build_object('finalized', true, 'reason', 'paid', 'orderId', target.id);
end;
$$;
revoke all on function public.finalize_order_payment(text, bigint, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.finalize_order_payment(text, bigint, text, timestamptz, text) to anon, authenticated;

create or replace function public.confirm_order_delivery(
  p_order_id text, p_delivery_day text, p_delivery_window text,
  p_delivery_at timestamptz, p_address text, p_address_place_id text,
  p_latitude double precision, p_longitude double precision, p_worker_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.orders%rowtype;
begin
  if not private.valid_payment_worker_secret(p_worker_secret) then
    raise exception 'Invalid operations worker credentials' using errcode = '42501';
  end if;
  if auth.uid() is null then raise exception 'Authentication is required' using errcode = '42501'; end if;
  select * into target from public.orders where id = p_order_id for update;
  if not found or target.user_id <> auth.uid() then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if target.status <> 'ready-for-delivery' then
    raise exception 'This order is not awaiting delivery confirmation' using errcode = '22023';
  end if;
  if target.delivery_confirmation_status = 'confirmed' then
    raise exception 'Delivery has already been confirmed' using errcode = '22023';
  end if;
  if p_delivery_day not in ('today', 'tomorrow', 'next-day') or p_delivery_window not in ('morning', 'afternoon') then
    raise exception 'Choose a valid delivery date and window' using errcode = '22023';
  end if;
  if p_delivery_at <= now() then raise exception 'Choose a future delivery window' using errcode = '22023'; end if;
  if nullif(trim(coalesce(p_address_place_id, '')), '') is null then
    raise exception 'A verified delivery address is required' using errcode = '22023';
  end if;
  update public.orders set
    delivery_day = p_delivery_day, delivery_window = p_delivery_window, delivery_at = p_delivery_at,
    delivery_address = left(trim(p_address), 400), delivery_address_place_id = p_address_place_id,
    delivery_latitude = p_latitude, delivery_longitude = p_longitude,
    delivery_confirmation_status = 'confirmed', delivery_confirmed_at = now(),
    available_to_drivers = true, availability_source = 'customer', available_at = now(),
    available_by = auth.uid(), available_by_name = 'Customer confirmation', available_by_role = 'customer',
    updated_at = now()
  where id = target.id;
  insert into public.order_staff_events(order_id, action, actor_id, actor_name, actor_role, details)
  values (target.id, 'delivery_confirmed', auth.uid(), 'Customer', 'customer',
    jsonb_build_object('delivery_at', p_delivery_at, 'delivery_window', p_delivery_window, 'address_place_id', p_address_place_id));
  return jsonb_build_object('orderId', target.id, 'deliveryAt', p_delivery_at, 'confirmed', true);
end;
$$;
revoke all on function public.confirm_order_delivery(text, text, text, timestamptz, text, text, double precision, double precision, text) from public, anon, authenticated;
grant execute on function public.confirm_order_delivery(text, text, text, timestamptz, text, text, double precision, double precision, text) to authenticated;

create or replace function public.manage_order_by_staff(
  p_order_id text, p_action text, p_actor_id uuid, p_reason text, p_worker_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders%rowtype;
  actor_name text; actor_role text; event_action text; action_time timestamptz := now();
begin
  if not private.valid_payment_worker_secret(p_worker_secret) then raise exception 'Invalid operations worker credentials' using errcode = '42501'; end if;
  if auth.uid() is null or auth.uid() <> p_actor_id then raise exception 'Order actor does not match the authenticated user' using errcode = '42501'; end if;
  select coalesce(nullif(trim(name), ''), 'Staff member'), role into actor_name, actor_role from public.profiles where id = p_actor_id;
  if actor_role not in ('admin', 'superadmin') then raise exception 'Admin order access is required' using errcode = '42501'; end if;
  select * into target from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if p_action = 'make_available' then
    if target.status <> 'pickup-confirmed' or target.payment_status not in ('paid', 'unpaid') then
      raise exception 'Only active paid or pay-on-delivery pickups can be released' using errcode = '22023';
    end if;
    if target.shared_pickup_order_id is not null then
      raise exception 'This order is bundled with its original pickup and cannot be released separately' using errcode = '22023';
    end if;
    if target.driver_id is not null then raise exception 'Unassign the current driver before releasing this order again' using errcode = '22023'; end if;
    update public.orders set available_to_drivers = true, availability_source = 'staff', available_at = action_time,
      available_by = p_actor_id, available_by_name = actor_name, available_by_role = actor_role, updated_at = action_time where id = target.id;
    event_action := 'made_available';
  elsif p_action = 'cancel' then
    if target.status in ('delivered', 'cancelled') then raise exception 'This order can no longer be cancelled' using errcode = '22023'; end if;
    if target.payment_status = 'pending' then raise exception 'Wait for the active payment session to complete or expire before cancelling' using errcode = '22023'; end if;
    if target.shared_pickup_order_id is null and exists (
      select 1 from public.orders where shared_pickup_order_id = target.id and status not in ('delivered', 'cancelled')
    ) then raise exception 'Cancel the bundled add-on orders before cancelling their shared pickup' using errcode = '23503'; end if;
    if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Add a clear cancellation reason' using errcode = '22023'; end if;
    update public.orders set status = 'cancelled', available_to_drivers = false,
      cancellation_reason = left(trim(p_reason), 300), cancelled_at = action_time,
      cancelled_by = p_actor_id, cancelled_by_name = actor_name, cancelled_by_role = actor_role, updated_at = action_time where id = target.id;
    event_action := 'cancelled';
  elsif p_action = 'unassign_driver' then
    if actor_role <> 'superadmin' then raise exception 'Only a superadmin can remove an assigned driver' using errcode = '42501'; end if;
    if target.driver_id is null or target.driver_task_status = 'arrived' then raise exception 'This driver can no longer be safely unassigned' using errcode = '22023'; end if;
    update public.orders set driver_id = null, driver_task_status = 'available', available_to_drivers = true,
      availability_source = 'staff', available_at = action_time, available_by = p_actor_id,
      available_by_name = actor_name, available_by_role = actor_role, updated_at = action_time where id = target.id;
    event_action := 'unassigned';
  elsif p_action = 'ready_for_delivery' then
    if target.status <> 'processing' then raise exception 'Only a processing order can be marked ready for delivery' using errcode = '22023'; end if;
    update public.orders set status = 'ready-for-delivery', available_to_drivers = false,
      delivery_confirmation_status = 'pending', delivery_confirmed_at = null,
      delivery_address = coalesce(delivery_address, address),
      delivery_address_place_id = coalesce(delivery_address_place_id, address_place_id),
      delivery_latitude = coalesce(delivery_latitude, latitude), delivery_longitude = coalesce(delivery_longitude, longitude),
      availability_source = 'staff', available_at = null, available_by = p_actor_id,
      available_by_name = actor_name, available_by_role = actor_role, updated_at = action_time where id = target.id;
    event_action := 'ready_for_delivery';
  else
    raise exception 'Unsupported order action' using errcode = '22023';
  end if;
  insert into public.order_staff_events(order_id, action, actor_id, actor_name, actor_role, reason)
  values (target.id, event_action, p_actor_id, actor_name, actor_role, nullif(trim(coalesce(p_reason, '')), ''));
  return jsonb_build_object('orderId', target.id, 'action', event_action, 'actorName', actor_name, 'actorRole', actor_role, 'actedAt', action_time);
end;
$$;
revoke all on function public.manage_order_by_staff(text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.manage_order_by_staff(text, text, uuid, text, text) to authenticated;

create or replace function public.create_order_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status not in ('paid', 'unpaid') then return new; end if;
  if tg_op = 'INSERT' and new.payment_status = 'unpaid' then
    insert into public.notifications(user_id,title,body,kind,order_id,route,dedupe_key)
    values(new.user_id,'Order confirmed','Your first order '||new.id||' is confirmed. You can pay securely in the app or on delivery.','order',new.id,'/track-order','order:'||new.id||':confirmed')
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  if tg_op = 'UPDATE' and old.payment_status is distinct from new.payment_status and new.payment_status = 'paid' then
    insert into public.notifications(user_id,title,body,kind,order_id,route,dedupe_key) values
      (new.user_id,'Order confirmed','Order '||new.id||' is secured and awaiting pickup.','order',new.id,'/track-order','order:'||new.id||':confirmed'),
      (new.user_id,'Payment confirmed','Payment for order '||new.id||' has been securely recorded.','payment',new.id,'/payment-history','order:'||new.id||':paid')
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  if new.shared_pickup_order_id is not null and (
    tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.payment_status is distinct from new.payment_status and new.payment_status = 'paid')
  ) then
    insert into public.notifications(user_id,title,body,kind,order_id,route,dedupe_key)
    values(new.user_id,'Pickup bundled','Order '||new.id||' will be collected with '||new.shared_pickup_order_id||'. No second pickup fee was charged.','order',new.id,'/order-history','order:'||new.id||':shared-pickup')
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  if tg_op = 'UPDATE' and old.driver_id is distinct from new.driver_id and new.driver_id is not null then
    insert into public.notifications(user_id,title,body,kind,order_id,route,dedupe_key)
    values(new.user_id,case when new.driver_task_type='delivery' then 'Delivery driver assigned' else 'Pickup driver assigned' end,
      'A driver has accepted order '||new.id||'. You can follow the live progress in the app.','order',new.id,'/track-order','order:'||new.id||':driver:'||new.driver_task_type)
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  if tg_op = 'UPDATE' and old.driver_task_status is distinct from new.driver_task_status and new.driver_task_status = 'arrived' then
    insert into public.notifications(user_id,title,body,kind,order_id,route,dedupe_key)
    values(new.user_id,'Driver has arrived','Your driver has arrived for order '||new.id||'.','order',new.id,'/track-order','order:'||new.id||':arrived:'||new.driver_task_type)
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  if tg_op = 'UPDATE' and old.delivery_confirmed_at is distinct from new.delivery_confirmed_at and new.delivery_confirmed_at is not null then
    insert into public.notifications(user_id,title,body,kind,order_id,route,dedupe_key)
    values(new.user_id,'Delivery scheduled','Your preferred delivery date, time and address for order '||new.id||' are confirmed.','order',new.id,'/track-order','order:'||new.id||':delivery-confirmed')
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.notifications(user_id,title,body,kind,order_id,route,dedupe_key)
    values(new.user_id,
      case new.status when 'processing' then 'Pickup complete' when 'ready-for-delivery' then 'Laundry ready for delivery'
        when 'out-for-delivery' then 'Fresh laundry on the way' when 'delivered' then 'Order delivered'
        when 'cancelled' then 'Order cancelled' else 'Order updated' end,
      case new.status when 'processing' then 'Your garments are now being professionally cleaned.'
        when 'ready-for-delivery' then 'Choose a convenient delivery date, time window and location for order '||new.id||'.'
        when 'out-for-delivery' then 'Your clean laundry is on its way back to you.'
        when 'delivered' then 'Order '||new.id||' has been delivered. Thank you for choosing Dr Laundry.'
        when 'cancelled' then 'Order '||new.id||' has been cancelled.' else 'There is a new update for order '||new.id||'.' end,
      'order',new.id,case when new.status='ready-for-delivery' then '/confirm-delivery' else '/track-order' end,
      'order:'||new.id||':status:'||new.status)
    on conflict (user_id,dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.create_order_notification() from public, anon, authenticated;
drop trigger if exists on_order_notification on public.orders;
create trigger on_order_notification
after insert or update of status, payment_status, driver_id, driver_task_status, delivery_confirmed_at
on public.orders
for each row execute function public.create_order_notification();

comment on column public.orders.shared_pickup_order_id is 'Immutable server-verified anchor for a single physical pickup; never trusted from client pricing.';
comment on column public.orders.delivery_confirmation_status is 'Customer delivery appointment state: not_required, pending, or confirmed.';
