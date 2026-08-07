-- Dr Laundry home + order backend migration
-- Run once in the Supabase SQL Editor for an existing project.

alter table public.orders
  add column if not exists actual_delivery_at timestamp with time zone;

alter table public.orders
  alter column payment_status set default 'pending';

alter table public.order_items
  add column if not exists mode text;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'general',
  order_id text references public.orders(id) on delete cascade,
  route text,
  read_at timestamp with time zone,
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users can view their notifications" on public.notifications;
create policy "Users can view their notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their notifications" on public.notifications;
create policy "Users can update their notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Customers can update their own pending orders" on public.orders;
create policy "Customers can update their own pending orders"
  on public.orders for update
  using (auth.uid() = user_id and status = 'pickup-confirmed')
  with check (auth.uid() = user_id and status = 'pickup-confirmed');

create or replace function public.create_order_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_title text;
  notification_body text;
begin
  if tg_op = 'INSERT' then
    notification_title := 'Pickup confirmed';
    notification_body := 'Your order ' || new.id || ' is booked and awaiting pickup.';
  elsif old.status is distinct from new.status then
    notification_title := case new.status
      when 'processing' then 'Laundry in progress'
      when 'out-for-delivery' then 'Fresh laundry on the way'
      when 'delivered' then 'Order delivered'
      else 'Order updated'
    end;
    notification_body := case new.status
      when 'processing' then 'We are now caring for the items in order ' || new.id || '.'
      when 'out-for-delivery' then 'Order ' || new.id || ' is heading back to you.'
      when 'delivered' then 'Order ' || new.id || ' has been marked as delivered.'
      else 'There is a new update for order ' || new.id || '.'
    end;
  else
    return new;
  end if;

  insert into public.notifications (user_id, title, body, kind, order_id, route)
  values (new.user_id, notification_title, notification_body, 'order', new.id, '/track-order');

  return new;
end;
$$;

drop trigger if exists on_order_notification on public.orders;
create trigger on_order_notification
  after insert or update of status on public.orders
  for each row execute procedure public.create_order_notification();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
