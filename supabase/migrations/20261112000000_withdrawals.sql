-- طلبات السحب: يرفعها اللاعب إذا وصل رصيده 100 جوهرة، وتظهر لصاحب البوت في لوحة التحكم.
create table if not exists public.withdrawals (
  id uuid primary key default gen_random_uuid(),
  tg_id bigint not null,
  wallet text not null check (char_length(wallet) between 20 and 200),
  amount bigint not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
-- طلب معلّق واحد لكل لاعب
create unique index if not exists withdrawals_one_pending on public.withdrawals (tg_id) where status = 'pending';
create index if not exists withdrawals_created on public.withdrawals (created_at desc);
-- الوصول من السيرفر فقط (service role)
alter table public.withdrawals enable row level security;
revoke all on public.withdrawals from anon, authenticated;
