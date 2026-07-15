-- Rose Artesanatos · schema Supabase
-- Rode isto no SQL Editor do seu projeto Supabase antes do primeiro deploy.
-- Guarda apenas o token OAuth do Mercado Livre e os IDs de pedidos já
-- importados — o restante do sistema (pedidos, estoque, financeiro) continua
-- 100% no localStorage do navegador.

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

-- Nenhuma policy é criada de propósito: as funções serverless (api/) acessam
-- essas tabelas com a service_role key, que ignora RLS. O frontend nunca
-- fala diretamente com o Supabase, então não há necessidade de policies
-- para o anon key.
