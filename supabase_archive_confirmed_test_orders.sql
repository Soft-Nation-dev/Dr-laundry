-- DESTRUCTIVE OPERATIONAL CHANGE (financial records remain preserved).
-- Apply only after the owner confirms that every order in the guarded set is
-- pre-launch test data. The guards force a rollback if the live set changes.

do $$
declare
  reset_time timestamptz := now();
  order_count integer;
  paid_count integer;
  paid_total numeric(12,2);
begin
  select count(*), count(*) filter (where payment_status = 'paid'),
    coalesce(sum(paid_amount) filter (where payment_status = 'paid'), 0)
  into order_count, paid_count, paid_total
  from public.orders
  where archived_at is null
    and created_at <= '2026-08-24T14:18:08.226404Z'::timestamptz;

  if order_count <> 20 or paid_count <> 4 or paid_total <> 27500 then
    raise exception 'Test-order archive guard failed: expected 20 orders, 4 paid, NGN 27500';
  end if;
  if exists (
    select 1 from public.orders
    where archived_at is null
      and created_at > '2026-08-24T14:18:08.226404Z'::timestamptz
  ) then
    raise exception 'Newer live orders exist; review the archive set again';
  end if;

  insert into public.system_data_resets(reason, archived_order_count, excluded_paid_amount)
  values ('Pre-launch test-order cleanup confirmed by the superadmin', order_count, paid_total);

  update public.orders
  set is_test_order = true,
      archived_at = reset_time,
      archived_reason = 'Confirmed pre-launch test data',
      available_to_drivers = false,
      updated_at = reset_time
  where archived_at is null
    and created_at <= '2026-08-24T14:18:08.226404Z'::timestamptz;

  update public.income_ledger
  set excluded_from_reporting = true,
      exclusion_reason = 'Confirmed pre-launch test data'
  where order_id in (
    select id from public.orders where archived_at = reset_time
  );

  update public.notifications
  set read_at = coalesce(read_at, reset_time)
  where order_id in (
    select id from public.orders where archived_at = reset_time
  );
end;
$$;

