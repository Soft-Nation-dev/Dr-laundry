-- Driver-map integrity: an order must never enter the driver queue without a
-- complete, valid destination. Terminal orders must not remain advertised.

update public.orders
set available_to_drivers = false,
    updated_at = now()
where status in ('delivered', 'cancelled')
  and available_to_drivers;

alter table public.orders drop constraint if exists orders_pickup_coordinate_pair_check;
alter table public.orders add constraint orders_pickup_coordinate_pair_check check (
  (latitude is null and longitude is null)
  or (
    latitude between -90 and 90
    and longitude between -180 and 180
  )
);

alter table public.orders drop constraint if exists orders_delivery_coordinate_pair_check;
alter table public.orders add constraint orders_delivery_coordinate_pair_check check (
  (delivery_latitude is null and delivery_longitude is null)
  or (
    delivery_latitude between -90 and 90
    and delivery_longitude between -180 and 180
  )
);

create schema if not exists private;
revoke all on schema private from public, anon;

create or replace function private.enforce_driver_destination()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  destination_latitude double precision;
  destination_longitude double precision;
begin
  if new.status in ('delivered', 'cancelled') then
    new.available_to_drivers := false;
    return new;
  end if;

  if not new.available_to_drivers then return new; end if;

  if coalesce(new.driver_task_type, case when new.status in ('ready-for-delivery', 'out-for-delivery') then 'delivery' else 'pickup' end) = 'delivery' then
    destination_latitude := coalesce(new.delivery_latitude, new.latitude);
    destination_longitude := coalesce(new.delivery_longitude, new.longitude);
  else
    destination_latitude := new.latitude;
    destination_longitude := new.longitude;
  end if;

  if destination_latitude is null or destination_longitude is null then
    raise exception 'A verified service location is required before this order can be made available to drivers'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_driver_destination() from public, anon, authenticated;

drop trigger if exists enforce_driver_destination_before_write on public.orders;
create trigger enforce_driver_destination_before_write
before insert or update of available_to_drivers, status, driver_task_type,
  latitude, longitude, delivery_latitude, delivery_longitude
on public.orders
for each row execute function private.enforce_driver_destination();

comment on function private.enforce_driver_destination() is
  'Prevents unusable orders without verified coordinates from entering the driver queue and clears terminal queue visibility.';
