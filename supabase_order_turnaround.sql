-- Make the delivery promise explicit and enforce agreement with service speed.
alter table public.orders
  add column if not exists turnaround_hours integer;

update public.orders
set turnaround_hours = case when is_express then 24 else 72 end
where turnaround_hours is null;

alter table public.orders
  alter column turnaround_hours set default 72,
  alter column turnaround_hours set not null;

alter table public.orders
  drop constraint if exists orders_turnaround_hours_check;

alter table public.orders
  add constraint orders_turnaround_hours_check
  check (turnaround_hours in (24, 72));

alter table public.orders
  drop constraint if exists orders_turnaround_matches_service;

alter table public.orders
  add constraint orders_turnaround_matches_service
  check (
    (is_express and turnaround_hours = 24)
    or (not is_express and turnaround_hours = 72)
  );
