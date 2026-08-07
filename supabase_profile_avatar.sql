-- Run once in the Supabase SQL Editor for an existing Dr Laundry project.
-- The actual image is stored in Cloudflare R2; Supabase stores its URL.

alter table public.profiles
  add column if not exists avatar_url text;
