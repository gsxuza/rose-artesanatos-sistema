# 🌹 Rose Artesanatos — Sistema Operacional

> Sistema de gestão operacional e financeira desenvolvido para um e-commerce de artesanato em MDF no Mercado Livre. Projeto real, entregue a um cliente.

![Stack](https://img.shields.io/badge/Frontend-HTML%20%2F%20CSS%20%2F%20JS-B84C1E?style=flat-square)
![Backend](https://img.shields.io/badge/Backend-Vercel%20Functions-2A6449?style=flat-square)
![DB](https://img.shields.io/badge/DB-Supabase-3ECF8E?style=flat-square)
![API](https://img.shields.io/badge/API-Mercado%20Livre-FFE600?style=flat-square&labelColor=2D3134)

---

## 📋 Sobre o Projeto

Cliente real com operação de venda de artesanatos em MDF no Mercado Livre. Antes do sistema, o gerenciamento era feito manualmente (papel + planilhas). O sistema centraliza:

- Gestão de pedidos com pipeline de status
- Controle de estoque por SKU e localização física
- **Módulo financeiro automatizado** — receitas geradas automaticamente ao despachar, taxas ML descontadas automaticamente, despesas recorrentes aplicadas todo mês
- Integração com a API do Mercado Livre para importação de pedidos
- Dashboard com alertas em tempo real
- Responsivo (desktop + mobile)

---

## 🗂 Estrutura do Projeto

```
rose-artesanatos-sistema/
│
├── index.html              # Estrutura HTML principal
├── package.json            # Dependências das funções serverless (api/)
├── .env.example            # Modelo de variáveis de ambiente (Vercel)
├── .gitignore
├── README.md
│
├── css/
│   └── style.css           # Design system completo (tokens, layout, componentes)
│
├── js/
│   ├── constants.js        # Constantes globais (status, badges, equipe, títulos)
│   ├── db.js               # Estado global, localStorage, helpers
│   ├── finance.js          # Cálculos financeiros + automação de lançamentos
│   ├── charts.js           # Gráficos SVG (fluxo de caixa, categorias)
│   ├── render.js           # Renderização de UI (todas as seções)
│   ├── crud.js             # Operações CRUD (pedidos, estoque, finanças)
│   ├── ml.js               # Integração Mercado Livre (OAuth + importação)
│   └── app.js              # Navegação, modais, toast, inicialização
│
├── api/                    # Funções serverless (Vercel) — integração Mercado Livre
│   ├── _lib/
│   │   ├── supabase.js     # Client Supabase (service role, só no servidor)
│   │   └── ml.js           # Token OAuth (get/refresh) + chamadas à API do ML
│   ├── auth/
│   │   ├── url.js          # GET  /api/auth/url
│   │   ├── callback.js     # GET  /api/auth/callback
│   │   └── status.js       # GET  /api/auth/status
│   └── pedidos/
│       └── importar.js     # POST /api/pedidos/importar
│
└── supabase/
    └── schema.sql          # Tabelas ml_tokens e ml_imported_orders
```

---

## ✨ Funcionalidades

### 📊 Dashboard
- KPIs em tempo real: pedidos, receita, despesas, lucro do mês
- Gráfico de fluxo de caixa (últimos 6 meses)
- Alertas automáticos: estoque crítico, despesas > receitas, pagamentos pendentes
- Horários de corte e despacho do dia

### 📦 Pedidos
- CRUD completo com pipeline de status: Pendente → Separando → Embalado → Despachado
- Importação automática via API do Mercado Livre
- Responsável por pedido (equipe)

### 💰 Financeiro (destaque do projeto)
- **Receitas automáticas**: ao despachar um pedido, a receita é registrada automaticamente
- **Taxa ML automática**: percentual configurável deduzido de cada venda despachada
- **Custo de embalagem automático**: registrado por unidade a cada despacho
- **Despesas recorrentes**: cadastradas uma vez, aplicadas no dia 1 de cada mês
- Gráfico SVG de receitas vs despesas por mês
- Breakdown de despesas por categoria com barras proporcionais
- **DRE simplificado** por período (Demonstrativo de Resultado)
- Fluxo de caixa mensal com tabela comparativa

### 🗄️ Estoque
- SKUs com localização por prateleira
- Custo unitário
- Alerta visual de estoque baixo/crítico com barra de progresso
- Ajuste de quantidade em um clique

### 🚚 Despacho
- Controle de Envios Full (ML20)
- Checklist de despacho com progresso

### 👥 Equipe
- Funções e responsabilidades de cada colaborador

### ⚙️ Configurações + Integração ML
- Taxa ML configurável
- Custo de embalagem configurável
- Conexão OAuth com conta do Mercado Livre (via funções serverless + Supabase)

---

## 🚀 Como Rodar

### Frontend (sem integração ML)
Abra `index.html` diretamente no navegador. O sistema funciona offline com localStorage.

### Com integração Mercado Livre (local)

```bash
# 1. Instalar dependências das funções serverless
npm install

# 2. Instalar a Vercel CLI (se ainda não tiver)
npm install -g vercel

# 3. Configurar variáveis (copiar .env.example para .env)
cp .env.example .env
# Edite .env com suas credenciais ML e do Supabase

# 4. Rodar localmente (frontend + funções em /api)
vercel dev
```

### Deploy (Vercel + Supabase)

1. Crie um projeto no [Supabase](https://supabase.com) e rode `supabase/schema.sql`
   no SQL Editor — isso cria as tabelas `ml_tokens` e `ml_imported_orders`.
2. Copie a **Project URL** e a **service_role key** (Project Settings → API).
3. Publique o repositório na [Vercel](https://vercel.com) (import do GitHub, ou
   `vercel --prod` pela CLI).
4. No dashboard do projeto na Vercel, configure as variáveis de ambiente:
   `ML_APP_ID`, `ML_SECRET`, `ML_REDIRECT`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
5. Atualize `ML_REDIRECT` para `https://rose-artesanatos-sistema-enwk.vercel.app/api/auth/callback`
   e configure a mesma URL de callback no app do Mercado Livre Developers.

---

## 🔗 Configuração da API Mercado Livre

1. Acesse [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br)
2. Crie um aplicativo com a conta do vendedor
3. Configure a URL de callback: `https://rose-artesanatos-sistema-enwk.vercel.app/api/auth/callback`
4. Copie o **App ID** e **Secret Key**
5. Configure as variáveis `ML_APP_ID` e `ML_SECRET` na Vercel
6. No dashboard do sistema, acesse **Configurações** e clique em **Conectar com Mercado Livre**

---

## 🛠 Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5, CSS3, JavaScript (Vanilla) |
| Persistência local | localStorage |
| Backend | Funções serverless (Vercel, Node.js) |
| Banco de dados | Supabase (Postgres) — só tokens ML |
| Integração | Mercado Livre API (OAuth 2.0) |
| Deploy | Vercel |
| Fontes | Fraunces (display) + Outfit (corpo) |

---

## 👨‍💻 Desenvolvido por

**[Seu Nome]** · Desenvolvedor Full Stack  
[LinkedIn](https://linkedin.com) · [Portfolio](https://seusite.com)

---

*Projeto desenvolvido sob demanda para cliente real — Rose Artesanatos.*
