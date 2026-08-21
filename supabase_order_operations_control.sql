-- Secure order operations, permanent staff audit, dispatch stamps, and contact logs.

alter table public.orders
  add column if not exists available_to_drivers boolean not null default false,
  add column if not exists availability_source text,
  add column if not exists available_at timestamptz,
  add column if not exists available_by uuid,
  add column if not exists available_by_name text,
  add column if not exists available_by_role text,
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by uuid,
  add column if not exists cancelled_by_name text,
  add column if not exists cancelled_by_role text;

alter table public.orders drop constraint if exists orders_availability_source_check;
alter table public.orders add constraint orders_availability_source_check
  check (availability_source is null or availability_source in ('auto', 'staff'));
alter table public.orders drop constraint if exists orders_available_by_role_check;
alter table public.orders add constraint orders_available_by_role_check
  check (available_by_role is null or available_by_role in ('system', 'admin', 'superadmin'));
alter table public.orders drop constraint if exists orders_cancelled_by_role_check;
alter table public.orders add constraint orders_cancelled_by_role_check
  check (cancelled_by_role is null or cancelled_by_role in ('system', 'admin', 'superadmin'));

create table if not exists public.order_staff_events (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders(id) on delete restrict,
  action text not null check (action in (
    'auto_available', 'made_available', 'cancelled', 'unassigned',
    'ready_for_delivery', 'contact_call', 'contact_sms'
  )),
  actor_id uuid,
  actor_name text not null,
  actor_role text not null check (actor_role in ('system', 'driver', 'admin', 'superadmin')),
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.order_driver_task_history (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders(id) on delete restrict,
  driver_id uuid not null,
  task_type text not null check (task_type in ('pickup', 'delivery')),
  completed_at timestamptz not null default now(),
  unique(order_id, task_type, driver_id)
);

create index if not exists order_driver_task_history_driver_idx
  on public.order_driver_task_history(driver_id, completed_at desc);

alter table public.order_driver_task_history enable row level security;
revoke all on public.order_driver_task_history from public, anon, authenticated;
grant select on public.order_driver_task_history to authenticated;

drop policy if exists "Drivers view own completed tasks" on public.order_driver_task_history;
create policy "Drivers view own completed tasks"
on public.order_driver_task_history for select to authenticated
using (
  driver_id = (select auth.uid()) or exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'superadmin')
  )
);

create index if not exists order_staff_events_order_created_idx
  on public.order_staff_events(order_id, created_at desc);

alter table public.order_staff_events enable row level security;
revoke all on public.order_staff_events from public, anon, authenticated;
grant select on public.order_staff_events to authenticated;

drop policy if exists "Staff view order operation events" on public.order_staff_events;
create policy "Staff view order operation events"
on public.order_staff_events for select to authenticated
using (
  exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'superadmin')
  ) or exists (
    select 1 from public.orders
    where orders.id = order_staff_events.order_id
      and orders.driver_id = (select auth.uid())
  )
);

create or replace function private.prevent_order_staff_event_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Order operation events are immutable' using errcode = '42501';
end;
$$;

drop trigger if exists prevent_order_staff_event_update on public.order_staff_events;
create trigger prevent_order_staff_event_update
before update or delete on public.order_staff_events
for each row execute function private.prevent_order_staff_event_mutation();
revoke all on function private.prevent_order_staff_event_mutation() from public, anon, authenticated;

drop trigger if exists prevent_order_driver_history_mutation on public.order_driver_task_history;
create trigger prevent_order_driver_history_mutation
before update or delete on public.order_driver_task_history
for each row execute function private.prevent_order_staff_event_mutation();

create or replace function private.prevent_order_deletion()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Orders are permanent financial records and cannot be deleted' using errcode = '42501';
end;
$$;

drop trigger if exists prevent_order_deletion on public.orders;
create trigger prevent_order_deletion
before delete on public.orders
for each row execute function private.prevent_order_deletion();
revoke all on function private.prevent_order_deletion() from public, anon, authenticated;
revoke delete on public.orders from anon, authenticated;

create or replace function private.protect_order_operation_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'Order operations can only be changed by the secure operations service' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_order_operation_fields_before_update on public.orders;
create trigger protect_order_operation_fields_before_update
before update of available_to_drivers, availability_source, available_at,
  available_by, available_by_name, available_by_role, cancellation_reason,
  cancelled_by, cancelled_by_name, cancelled_by_role
on public.orders for each row execute function private.protect_order_operation_fields();
revoke all on function private.protect_order_operation_fields() from public, anon, authenticated;

