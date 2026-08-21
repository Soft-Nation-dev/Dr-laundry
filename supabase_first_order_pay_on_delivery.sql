-- First-order pay-on-delivery and immutable payment attribution.
-- Apply after supabase_payment_lifecycle.sql and supabase_roles_native_notifications.sql.

alter table public.orders
  add column if not exists payment_method text not null default 'paystack',
  add column if not exists payment_marked_by uuid,
  add column if not exists payment_marked_by_role text,
  add column if not exists payment_mark_source text,
  add column if not exists payment_marked_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('paystack', 'pay_on_delivery'));

alter table public.orders drop constraint if exists orders_payment_marked_by_role_check;
alter table public.orders
  add constraint orders_payment_marked_by_role_check
  check (
    payment_marked_by_role is null or
    payment_marked_by_role in ('customer', 'driver', 'admin', 'superadmin', 'system')
  );

alter table public.orders drop constraint if exists orders_payment_mark_source_check;
alter table public.orders
  add constraint orders_payment_mark_source_check
  check (payment_mark_source is null or payment_mark_source in ('paystack', 'cash'));

do $$
declare payment_check record;
begin
  for payment_check in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%payment_status%'
  loop
    execute format('alter table public.orders drop constraint %I', payment_check.conname);
  end loop;
end $$;

alter table public.orders
  add constraint orders_payment_status_check
  check (payment_status in ('pending', 'unpaid', 'paid', 'failed', 'expired')) not valid;
alter table public.orders validate constraint orders_payment_status_check;

create table if not exists public.order_payment_attempts (
  reference text primary key,
  order_id text not null references public.orders(id) on delete restrict,
  provider text not null default 'paystack' check (provider = 'paystack'),
  amount_kobo bigint not null check (amount_kobo > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  authorization_url text not null,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.order_payment_events (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders(id) on delete restrict,
  event_type text not null check (event_type = 'marked_paid'),
  actor_id uuid,
  actor_role text not null check (actor_role in ('customer', 'driver', 'admin', 'superadmin', 'system')),
  source text not null check (source in ('paystack', 'cash')),
  amount numeric(12,2) not null check (amount > 0),
  payment_reference text,
  created_at timestamptz not null default now(),
  unique (order_id, event_type)
);

alter table public.order_payment_attempts enable row level security;
alter table public.order_payment_events enable row level security;

revoke all on public.order_payment_attempts from public, anon, authenticated;
revoke all on public.order_payment_events from public, anon, authenticated;
grant select on public.order_payment_attempts to authenticated;
grant select on public.order_payment_events to authenticated;

drop policy if exists "Customers view own payment attempts" on public.order_payment_attempts;
create policy "Customers view own payment attempts"
on public.order_payment_attempts for select to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_payment_attempts.order_id
      and orders.user_id = (select auth.uid())
  )
);

drop policy if exists "Staff view payment attempts" on public.order_payment_attempts;
create policy "Staff view payment attempts"
on public.order_payment_attempts for select to authenticated
using ((select private.is_staff()));

drop policy if exists "Customers view own payment events" on public.order_payment_events;
create policy "Customers view own payment events"
on public.order_payment_events for select to authenticated
using (
  exists (
    select 1 from public.orders
    where orders.id = order_payment_events.order_id
      and orders.user_id = (select auth.uid())
  )
);

drop policy if exists "Staff view payment events" on public.order_payment_events;
create policy "Staff view payment events"
on public.order_payment_events for select to authenticated
using ((select private.is_staff()));

create or replace function private.prevent_payment_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Payment audit events are immutable' using errcode = '42501';
end;
$$;

drop trigger if exists prevent_payment_event_update on public.order_payment_events;
create trigger prevent_payment_event_update
before update or delete on public.order_payment_events
for each row execute function private.prevent_payment_event_mutation();

revoke all on function private.prevent_payment_event_mutation() from public, anon, authenticated;

