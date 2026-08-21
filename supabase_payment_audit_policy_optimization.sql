-- Follow-up for first_order_pay_on_delivery: index the payment-attempt FK and
-- combine customer/staff SELECT policies to keep each table on one permissive
-- policy per role/action.

create index if not exists order_payment_attempts_order_id_idx
  on public.order_payment_attempts (order_id);

drop policy if exists "Customers view own payment attempts" on public.order_payment_attempts;
drop policy if exists "Staff view payment attempts" on public.order_payment_attempts;
create policy "Authorized users view payment attempts"
on public.order_payment_attempts for select to authenticated
using (
  (select private.is_staff()) or exists (
    select 1 from public.orders
    where orders.id = order_payment_attempts.order_id
      and orders.user_id = (select auth.uid())
  )
);

drop policy if exists "Customers view own payment events" on public.order_payment_events;
drop policy if exists "Staff view payment events" on public.order_payment_events;
create policy "Authorized users view payment events"
on public.order_payment_events for select to authenticated
using (
  (select private.is_staff()) or exists (
    select 1 from public.orders
    where orders.id = order_payment_events.order_id
      and orders.user_id = (select auth.uid())
  )
);
