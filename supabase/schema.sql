-- Rose Artesanatos · schema Supabase
-- Rode isto no SQL Editor do seu projeto Supabase.
-- Guarda o token OAuth do Mercado Livre, os IDs de pedidos já importados e o
-- estado compartilhado do sistema (pedidos, estoque, financeiro, config) — que
-- passou a viver na nuvem para que todos os usuários vejam os mesmos dados.

create table if not exists ml_tokens (
  id integer primary key default 1,
  access_token text,
  refresh_token text,
  expires_at bigint,
  constraint ml_tokens_single_row check (id = 1)
);
alter table ml_tokens enable row level security;

create table if not exists ml_imported_orders (
  ml_id text primary key,
  imported_at timestamptz not null default now()
);
alter table ml_imported_orders enable row level security;

-- Estado compartilhado do app: uma única linha com todo o "banco" do sistema
-- (pedidos, estoque, despesas, receitas, recorrentes, envios e config) em JSON.
-- Todos os usuários leem e gravam nesta mesma linha, então enxergam os mesmos
-- dados de qualquer computador ou celular.
create table if not exists app_state (
  id integer primary key default 1,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint app_state_single_row check (id = 1)
);
alter table app_state enable row level security;

-- Nenhuma policy é criada de propósito: as funções serverless (api/) acessam
-- essas tabelas com a service_role key, que ignora RLS. O frontend nunca
-- fala diretamente com o Supabase, então não há necessidade de policies
-- para o anon key.
