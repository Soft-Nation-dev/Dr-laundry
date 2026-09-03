-- Permanent income history and audited archive support.
-- This migration is intentionally non-destructive: legacy orders are copied
-- into the ledger as reportable income until a separately reviewed archive
-- migration identifies the exact test-order set.

alter table public.orders add column if not exists is_test_order boolean not null default false;
alter table public.orders add column if not exists archived_at timestamptz;
alter table public.orders add column if not exists archived_reason text;

create index if not exists orders_live_created_idx
  on public.orders(created_at desc)
  where archived_at is null and not is_test_order;

create table if not exists public.income_ledger (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders(id) on delete restrict,
  event_type text not null default 'payment_received' check (event_type = 'payment_received'),
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('paystack', 'pay_on_delivery')),
  payment_reference text,
  actor_id uuid,
  actor_role text not null,
  source text not null,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  excluded_from_reporting boolean not null default false,
  exclusion_reason text,
  unique(order_id, event_type)
);

alter table public.income_ledger enable row level security;
revoke all on public.income_ledger from public, anon, authenticated;
grant select on public.income_ledger to authenticated;

drop policy if exists "Superadmins view income ledger" on public.income_ledger;
create policy "Superadmins view income ledger"
on public.income_ledger for select to authenticated
using ((select private.current_app_role()) = 'superadmin');

create index if not exists income_ledger_reporting_time_idx
  on public.income_ledger(occurred_at desc)
  where not excluded_from_reporting;

create table if not exists public.system_data_resets (
  id bigint generated always as identity primary key,
  reset_at timestamptz not null default now(),
  reason text not null,
  archived_order_count integer not null,
  excluded_paid_amount numeric(12,2) not null
);

alter table public.system_data_resets enable row level security;
revoke all on public.system_data_resets from public, anon, authenticated;
grant select on public.system_data_resets to authenticated;

drop policy if exists "Superadmins view data resets" on public.system_data_resets;
create policy "Superadmins view data resets"
on public.system_data_resets for select to authenticated
using ((select private.current_app_role()) = 'superadmin');

create or replace function private.capture_order_income()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payment_status = 'paid' and
     (tg_op = 'INSERT' or old.payment_status is distinct from new.payment_status) then
    insert into public.income_ledger(
      order_id, amount, payment_method, payment_reference, actor_id,
      actor_role, source, occurred_at, excluded_from_reporting, exclusion_reason
    ) values (
      new.id, new.paid_amount, new.payment_method, new.payment_reference,
      new.payment_marked_by, coalesce(new.payment_marked_by_role, 'system'),
      coalesce(new.payment_mark_source, new.payment_method),
      coalesce(new.payment_paid_at, new.payment_marked_at, now()),
      new.is_test_order or new.archived_at is not null,
      case when new.is_test_order or new.archived_at is not null then 'Archived test order' end
    ) on conflict (order_id, event_type) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.capture_order_income() from public, anon, authenticated;
drop trigger if exists capture_order_income_after_write on public.orders;
create trigger capture_order_income_after_write
after insert or update of payment_status on public.orders
for each row execute function private.capture_order_income();

-- Backfill every previously paid order so the new permanent ledger does not
-- lose historical income. A later audited archive can exclude confirmed test
-- records without deleting the ledger row.
insert into public.income_ledger(
  order_id, amount, payment_method, payment_reference, actor_id, actor_role,
  source, occurred_at, excluded_from_reporting, exclusion_reason
)
select id, paid_amount, payment_method, payment_reference, payment_marked_by,
  coalesce(payment_marked_by_role, 'system'),
  coalesce(payment_mark_source, payment_method),
  coalesce(payment_paid_at, payment_marked_at, created_at), false, null
from public.orders
where payment_status = 'paid'
on conflict (order_id, event_type) do nothing;

create or replace function public.get_income_history(
  p_from timestamptz,
  p_to timestamptz,
  p_bucket text,
  p_worker_secret text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.valid_payment_worker_secret(p_worker_secret) then
    raise exception 'Invalid operations worker credentials' using errcode = '42501';
  end if;
  if private.current_app_role() <> 'superadmin' then
    raise exception 'Superadmin income access is required' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to <= p_from or p_bucket not in ('day', 'month') then
    raise exception 'Invalid income-history period' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'totals', jsonb_build_object(
      'successfulRevenue', coalesce((select sum(amount) from public.income_ledger where not excluded_from_reporting), 0),
      'successfulPayments', (select count(*) from public.income_ledger where not excluded_from_reporting),
      'pendingCheckoutValue', coalesce((select sum(paid_amount) from public.orders where archived_at is null and not is_test_order and payment_status = 'pending' and status <> 'cancelled'), 0),
      'pendingPayments', (select count(*) from public.orders where archived_at is null and not is_test_order and payment_status = 'pending' and status <> 'cancelled'),
      'unpaidDeliveryValue', coalesce((select sum(paid_amount) from public.orders where archived_at is null and not is_test_order and payment_status = 'unpaid' and status <> 'cancelled'), 0),
      'unpaidDeliveryOrders', (select count(*) from public.orders where archived_at is null and not is_test_order and payment_status = 'unpaid' and status <> 'cancelled'),
      'cancelledOrders', (select count(*) from public.orders where archived_at is null and not is_test_order and status = 'cancelled'),
      'todayRevenue', coalesce((select sum(amount) from public.income_ledger where not excluded_from_reporting and timezone('Africa/Lagos', occurred_at)::date = timezone('Africa/Lagos', now())::date), 0),
      'monthRevenue', coalesce((select sum(amount) from public.income_ledger where not excluded_from_reporting and date_trunc('month', timezone('Africa/Lagos', occurred_at)) = date_trunc('month', timezone('Africa/Lagos', now()))), 0)
    ),
    'period', jsonb_build_object(
      'from', p_from,
      'to', p_to,
      'revenue', coalesce((select sum(amount) from public.income_ledger where not excluded_from_reporting and occurred_at >= p_from and occurred_at < p_to), 0),
      'payments', (select count(*) from public.income_ledger where not excluded_from_reporting and occurred_at >= p_from and occurred_at < p_to)
    ),
    'series', coalesce((
      select jsonb_agg(jsonb_build_object('period', bucket_key, 'revenue', revenue, 'payments', payments) order by bucket_key)
      from (
        select case when p_bucket = 'day'
          then to_char(date_trunc('day', timezone('Africa/Lagos', occurred_at)), 'YYYY-MM-DD')
          else to_char(date_trunc('month', timezone('Africa/Lagos', occurred_at)), 'YYYY-MM') end as bucket_key,
          sum(amount) as revenue, count(*) as payments
        from public.income_ledger
        where not excluded_from_reporting and occurred_at >= p_from and occurred_at < p_to
        group by 1
      ) buckets
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'orderId', order_id, 'amount', amount,
        'occurredAt', occurred_at, 'paymentMethod', payment_method,
        'source', source, 'actorRole', actor_role
      ) order by occurred_at desc)
      from (select * from public.income_ledger
        where not excluded_from_reporting and occurred_at >= p_from and occurred_at < p_to
        order by occurred_at desc limit 100) recent
    ), '[]'::jsonb),
    'availableYears', coalesce((
      select jsonb_agg(year_key order by year_key desc)
      from (select distinct extract(year from timezone('Africa/Lagos', occurred_at))::integer as year_key
        from public.income_ledger where not excluded_from_reporting) years
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.get_income_history(timestamptz, timestamptz, text, text) from public, anon, authenticated;
grant execute on function public.get_income_history(timestamptz, timestamptz, text, text) to authenticated;