create or replace function private.require_order_cancellation_audit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' and (
    new.cancellation_reason is null or length(trim(new.cancellation_reason)) < 5 or
    new.cancelled_by_name is null or new.cancelled_by_role is null or
    (new.cancelled_by_role <> 'system' and new.cancelled_by is null)
  ) then
    raise exception 'Orders must be cancelled through the audited operations service' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists require_order_cancellation_audit_before_update on public.orders;
create trigger require_order_cancellation_audit_before_update
before update of status on public.orders
for each row execute function private.require_order_cancellation_audit();
revoke all on function private.require_order_cancellation_audit() from public, anon, authenticated;

create or replace function public.sync_order_driver_task()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.driver_task_type := case when new.status = 'out-for-delivery' then 'delivery' else 'pickup' end;
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
        else null
      end;
    elsif new.status = 'out-for-delivery' then
      new.driver_id := null;
      new.driver_task_type := 'delivery';
      new.driver_task_status := case when new.available_to_drivers then 'available' else null end;
      new.driver_arrived_at := null;
    elsif new.status in ('processing', 'delivered', 'cancelled') then
      new.driver_task_status := 'completed';
      if new.status = 'cancelled' and new.cancelled_at is null then
        new.cancelled_at := timezone('utc'::text, now());
      end if;
    end if;
  elsif new.available_to_drivers is distinct from old.available_to_drivers or
        new.driver_id is distinct from old.driver_id then
    if new.status in ('pickup-confirmed', 'out-for-delivery') then
      new.driver_task_status := case
        when new.driver_id is not null then coalesce(new.driver_task_status, 'accepted')
        when new.available_to_drivers then 'available'
        else null
      end;
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sync_order_driver_task() from public, anon, authenticated;