create or replace function private.protect_order_payment_attribution()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.payment_marked_at is not null and (
    new.payment_status is distinct from old.payment_status or
    new.payment_paid_at is distinct from old.payment_paid_at or
    new.payment_marked_by is distinct from old.payment_marked_by or
    new.payment_marked_by_role is distinct from old.payment_marked_by_role or
    new.payment_mark_source is distinct from old.payment_mark_source or
    new.payment_marked_at is distinct from old.payment_marked_at
  ) then
    raise exception 'Paid payment attribution is immutable' using errcode = '42501';
  end if;

  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Payment fields can only be changed by the secure payment service' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_order_payment_attribution_before_update on public.orders;
create trigger protect_order_payment_attribution_before_update
before update of payment_status, payment_paid_at, payment_marked_by,
  payment_marked_by_role, payment_mark_source, payment_marked_at
on public.orders
for each row execute function private.protect_order_payment_attribution();

revoke all on function private.protect_order_payment_attribution() from public, anon, authenticated;

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
  expires_at timestamptz;
  initial_status text;
  item jsonb;
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

  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 7291));

  if requested_method = 'pay_on_delivery' and exists (
    select 1 from public.orders
    where user_id = owner_id
      and (payment_status = 'paid' or payment_method = 'pay_on_delivery')
  ) then
    raise exception 'Pay on delivery is available only for the first order' using errcode = '23505';
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
    id, user_id, address, latitude, longitude, note, mode,
    pickup_day, pickup_window, delivery_day, delivery_window,
    pickup_at, delivery_at, promised_delivery_at, is_express,
    turnaround_hours, status, paid_amount, payment_status, payment_method,
    payment_reference, payment_expires_at, payment_authorization_url
  ) values (
    order_id, owner_id, p_order->>'address', (p_order->>'latitude')::double precision,
    (p_order->>'longitude')::double precision, coalesce(p_order->>'note', ''), p_order->>'mode',
    p_order->>'pickup_day', p_order->>'pickup_window', p_order->>'delivery_day',
    p_order->>'delivery_window', (p_order->>'pickup_at')::timestamptz,
    (p_order->>'delivery_at')::timestamptz, (p_order->>'promised_delivery_at')::timestamptz,
    (p_order->>'is_express')::boolean, (p_order->>'turnaround_hours')::integer,
    'pickup-confirmed', (p_order->>'paid_amount')::numeric, initial_status, requested_method,
    case when requested_method = 'paystack' then p_order->>'payment_reference' else null end,
    expires_at,
    case when requested_method = 'paystack' then p_order->>'payment_authorization_url' else null end
  );

  if requested_method = 'paystack' then
    insert into public.order_payment_attempts(
      reference, order_id, amount_kobo, authorization_url, expires_at
    ) values (
      p_order->>'payment_reference', order_id,
      round((p_order->>'paid_amount')::numeric * 100)::bigint,
      p_order->>'payment_authorization_url', expires_at
    );
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.order_items(order_id, item_id, name, unit_price, quantity, category, mode)
    values (
      order_id, item->>'item_id', item->>'name', (item->>'unit_price')::numeric,
      (item->>'quantity')::integer, item->>'category', item->>'mode'
    );
  end loop;

  return jsonb_build_object(
    'orderId', order_id,
    'paymentMethod', requested_method,
    'paymentStatus', initial_status,
    'paymentExpiresAt', expires_at
  );
end;
$$;

revoke all on function public.create_pending_order(jsonb, jsonb, text) from public;
revoke execute on function public.create_pending_order(jsonb, jsonb, text) from anon;
grant execute on function public.create_pending_order(jsonb, jsonb, text) to authenticated;

