# 📋 Guia — Como o Cliente Obtém as Credenciais do Mercado Livre

Este documento é para você (desenvolvedor) enviar ao cliente **Rose Artesanatos**, ou
seguir junto com ele. Ele explica, passo a passo e sem termos técnicos, como criar o
aplicativo no painel de desenvolvedores do Mercado Livre e onde encontrar as duas
informações que o sistema precisa: o **App ID** (Client ID) e o **Secret Key**
(Client Secret).

Conferido na documentação oficial do Mercado Livre (developers.mercadolivre.com.br,
atualizada em 29/12/2025) para garantir que os campos abaixo batem com a tela real.

---

## ✅ Antes de começar (checklist rápido)

- [ ] O cliente precisa entrar com **a mesma conta que vende no Mercado Livre**
      (o e-mail/senha de vendedor, não uma conta pessoal separada).
- [ ] Ideal que a conta ML seja de **Pessoa Jurídica (CNPJ)** — o Mercado Livre recomenda
      isso para evitar problemas futuros de transferência do aplicativo.
- [ ] No Brasil, **só é permitido criar 1 aplicativo por conta**. Se o cliente já tiver
      um aplicativo criado antes, não precisa criar outro — é só abrir o existente e
      pegar as credenciais (pule para o Passo 4).
- [ ] Você (desenvolvedor) precisa ter feito o primeiro deploy na Vercel **antes** desta
      etapa, porque vai precisar informar ao cliente a URL exata de callback
      (`https://SEU-PROJETO.vercel.app/api/auth/callback`) para colar no formulário.

---

## 🧭 Passo a passo detalhado

### Passo 1 — Acessar o painel de desenvolvedores