create or replace function private.capture_completed_driver_task()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.driver_task_status = 'completed' and
     old.driver_task_status is distinct from 'completed' and
     new.driver_id is not null and new.driver_task_type is not null then
    insert into public.order_driver_task_history(order_id, driver_id, task_type, completed_at)
    values (new.id, new.driver_id, new.driver_task_type, now())
    on conflict (order_id, task_type, driver_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_completed_driver_task_after_update on public.orders;
create trigger capture_completed_driver_task_after_update
after update of driver_task_status, status on public.orders
for each row execute function private.capture_completed_driver_task();
revoke all on function private.capture_completed_driver_task() from public, anon, authenticated;

create or replace function public.auto_release_paid_order()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.payment_status = 'paid' and new.payment_method = 'paystack' and
     new.status = 'pickup-confirmed' and not new.available_to_drivers then
    update public.orders
    set available_to_drivers = true,
        availability_source = 'auto',
        available_at = coalesce(new.payment_paid_at, now()),
        available_by = null,
        available_by_name = 'Auto · Paystack',
        available_by_role = 'system',
        updated_at = now()
    where id = new.id and not available_to_drivers;

    insert into public.order_staff_events(order_id, action, actor_name, actor_role, details)
    values (new.id, 'auto_available', 'Auto · Paystack', 'system', jsonb_build_object('payment_status', 'paid'));
  end if;
  return new;
end;
$$;

drop trigger if exists auto_release_paid_order_after_payment on public.orders;
create trigger auto_release_paid_order_after_payment
after insert or update of payment_status on public.orders
for each row execute function public.auto_release_paid_order();
revoke all on function public.auto_release_paid_order() from public, anon, authenticated;

create or replace function public.manage_order_by_staff(
  p_order_id text,
  p_action text,
  p_actor_id uuid,
  p_reason text,
  p_worker_secret text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.orders%rowtype;
  actor_name text;
  actor_role text;
  event_action text;
  action_time timestamptz := now();
begin
  if not private.valid_payment_worker_secret(p_worker_secret) then
    raise exception 'Invalid operations worker credentials' using errcode = '42501';
  end if;
  if auth.uid() is null or auth.uid() <> p_actor_id then
    raise exception 'Order actor does not match the authenticated user' using errcode = '42501';
  end if;

  select coalesce(nullif(trim(name), ''), 'Staff member'), role
  into actor_name, actor_role from public.profiles where id = p_actor_id;
  if actor_role not in ('admin', 'superadmin') then
    raise exception 'Admin order access is required' using errcode = '42501';
  end if;

  select * into target from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;

  if p_action = 'make_available' then
    if target.status not in ('pickup-confirmed', 'out-for-delivery') or
       target.payment_status not in ('paid', 'unpaid') then
      raise exception 'Only active paid or pay-on-delivery orders can be released' using errcode = '22023';
    end if;
    if target.driver_id is not null then
      raise exception 'Unassign the current driver before releasing this order again' using errcode = '22023';
    end if;
    update public.orders set
      available_to_drivers = true, availability_source = 'staff', available_at = action_time,
      available_by = p_actor_id, available_by_name = actor_name, available_by_role = actor_role,
      updated_at = action_time
    where id = target.id;
    event_action := 'made_available';

  elsif p_action = 'cancel' then
    if target.status in ('delivered', 'cancelled') then
      raise exception 'This order can no longer be cancelled' using errcode = '22023';
    end if;
    if target.payment_status = 'pending' then
      raise exception 'Wait for the active payment session to complete or expire before cancelling' using errcode = '22023';
    end if;
    if length(trim(coalesce(p_reason, ''))) < 5 then
      raise exception 'Add a clear cancellation reason' using errcode = '22023';
    end if;
    update public.orders set
      status = 'cancelled', available_to_drivers = false,
      cancellation_reason = left(trim(p_reason), 300), cancelled_at = action_time,
      cancelled_by = p_actor_id, cancelled_by_name = actor_name, cancelled_by_role = actor_role,
      updated_at = action_time
    where id = target.id;
    event_action := 'cancelled';

  elsif p_action = 'unassign_driver' then
    if actor_role <> 'superadmin' then
      raise exception 'Only a superadmin can remove an assigned driver' using errcode = '42501';
    end if;
    if target.driver_id is null or target.driver_task_status = 'arrived' then
      raise exception 'This driver can no longer be safely unassigned' using errcode = '22023';
    end if;
    update public.orders set
      driver_id = null, driver_task_status = 'available', available_to_drivers = true,
      availability_source = 'staff', available_at = action_time,
      available_by = p_actor_id, available_by_name = actor_name, available_by_role = actor_role,
      updated_at = action_time
    where id = target.id;
    event_action := 'unassigned';

  elsif p_action = 'ready_for_delivery' then
    if target.status <> 'processing' then
      raise exception 'Only a processing order can be released for delivery' using errcode = '22023';
    end if;
    update public.orders set
      status = 'out-for-delivery', available_to_drivers = true,
      availability_source = 'staff', available_at = action_time,
      available_by = p_actor_id, available_by_name = actor_name, available_by_role = actor_role,
      updated_at = action_time
    where id = target.id;
    event_action := 'ready_for_delivery';
  else
    raise exception 'Unsupported order action' using errcode = '22023';
  end if;

  insert into public.order_staff_events(order_id, action, actor_id, actor_name, actor_role, reason)
  values (target.id, event_action, p_actor_id, actor_name, actor_role, nullif(trim(coalesce(p_reason, '')), ''));

  return jsonb_build_object(
    'orderId', target.id, 'action', event_action, 'actorName', actor_name,
    'actorRole', actor_role, 'actedAt', action_time
  );
end;
$$;
revoke all on function public.manage_order_by_staff(text, text, uuid, text, text) from public, anon;
grant execute on function public.manage_order_by_staff(text, text, uuid, text, text) to authenticated;

create or replace function public.record_driver_customer_contact(
  p_order_id text,
  p_actor_id uuid,
  p_action text,
  p_worker_secret text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target public.orders%rowtype;
  actor_name text;
  actor_role text;
  customer_name text;
  customer_phone text;
begin
  if not private.valid_payment_worker_secret(p_worker_secret) then
    raise exception 'Invalid operations worker credentials' using errcode = '42501';
  end if;
  if auth.uid() is null or auth.uid() <> p_actor_id then
    raise exception 'Contact actor does not match the authenticated user' using errcode = '42501';
  end if;
  if p_action not in ('call', 'sms') then
    raise exception 'Unsupported contact action' using errcode = '22023';
  end if;

  select coalesce(nullif(trim(name), ''), 'Staff member'), role
  into actor_name, actor_role from public.profiles where id = p_actor_id;
  if actor_role not in ('driver', 'admin', 'superadmin') then
    raise exception 'Driver access is required' using errcode = '42501';
  end if;

  select * into target from public.orders where id = p_order_id;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if actor_role = 'driver' and target.driver_id is distinct from p_actor_id then
    raise exception 'Only the assigned driver can contact this customer' using errcode = '42501';
  end if;

  select coalesce(nullif(trim(name), ''), 'Customer'), nullif(trim(phone_number), '')
  into customer_name, customer_phone from public.profiles where id = target.user_id;
  if customer_phone is null then
    raise exception 'The customer has not added a phone number' using errcode = '22023';
  end if;

  insert into public.order_staff_events(order_id, action, actor_id, actor_name, actor_role, details)
  values (
    target.id, case when p_action = 'call' then 'contact_call' else 'contact_sms' end,
    p_actor_id, actor_name, actor_role,
    jsonb_build_object('phone_suffix', right(regexp_replace(customer_phone, '\D', '', 'g'), 4))
  );

  return jsonb_build_object('orderId', target.id, 'customerName', customer_name, 'phoneNumber', customer_phone);
end;
$$;
revoke all on function public.record_driver_customer_contact(text, uuid, text, text) from public, anon;
grant execute on function public.record_driver_customer_contact(text, uuid, text, text) to authenticated;

create or replace function private.expire_pending_payments()
returns integer language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  update public.order_payment_attempts
  set status = 'expired'
  where status = 'pending' and expires_at is not null and expires_at <= now();

  with expired as (
    update public.orders
    set payment_status = 'expired', status = 'cancelled', available_to_drivers = false,
        cancelled_at = coalesce(cancelled_at, now()),
        cancellation_reason = 'Payment session expired after 30 minutes',
        cancelled_by = null, cancelled_by_name = 'Auto · Payment timeout', cancelled_by_role = 'system',
        updated_at = now()
    where payment_method = 'paystack' and payment_status = 'pending' and payment_expires_at <= now()
    returning id
  )
  insert into public.order_staff_events(order_id, action, actor_name, actor_role, reason, details)
  select id, 'cancelled', 'Auto · Payment timeout', 'system',
         'Payment session expired after 30 minutes', jsonb_build_object('automatic', true)
  from expired;
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke all on function private.expire_pending_payments() from public, anon, authenticated;

update public.orders
set available_to_drivers = true,
    availability_source = 'auto',
    available_at = coalesce(payment_paid_at, created_at),
    available_by = null,
    available_by_name = 'Auto · Paystack',
    available_by_role = 'system'
where payment_status = 'paid' and payment_method = 'paystack'
  and status in ('pickup-confirmed', 'out-for-delivery')
  and not available_to_drivers;

insert into public.order_staff_events(order_id, action, actor_name, actor_role, details, created_at)
select id, 'auto_available', 'Auto · Paystack', 'system', jsonb_build_object('backfilled', true),
       coalesce(payment_paid_at, created_at)
from public.orders o
where payment_status = 'paid' and payment_method = 'paystack'
  and status in ('pickup-confirmed', 'out-for-delivery')
  and not exists (
    select 1 from public.order_staff_events e
    where e.order_id = o.id and e.action = 'auto_available'
  );

drop index if exists public.orders_driver_queue_idx;
create index orders_driver_queue_idx on public.orders(driver_task_status, pickup_at)
where available_to_drivers and payment_status in ('paid', 'unpaid')
  and status in ('pickup-confirmed', 'out-for-delivery');

comment on column public.orders.available_by_name is 'Snapshot of the staff name, or Auto · Paystack, that released the order to drivers.';
comment on table public.order_staff_events is 'Append-only audit for operational order controls and driver contact attempts.';
comment on table public.order_driver_task_history is 'Permanent driver completion ledger retained when an order moves to its next task.';

-- Replace the legacy all-staff order policies: drivers only see released,
-- assigned, or historically completed work. Admin roles retain operations access.
drop policy if exists "Drivers can view all orders" on public.orders;
create policy "Staff view permitted orders"
on public.orders for select to authenticated
using (
  (select private.current_app_role()) in ('admin', 'superadmin') or
  (
    (select private.current_app_role()) = 'driver' and (
      (available_to_drivers and driver_id is null) or
      driver_id = (select auth.uid()) or
      exists (
        select 1 from public.order_driver_task_history h
        where h.order_id = orders.id and h.driver_id = (select auth.uid())
      )
    )
  )
);

drop policy if exists "Drivers can update order status or claim tasks" on public.orders;
create policy "Staff update permitted orders"
on public.orders for update to authenticated
using (
  (select private.current_app_role()) in ('admin', 'superadmin') or
  (
    (select private.current_app_role()) = 'driver' and (
      driver_id = (select auth.uid()) or
      (available_to_drivers and driver_id is null)
    )
  )
)
with check (
  (select private.current_app_role()) in ('admin', 'superadmin') or
  (
    (select private.current_app_role()) = 'driver' and
    driver_id = (select auth.uid())
  )
);
