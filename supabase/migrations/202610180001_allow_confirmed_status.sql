alter table public.ride_requests drop constraint ride_requests_status_check;

alter table public.ride_requests
  add constraint ride_requests_status_check check (status in ('pending', 'confirmed', 'cancelled'));