1. Peça para o cliente abrir o navegador e acessar:
   **[developers.mercadolivre.com.br](https://developers.mercadolivre.com.br)**
2. Clicar em **"Entrar"** (canto superior direito).
3. Fazer login com o **e-mail e senha da conta vendedora** no Mercado Livre — a mesma
   que ele usa para acessar o "Mercado Livre Vendas" no dia a dia.
4. Se aparecer uma tela pedindo para confirmar por SMS ou e-mail (verificação em duas
   etapas), é normal — só seguir o código que chegar no celular/e-mail.

> 💡 **Dica:** faça isso em uma chamada de vídeo ou por perto do cliente na primeira
> vez. É rápido (menos de 5 minutos), mas ajuda a resolver qualquer tela de confirmação
> de identidade na hora.

---

### Passo 2 — Criar o aplicativo

1. No menu, acessar **"Minhas aplicações"**.
2. Clicar no botão **"Criar aplicação"**.

Se já existir um aplicativo criado (o Brasil só permite 1 por conta), o botão pode não
aparecer ou pode avisar que já existe um — nesse caso, clicar em **"Editar"** no
aplicativo existente e ir direto para o Passo 4.

---

### Passo 3 — Preencher o formulário

O formulário tem alguns campos. Preencha assim:

| Campo | O que colocar |
|-------|---------------|
| **Nome** | `Rose Artesanatos Sistema` (precisa ser um nome único — se já existir, tente `Rose Artesanatos ERP` ou similar) |
| **Nome curto** | `rose-artesanatos` (sem espaços/acentos — o Mercado Livre usa isso para gerar a URL do app) |
| **Descrição** | `Sistema interno de gestão de pedidos e integração com o Mercado Livre` (máximo 150 caracteres) |
| **Logo** | Opcional — pode deixar em branco ou subir a logo da empresa |
| **URLs de redirecionamento** | Cole exatamente a URL que o desenvolvedor te passou, no formato: `https://SEU-PROJETO.vercel.app/api/auth/callback` |
| **Usar PKCE** | **Deixar desmarcado.** (O sistema já guarda a senha secreta com segurança no servidor — o PKCE é para outro tipo de aplicativo que não tem onde guardar essa senha, como apps de celular.) |
| **Device Grant** | Deixar desmarcado (não se aplica aqui) |
| **Escopos** | Marcar **Leitura** e **Escrita** (o sistema precisa ler os pedidos e também atualizar o status de envio) |
| **Tópicos (notificações)** | **Não marcar nenhum** por enquanto — isso exige uma URL própria para receber notificações em tempo real, que este sistema ainda não usa (ele importa pedidos quando você clica no botão "Importar Pedidos") |

> ⚠️ **Atenção com a URL de redirecionamento:** ela precisa ser **exatamente igual**,
> caractere por caractere (incluindo `https://` e o `/api/auth/callback` no final), à
> que está configurada nas variáveis de ambiente da Vercel. Qualquer diferença faz a
> autorização falhar com erro de "redirect_uri inválida".

4. Clicar em **"Salvar"**.

---

### Passo 4 — Copiar as credenciais

Depois de salvar, o cliente será levado de volta para a página do aplicativo, onde
aparecem:

- **Client ID** (também chamado de **App ID**) — um número, ex: `1234567890123456`
- **Client Secret** (também chamado de **Secret Key**) — um código, ex: `AbCdEfGh123456...`
  (pode estar oculto atrás de um botão "Mostrar"/olho — clicar para revelar)

Esses dois valores ficam sempre visíveis depois em **Minhas aplicações → (nome do app)
→ Configurações**.

---

### Passo 5 — Enviar as credenciais com segurança

Peça ao cliente para **copiar os dois valores** (Client ID e Client Secret) e enviar
diretamente para você, por um canal privado (WhatsApp direto, por exemplo) — **nunca em
grupo, nunca por print postado publicamente, nunca por e-mail sem criptografia**.

O Client Secret é equivalente a uma senha do sistema: quem tiver acesso a ele consegue
agir em nome da conta do Mercado Livre do cliente.

---

## 💬 Mensagem pronta para enviar ao cliente

Copie e envie por WhatsApp (troque `SEU-PROJETO` pela URL real depois do deploy):

---

> Olá! Para ativar a integração do sistema com o seu Mercado Livre, preciso que você
> crie um "aplicativo" no site de desenvolvedores — é rápido, menos de 5 minutos.
>
> 1️⃣ Acesse **developers.mercadolivre.com.br** e entre com o mesmo login que você usa
> para vender no Mercado Livre.
>
> 2️⃣ Vá em **"Minhas aplicações" → "Criar aplicação"**.
>
> 3️⃣ Preencha:
> - **Nome:** Rose Artesanatos Sistema
> - **Nome curto:** rose-artesanatos
> - **Descrição:** Sistema interno de gestão de pedidos
> - **URL de redirecionamento:** `https://SEU-PROJETO.vercel.app/api/auth/callback`
> - **Usar PKCE:** deixe desmarcado
> - **Escopos:** marque Leitura e Escrita
> - **Tópicos:** não marque nenhum
>
> 4️⃣ Clique em **Salvar**.
>
> 5️⃣ Você vai ver dois códigos na tela: **Client ID** e **Client Secret**. Me envie os
> dois por aqui mesmo (WhatsApp), por favor — só não publique em nenhum grupo ou rede
> social, pois são como uma senha do seu Mercado Livre.
>
> Qualquer dúvida em alguma tela, me chama que eu te ajudo ao vivo! 😊

---

## 🔧 O que o desenvolvedor faz depois de receber as credenciais

```
1. Recebeu Client ID (App ID) + Client Secret (Secret Key) do cliente
      ↓
2. Configura as variáveis de ambiente no dashboard da Vercel:
   ML_APP_ID     = (Client ID do cliente)
   ML_SECRET     = (Client Secret do cliente)
   ML_REDIRECT   = https://SEU-PROJETO.vercel.app/api/auth/callback
   SUPABASE_URL  = (URL do projeto Supabase)
   SUPABASE_SERVICE_ROLE_KEY = (service role key do Supabase)
      ↓
3. Confirma que a URL de redirecionamento cadastrada no app do Mercado Livre
   é IDÊNTICA à variável ML_REDIRECT
      ↓
4. No sistema (tela de Configurações), o cliente clica em
   "Conectar com Mercado Livre"
      ↓
5. Uma janela abre pedindo login/autorização — o cliente confirma
      ↓
6. ✅ Sistema conectado! O badge muda para "Conectado" e o botão
   "Importar Pedidos" aparece no banner do topo.
```

---

## ❓ Perguntas frequentes / problemas comuns

**"Não aparece o botão de criar aplicação, ou dá erro dizendo que já existe um."**
No Brasil só é permitido 1 aplicativo por conta. Acesse "Minhas aplicações", abra o
existente em "Editar" e siga direto para o Passo 4 (as credenciais já estão lá).

**"Deu erro 403 / a conta não permite criar aplicativo."**
Geralmente é porque os dados da conta ML (CPF/CNPJ, endereço) estão incompletos ou
divergentes do cadastro. Oriente o cliente a checar os dados da conta em
"Minha conta" ou falar com o suporte do Mercado Livre.

**"O cliente perdeu ou não copiou o Client Secret."**
Não tem problema: em "Minhas aplicações → Configurações" dá para revelar o Client
Secret novamente a qualquer momento, ou gerar um novo com "Renove agora" (efeito
imediato — o Client Secret antigo para de funcionar na hora) ou "Programar renovação"
(fica um tempo de transição com os dois válidos, mais seguro para trocar a variável na
Vercel sem derrubar a conexão).

**"Autorizei, mas o sistema não conectou / deu erro de redirect_uri."**
Confira se a URL cadastrada no app do Mercado Livre é exatamente igual (mesmo
protocolo `https://`, mesmo domínio, mesmo caminho `/api/auth/callback`, sem barra a
mais no final) à variável `ML_REDIRECT` configurada na Vercel.

**"Preciso testar antes de usar a conta real do cliente."**
O Mercado Livre oferece um ambiente de testes (contas de teste) documentado em
[developers.mercadolivre.com.br/devcenter](https://developers.mercadolivre.com.br) —
procure por "Realização de testes" na documentação, mas para este sistema (uso único,
loja real) normalmente vale a pena ir direto com a conta de produção do cliente.
