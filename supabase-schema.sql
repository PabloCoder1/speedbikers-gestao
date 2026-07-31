-- ============================================================
--  Speed Bikers — Schema do banco (rode no SQL Editor do Supabase)
-- ============================================================

-- 1) Perfis de usuário (1:1 com auth.users), guardando o role
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz default now()
);

-- 2) Estado global do app (bloqueio). Linha única com id=1.
create table if not exists public.app_state (
  id int primary key default 1,
  locked boolean not null default false,
  locked_by uuid references auth.users(id),
  locked_at timestamptz,
  constraint single_row check (id = 1)
);
insert into public.app_state (id, locked) values (1, false)
  on conflict (id) do nothing;

-- 3) Tokens do Mercado Livre (1 conexão por usuário admin que autorizar)
create table if not exists public.ml_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  ml_user_id bigint,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  updated_at timestamptz default now()
);

-- ============================================================
--  Função: cria profile automaticamente quando um usuário se cadastra
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
--  Row Level Security
-- ============================================================
alter table public.profiles enable row level security;
alter table public.app_state enable row level security;
alter table public.ml_tokens enable row level security;

-- profiles: cada um lê o próprio; todos os autenticados podem ler roles (p/ UI)
drop policy if exists "read own or any profile" on public.profiles;
create policy "read own or any profile" on public.profiles
  for select using (auth.role() = 'authenticated');

-- app_state: qualquer autenticado LÊ (pra saber se está bloqueado)
drop policy if exists "anyone reads lock" on public.app_state;
create policy "anyone reads lock" on public.app_state
  for select using (auth.role() = 'authenticated');

-- app_state: só ADMIN atualiza o bloqueio
drop policy if exists "admin updates lock" on public.app_state;
create policy "admin updates lock" on public.app_state
  for update using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ml_tokens: usuário só acessa os próprios tokens
drop policy if exists "own tokens" on public.ml_tokens;
create policy "own tokens" on public.ml_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
--  Depois de criar seu usuário, vire ADMIN rodando (troque o email):
--    update public.profiles set role = 'admin' where email = 'pablo@exemplo.com';
-- ============================================================
