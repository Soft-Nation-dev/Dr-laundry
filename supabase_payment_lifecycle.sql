-- Secure, server-owned payment lifecycle for Dr Laundry.
-- Run this once in the Supabase SQL editor, then rotate the worker secret with:
--   select private.rotate_payment_worker_secret();
-- Store the returned value only as Cloudflare Worker secret PAYMENT_WORKER_SECRET.

create schema if not exists private;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

alter table public.orders
  add column if not exists payment_expires_at timestamptz,
  add column if not exists payment_paid_at timestamptz,
  add column if not exists payment_authorization_url text;

update public.orders
set payment_expires_at = created_at + interval '30 minutes'
where payment_status = 'pending' and payment_expires_at is null;

update public.orders
set payment_paid_at = coalesce(updated_at, created_at)
where payment_status = 'paid' and payment_paid_at is null;

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
  check (payment_status in ('pending', 'paid', 'failed', 'expired')) not valid;
alter table public.orders validate constraint orders_payment_status_check;

create index if not exists orders_pending_payment_expiry_idx
  on public.orders (payment_expires_at)
  where payment_status = 'pending';

create unique index if not exists orders_payment_reference_unique_idx
  on public.orders (payment_reference)
  where payment_reference is not null;

create table if not exists private.payment_worker_config (
  singleton boolean primary key default true check (singleton),
  secret_hash bytea not null,
  rotated_at timestamptz not null default now()
);

revoke all on private.payment_worker_config from public, anon, authenticated;

create or replace function private.rotate_payment_worker_secret()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  generated_secret text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into private.payment_worker_config(singleton, secret_hash, rotated_at)
  values (true, extensions.digest(generated_secret, 'sha256'), now())
  on conflict (singleton) do update
    set secret_hash = excluded.secret_hash,
        rotated_at = excluded.rotated_at;
  return generated_secret;
end;
$$;

revoke all on function private.rotate_payment_worker_secret() from public, anon, authenticated;

create or replace function private.valid_payment_worker_secret(candidate text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.payment_worker_config
    where singleton
      and secret_hash = extensions.digest(coalesce(candidate, ''), 'sha256')
  );
$$;

revoke all on function private.valid_payment_worker_secret(text) from public, anon, authenticated;

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
  expires_at timestamptz := now() + interval '30 minutes';
  item jsonb;
begin
  if not private.valid_payment_worker_secret(p_worker_secret) then
    raise exception 'Invalid payment worker credentials' using errcode = '42501';
  end if;
  if auth.uid() is null or auth.uid() <> owner_id then
    raise exception 'Order owner does not match the authenticated user' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'At least one order item is required' using errcode = '22023';
  end if;

  insert into public.orders (
    id, user_id, address, latitude, longitude, note, mode,
    pickup_day, pickup_window, delivery_day, delivery_window,
    pickup_at, delivery_at, promised_delivery_at, is_express,
    turnaround_hours, status, paid_amount, payment_status,
    payment_reference, payment_expires_at, payment_authorization_url
  ) values (
    order_id, owner_id, p_order->>'address', (p_order->>'latitude')::double precision,
    (p_order->>'longitude')::double precision, coalesce(p_order->>'note', ''), p_order->>'mode',
    p_order->>'pickup_day', p_order->>'pickup_window', p_order->>'delivery_day',
    p_order->>'delivery_window', (p_order->>'pickup_at')::timestamptz,
    (p_order->>'delivery_at')::timestamptz, (p_order->>'promised_delivery_at')::timestamptz,
    (p_order->>'is_express')::boolean, (p_order->>'turnaround_hours')::integer,
    'pickup-confirmed', (p_order->>'paid_amount')::numeric, 'pending',
    p_order->>'payment_reference', expires_at, p_order->>'payment_authorization_url'
  );

  for item in select value from jsonb_array_elements(p_items)
  loop
    insert into public.order_items(order_id, item_id, name, unit_price, quantity, category, mode)
    values (
      order_id, item->>'item_id', item->>'name', (item->>'unit_price')::numeric,
      (item->>'quantity')::integer, item->>'category', item->>'mode'
    );
  end loop;

  return jsonb_build_object('orderId', order_id, 'paymentExpiresAt', expires_at);
end;
$$;

revoke all on function public.create_pending_order(jsonb, jsonb, text) from public;
revoke execute on function public.create_pending_order(jsonb, jsonb, text) from anon;
grant execute on function public.create_pending_order(jsonb, jsonb, text) to authenticated;

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
  target public.orders%rowtype;
  expected_kobo bigint;
begin
  if not private.valid_payment_worker_secret(p_worker_secret) then
    raise exception 'Invalid payment worker credentials' using errcode = '42501';
  end if;

  select * into target
  from public.orders
  where payment_reference = p_reference
  for update;

  if not found then
    return jsonb_build_object('finalized', false, 'reason', 'not_found');
  end if;
  if target.payment_status = 'paid' then
    return jsonb_build_object('finalized', true, 'reason', 'already_paid', 'orderId', target.id);
  end if;

  expected_kobo := round(target.paid_amount * 100)::bigint;
  if upper(coalesce(p_currency, '')) <> 'NGN' or p_amount_kobo <> expected_kobo then
    return jsonb_build_object('finalized', false, 'reason', 'amount_mismatch');
  end if;
  if p_paid_at is null or p_paid_at > target.payment_expires_at then
    return jsonb_build_object('finalized', false, 'reason', 'expired');
  end if;

  update public.orders
  set payment_status = 'paid',
      payment_paid_at = p_paid_at,
      status = 'pickup-confirmed',
      cancelled_at = null,
      updated_at = now()
  where id = target.id;

  return jsonb_build_object('finalized', true, 'reason', 'paid', 'orderId', target.id);
end;
$$;

revoke all on function public.finalize_order_payment(text, bigint, text, timestamptz, text) from public;
grant execute on function public.finalize_order_payment(text, bigint, text, timestamptz, text) to anon, authenticated;

create or replace function private.expire_pending_payments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare affected integer;
begin
  update public.orders
  set payment_status = 'expired',
      status = 'cancelled',
      cancelled_at = coalesce(cancelled_at, now()),
      updated_at = now()
  where payment_status = 'pending'
    and payment_expires_at <= now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function private.expire_pending_payments() from public, anon, authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'expire-pending-payments';
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
  perform cron.schedule('expire-pending-payments', '* * * * *', 'select private.expire_pending_payments();');
end $$;

drop policy if exists "Customers create own orders" on public.orders;
drop policy if exists "Customers update own pending orders" on public.orders;
drop policy if exists "Customers insert own order items" on public.order_items;
drop policy if exists "Customers can create their own orders" on public.orders;
drop policy if exists "Customers can update their own pending orders" on public.orders;
drop policy if exists "Customers can insert their own order items" on public.order_items;

comment on column public.orders.payment_expires_at is 'Server-assigned checkout expiry; pending payments auto-cancel after 30 minutes.';
comment on function public.create_pending_order(jsonb, jsonb, text) is 'Worker-only atomic order creation after canonical server pricing.';
comment on function public.finalize_order_payment(text, bigint, text, timestamptz, text) is 'Worker-only idempotent finalization after Paystack verification.';
