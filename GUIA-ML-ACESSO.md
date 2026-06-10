# 📋 Guia — Como Solicitar Acesso à API do Mercado Livre ao Cliente

Este documento explica o que você precisa pedir ao cliente (Rose Artesanatos) para configurar a integração com o Mercado Livre.

---

## O que você precisa do cliente

### ✅ 1. Acesso à conta de desenvolvedor ML

Peça ao cliente para acessar [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br) com **o mesmo e-mail da conta vendedora deles no ML**.

> 💡 **Dica:** Acompanhe o cliente na primeira vez. Leva menos de 5 minutos.

---

### ✅ 2. Criar o Aplicativo

No painel de desenvolvedores, peça ao cliente para clicar em **"Criar aplicação"** e preencher:

| Campo | O que colocar |
|-------|--------------|
| Nome do App | `Rose Artesanatos Sistema` |
| Descrição | `Sistema interno de gestão de pedidos` |
| URL de callback | `https://SEU-PROJETO.up.railway.app/auth/callback` *(você fornece depois do deploy)* |
| Tópicos de notificação | Marcar `orders_v2` e `shipments` |

---

### ✅ 3. Copiar as credenciais

Após criar, o cliente verá na tela:

- **App ID** (também chamado de Client ID) — ex: `1234567890`
- **Secret Key** (também chamado de Client Secret) — ex: `abc123XYZetc`

Peça que **copie e envie para você com segurança** (WhatsApp direto, nunca por e-mail aberto).

---

## Como pedir ao cliente (mensagem pronta)

Copie e envie no WhatsApp:

---

> Olá! Para configurar a integração do sistema com o seu Mercado Livre, preciso de um pequeno favor.
>
> Acesse este link com o e-mail da sua conta de vendedor no ML:
> **developers.mercadolivre.com.br**
>
> Clique em "Criar aplicação" e preencha:
> - **Nome:** Rose Artesanatos Sistema
> - **Descrição:** Sistema interno
> - **URL de callback:** *(vou te enviar em seguida)*
> - **Notificações:** marcar orders e shipments
>
> Depois de criar, me envia o **App ID** e o **Secret Key** que aparecem na tela.
>
> É rápido, menos de 5 minutos! 😊

---

## Fluxo completo após receber as credenciais

```
1. Recebeu App ID + Secret Key do cliente
      ↓
2. Configure as variáveis no Railway:
   ML_APP_ID = (App ID do cliente)
   ML_SECRET = (Secret Key do cliente)
   ML_REDIRECT = https://SEU-PROJETO.up.railway.app/auth/callback
      ↓
3. Atualize a URL de callback no painel ML do cliente
   (developers.mercadolivre.com.br → editar app → URL de callback)
      ↓
4. No dashboard, vá em Configurações
   Cole a URL do backend e clique "Salvar"
      ↓
5. Clique em "Conectar com Mercado Livre"
   Uma janela abre para o cliente autorizar
   O cliente faz login e clica "Permitir"
      ↓
6. ✅ Sistema conectado!
   Agora pode importar pedidos automaticamente.
```

---

## ⚠️ Observações importantes

- As credenciais (App ID + Secret) ficam **apenas no servidor Railway**, nunca no código que vai para o GitHub.
- O cliente só precisa autorizar uma vez. O sistema renova o token automaticamente.
- Se o cliente trocar a senha do ML, a autorização pode precisar ser refeita.
- Para ambientes de teste, use a conta ML Sandbox: `developers.mercadolivre.com.br/devcenter`

