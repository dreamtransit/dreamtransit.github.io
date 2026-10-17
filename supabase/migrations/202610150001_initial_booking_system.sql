create table public.ride_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  first_name text not null check (char_length(first_name) between 1 and 80),
  last_name text not null check (char_length(last_name) between 1 and 80),
  email text not null check (char_length(email) <= 254),
  phone text not null check (char_length(phone) between 7 and 32),
  service text not null check (service in (
    'Non-emergency medical transportation',
    'Wheelchair transportation',
    'Senior & private-pay rides',
    'Private transportation',
    'Hospital discharge transportation',
    'Private-pay school transportation'
  )),
  pickup_date date not null,
  pickup_time time not null,
  pickup_address text not null check (char_length(pickup_address) between 3 and 250),
  destination text not null check (char_length(destination) between 3 and 250),
  round_trip boolean not null default false,
  mobility_needs text[] not null default '{}'
    check (mobility_needs <@ array['wheelchair', 'walker', 'boarding_assistance', 'service_animal', 'other']::text[]),
  mobility_notes text not null default '' check (char_length(mobility_notes) <= 500),
  notes text not null default '' check (char_length(notes) <= 1000),
  status text not null default 'pending' check (status = 'pending')
);

create index ride_requests_created_at_idx on public.ride_requests (created_at desc);

create table public.booking_rate_limits (
  ip_fingerprint text not null,
  attempted_at timestamptz not null default now()
);

create index booking_rate_limits_lookup_idx
  on public.booking_rate_limits (ip_fingerprint, attempted_at desc);

alter table public.ride_requests enable row level security;
alter table public.booking_rate_limits enable row level security;

revoke all on public.ride_requests from anon, authenticated;
revoke all on public.booking_rate_limits from anon, authenticated;
grant all on public.ride_requests to service_role;
grant all on public.booking_rate_limits to service_role;

create or replace function public.consume_booking_rate_limit(p_ip_fingerprint text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt_count integer;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_ip_fingerprint, 0));

  delete from public.booking_rate_limits
  where attempted_at < now() - interval '1 day';

  select count(*)::integer into v_attempt_count
  from public.booking_rate_limits
  where ip_fingerprint = p_ip_fingerprint
    and attempted_at > now() - interval '15 minutes';

  if v_attempt_count >= 5 then
    return false;
  end if;

  insert into public.booking_rate_limits (ip_fingerprint) values (p_ip_fingerprint);
  return true;
end;
$$;

revoke all on function public.consume_booking_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_booking_rate_limit(text) to service_role;
