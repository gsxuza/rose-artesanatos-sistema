# Testes

Teste de ponta a ponta do acompanhamento de cancelamentos do Mercado Livre.

Sobe o sistema real num servidor local e o dirige num Chromium de verdade,
como a equipe usaria: faz login, olha a tela de pedidos, manda o "ML" cancelar
uma venda e confere o que acontece.

## Rodar

```bash
cd tests
npm install
npx playwright install chromium   # só na primeira vez
npm test
```

Para gerar os prints das telas em `tests/`:

```bash
PRINTS=1 npm test
```

Se a máquina já tiver um Chromium (sandbox, CI), aponte para ele em vez de
baixar outro:

```bash
CHROMIUM_PATH=/caminho/para/chrome npm test
```

## Por que este `package.json` é separado

O Playwright **não pode** entrar no build da Vercel. A Vercel instala as
dependências do `package.json` da raiz — incluindo as de desenvolvimento — e
baixar navegador no build é lento e desnecessário para servir o site.

Mantendo um projeto npm separado aqui dentro, a raiz continua com apenas
`@supabase/supabase-js` e `axios`. O `.vercelignore` também deixa a pasta
`tests/` fora do deploy.

Ou seja: **rodar ou alterar os testes nunca afeta o site no ar.**

## O que é coberto

| # | Verifica |
|---|---|
| 1 | Login: senha errada recusada, senha certa entra |
| 2 | Estado inicial, com a receita do pedido já despachado |
| 3 | A verificação de cancelamentos roda sozinha ao abrir |
| 4 | Cancelamento vindo do ML, **inclusive de pedido já despachado** |
| 5 | Estorno da receita, da taxa ML e da embalagem — **preservando lançamentos manuais** |
| 6 | Cancelado sai do fluxo (sem "Avançar", ganha "Reabrir") |
| 7 | **Lista de impressão exclui cancelados** |
| 8 | Dashboard: KPIs, pedidos recentes e alerta |
| 9 | Cancelamento manual e reabertura |
| 10 | Rodar de novo não duplica nem re-estorna |
| 11 | **Importação traz o que falta e recupera pedido perdido** |
| 12 | Pedido removido de propósito não volta na importação |
| 13 | Nenhuma exceção de JavaScript nem falha de rede inesperada |

O caso mais importante é o do **ML-104**: ele falha em toda consulta ao ML.
O teste garante que uma falha de rede **nunca** vira cancelamento — apagar uma
venda real por engano é muito pior do que descobrir o cancelamento no ciclo
seguinte.

## Limite conhecido

O Mercado Livre aqui é simulado (`servidor-falso.js`). Estes testes provam o
comportamento do sistema, não o formato da resposta real da API do ML — isso só
o primeiro uso em produção confirma.
