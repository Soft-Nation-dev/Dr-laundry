-- Driver workflow fields shared by the customer order timeline and driver app.
alter table public.orders
  add column if not exists driver_task_type text,
  add column if not exists driver_task_status text,
  add column if not exists driver_arrived_at timestamp with time zone,
  add column if not exists pickup_completed_at timestamp with time zone,
  add column if not exists cancelled_at timestamp with time zone,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders
  add constraint orders_status_check
  check (status in ('pickup-confirmed', 'processing', 'out-for-delivery', 'delivered', 'cancelled'));

alter table public.orders drop constraint if exists orders_driver_task_type_check;
alter table public.orders
  add constraint orders_driver_task_type_check
  check (driver_task_type is null or driver_task_type in ('pickup', 'delivery'));

alter table public.orders drop constraint if exists orders_driver_task_status_check;
alter table public.orders
  add constraint orders_driver_task_status_check
  check (driver_task_status is null or driver_task_status in ('available', 'accepted', 'arrived', 'completed'));

alter table public.orders drop constraint if exists orders_latitude_check;
alter table public.orders
  add constraint orders_latitude_check check (latitude is null or latitude between -90 and 90);

alter table public.orders drop constraint if exists orders_longitude_check;
alter table public.orders
  add constraint orders_longitude_check check (longitude is null or longitude between -180 and 180);

update public.orders
set
  driver_task_type = case when status = 'out-for-delivery' then 'delivery' else 'pickup' end,
  driver_task_status = case
    when status in ('processing', 'delivered', 'cancelled') then 'completed'
    when driver_id is not null then 'accepted'
    else 'available'
  end
where driver_task_type is null or driver_task_status is null;

create or replace function public.sync_order_driver_task()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.driver_task_type := case when new.status = 'out-for-delivery' then 'delivery' else 'pickup' end;
    new.driver_task_status := case
      when new.status in ('processing', 'delivered', 'cancelled') then 'completed'
      when new.driver_id is not null then 'accepted'
      else 'available'
    end;
  elsif new.status is distinct from old.status then
    if new.status = 'pickup-confirmed' then
      new.driver_task_type := 'pickup';
      new.driver_task_status := case when new.driver_id is null then 'available' else 'accepted' end;
    elsif new.status = 'out-for-delivery' then
      new.driver_id := null;
      new.driver_task_type := 'delivery';
      new.driver_task_status := 'available';
      new.driver_arrived_at := null;
    elsif new.status in ('processing', 'delivered', 'cancelled') then
      new.driver_task_status := 'completed';
      if new.status = 'cancelled' and new.cancelled_at is null then
        new.cancelled_at := timezone('utc'::text, now());
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_order_driver_task_before_write on public.orders;
create trigger sync_order_driver_task_before_write
before insert or update on public.orders
for each row execute function public.sync_order_driver_task();

create index if not exists orders_driver_queue_idx
  on public.orders (driver_task_status, pickup_at)
  where payment_status = 'paid' and status in ('pickup-confirmed', 'out-for-delivery');

create index if not exists orders_driver_assignment_idx
  on public.orders (driver_id, driver_task_status)
  where driver_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

revoke all on function public.sync_order_driver_task() from public, anon, authenticated;