create or replace function public.initialize_existing_order_payment(
  p_order_id text,
  p_reference text,
  p_authorization_url text,
  p_worker_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare target public.orders%rowtype;
  expires_at timestamptz := now() + interval '30 minutes';
begin
  if not private.valid_payment_worker_secret(p_worker_secret) then
    raise exception 'Invalid payment worker credentials' using errcode = '42501';
  end if;

  select * into target from public.orders where id = p_order_id for update;
  if not found or auth.uid() is null or target.user_id <> auth.uid() then
    raise exception 'Order not found' using errcode = '42501';
  end if;
  if target.payment_method <> 'pay_on_delivery' or target.payment_status <> 'unpaid' then
    raise exception 'This order is not awaiting pay-on-delivery payment' using errcode = '22023';
  end if;
  if target.status = 'cancelled' then
    raise exception 'A cancelled order cannot be paid' using errcode = '22023';
  end if;

  insert into public.order_payment_attempts(
    reference, order_id, amount_kobo, authorization_url, expires_at
  ) values (
    p_reference, target.id, round(target.paid_amount * 100)::bigint,
    p_authorization_url, expires_at
  );

  update public.orders
  set payment_reference = p_reference,
      payment_authorization_url = p_authorization_url,
      payment_expires_at = expires_at,
      updated_at = now()
  where id = target.id;

  return jsonb_build_object(
    'orderId', target.id,
    'reference', p_reference,
    'paymentExpiresAt', expires_at
  );
end;
$$;

revoke all on function public.initialize_existing_order_payment(text, text, text, text) from public, anon;
grant execute on function public.initialize_existing_order_payment(text, text, text, text) to authenticated;

create or replace function public.finalize_order_payment(
  p_reference text,
  p_amount_kobo bigint,
  p_currency text,
  p_paid_at timestamptz,
  p_worker_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt public.order_payment_attempts%rowtype;
  target public.orders%rowtype;
  expected_kobo bigint;
begin
  if not private.valid_payment_worker_secret(p_worker_secret) then
    raise exception 'Invalid payment worker credentials' using errcode = '42501';
  end if;

  select * into attempt
  from public.order_payment_attempts
  where reference = p_reference
  for update;
  if not found then
    return jsonb_build_object('finalized', false, 'reason', 'not_found');
  end if;

  select * into target from public.orders where id = attempt.order_id for update;
  if target.payment_status = 'paid' then
    return jsonb_build_object('finalized', true, 'reason', 'already_paid', 'orderId', target.id);
  end if;

  expected_kobo := round(target.paid_amount * 100)::bigint;
  if upper(coalesce(p_currency, '')) <> 'NGN' or
     p_amount_kobo <> expected_kobo or
     attempt.amount_kobo <> expected_kobo then
    return jsonb_build_object('finalized', false, 'reason', 'amount_mismatch');
  end if;
  if p_paid_at is null or (attempt.expires_at is not null and p_paid_at > attempt.expires_at) then
    return jsonb_build_object('finalized', false, 'reason', 'expired');
  end if;

  update public.order_payment_attempts
  set status = 'paid', paid_at = p_paid_at
  where reference = p_reference;

  update public.orders
  set payment_status = 'paid',
      payment_paid_at = p_paid_at,
      payment_marked_by = target.user_id,
      payment_marked_by_role = 'customer',
      payment_mark_source = 'paystack',
      payment_marked_at = now(),
      payment_reference = p_reference,
      status = 'pickup-confirmed',
      cancelled_at = null,
      updated_at = now()
  where id = target.id;

  insert into public.order_payment_events(
    order_id, event_type, actor_id, actor_role, source, amount, payment_reference
  ) values (
    target.id, 'marked_paid', target.user_id, 'customer', 'paystack',
    target.paid_amount, p_reference
  );

  return jsonb_build_object('finalized', true, 'reason', 'paid', 'orderId', target.id);
end;
$$;

revoke all on function public.finalize_order_payment(text, bigint, text, timestamptz, text) from public;
grant execute on function public.finalize_order_payment(text, bigint, text, timestamptz, text) to anon, authenticated;

create or replace function public.mark_order_paid_by_staff(
  p_order_id text,
  p_actor_id uuid,
  p_worker_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.orders%rowtype;
  actor_role text;
  marked_at timestamptz := now();
begin
  if not private.valid_payment_worker_secret(p_worker_secret) then
    raise exception 'Invalid payment worker credentials' using errcode = '42501';
  end if;
  if auth.uid() is null or auth.uid() <> p_actor_id then
    raise exception 'Payment actor does not match the authenticated user' using errcode = '42501';
  end if;

  select role into actor_role from public.profiles where id = p_actor_id;
  if actor_role not in ('driver', 'admin', 'superadmin') then
    raise exception 'Staff payment access is required' using errcode = '42501';
  end if;

  select * into target from public.orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('marked', false, 'reason', 'not_found');
  end if;
  if target.payment_status = 'paid' then
    return jsonb_build_object('marked', true, 'reason', 'already_paid', 'orderId', target.id);
  end if;
  if target.payment_method <> 'pay_on_delivery' or target.payment_status <> 'unpaid' then
    return jsonb_build_object('marked', false, 'reason', 'not_pay_on_delivery');
  end if;
  if target.status = 'cancelled' then
    return jsonb_build_object('marked', false, 'reason', 'cancelled');
  end if;
  if actor_role = 'driver' and target.driver_id is distinct from p_actor_id then
    raise exception 'Only the assigned driver can collect this payment' using errcode = '42501';
  end if;

  update public.orders
  set payment_status = 'paid',
      payment_paid_at = marked_at,
      payment_marked_by = p_actor_id,
      payment_marked_by_role = actor_role,
      payment_mark_source = 'cash',
      payment_marked_at = marked_at,
      updated_at = marked_at
  where id = target.id;

  insert into public.order_payment_events(
    order_id, event_type, actor_id, actor_role, source, amount, payment_reference
  ) values (
    target.id, 'marked_paid', p_actor_id, actor_role, 'cash', target.paid_amount, null
  );

  return jsonb_build_object(
    'marked', true,
    'reason', 'paid',
    'orderId', target.id,
    'markedBy', p_actor_id,
    'markedByRole', actor_role,
    'markedAt', marked_at
  );
end;
$$;

revoke all on function public.mark_order_paid_by_staff(text, uuid, text) from public, anon;
grant execute on function public.mark_order_paid_by_staff(text, uuid, text) to authenticated;

create or replace function private.expire_pending_payments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  update public.order_payment_attempts attempts
  set status = 'expired'
  from public.orders orders
  where attempts.order_id = orders.id
    and attempts.status = 'pending'
    and attempts.expires_at is not null
    and attempts.expires_at <= now();

  update public.orders
  set payment_status = 'expired',
      status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now()
  where payment_method = 'paystack'
    and payment_status = 'pending'
    and payment_expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function private.expire_pending_payments() from public, anon, authenticated;

drop index if exists public.orders_driver_queue_idx;
create index orders_driver_queue_idx
  on public.orders (driver_task_status, pickup_at)
  where payment_status in ('paid', 'unpaid')
    and status in ('pickup-confirmed', 'out-for-delivery');

create index if not exists orders_first_order_payment_eligibility_idx
  on public.orders (user_id, payment_method, payment_status);

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
  if new.payment_status not in ('paid', 'unpaid') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    notification_title := 'Order confirmed';
    notification_body := case
      when new.payment_method = 'pay_on_delivery'
        then 'Your first order ' || new.id || ' is confirmed. You can pay securely in the app or when it is delivered.'
      else 'Your order ' || new.id || ' is confirmed and awaiting pickup.'
    end;
    notification_key := 'order:' || new.id || ':confirmed';
  elsif old.payment_status is distinct from new.payment_status and new.payment_status = 'paid' then
    notification_title := 'Payment confirmed';
    notification_body := 'Payment for order ' || new.id || ' has been securely recorded.';
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

revoke all on function public.create_order_notification() from public, anon, authenticated;

create or replace function private.enqueue_readiness_notifications()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare inserted_count integer := 0;
begin
  with due_orders as (
    update public.orders
    set readiness_notified_at = timezone('utc'::text, now())
    where payment_status in ('paid', 'unpaid')
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
    'order', id, '/track-order', 'order:' || id || ':ready'
  from due_orders
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

revoke all on function private.enqueue_readiness_notifications() from public, anon, authenticated;

comment on column public.orders.payment_method is 'paystack for immediate online checkout; pay_on_delivery only for the customer first order.';
comment on column public.orders.payment_marked_by is 'Immutable user id that accepted or completed payment.';
comment on table public.order_payment_events is 'Append-only audit trail for payment completion attribution.';
