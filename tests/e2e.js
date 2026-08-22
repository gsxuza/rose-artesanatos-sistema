// Teste de ponta a ponta do acompanhamento de cancelamentos do Mercado Livre.
//
// Sobe o sistema real num servidor local (servidor-falso.js) e o dirige num
// Chromium de verdade, como a equipe usaria. O "ML" é simulado — o objetivo é
// provar o comportamento do sistema, não a API do Mercado Livre.
//
// Rodar:  cd tests && npm install && npm test

const { chromium } = require('playwright');
const { server, PORTA, SENHA } = require('./servidor-falso');

const B='\x1b[1m', V='\x1b[32m', R='\x1b[31m', C='\x1b[2m', F='\x1b[0m';
let passou = 0; const falhas = [];

function ok(desc, cond, extra) {
  if (cond) { passou++; console.log(`  ${V}✓${F} ${desc}`); }
  else { falhas.push(desc); console.log(`  ${R}✗ ${desc}${F}${extra ? `  ${C}→ ${extra}${F}` : ''}`); }
}
const titulo = (t) => console.log(`\n${B}${t}${F}`);

(async () => {
  await new Promise(r => server.listen(PORTA, r));

  // Em máquinas que já têm um Chromium (sandbox, CI), aponte por CHROMIUM_PATH
  // em vez de deixar o Playwright baixar o dele.
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  const excecoesJS = [], falhasRede = [];
  page.on('dialog', d => d.accept());
  page.on('pageerror', e => excecoesJS.push(e.message));
  page.on('requestfailed', r => falhasRede.push(r.url() + ' → ' + (r.failure() || {}).errorText));
  page.on('response', r => { if (r.status() >= 400) falhasRede.push(r.url() + ' → HTTP ' + r.status()); });

  const setML = (id, patch) => page.evaluate(([id, patch]) => fetch('/_ml', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ id, patch }),
  }).then(r => r.json()), [id, patch]);

  const servidor = () => page.evaluate(() => fetch('/_estado').then(r => r.json()));

  const linhas = () => page.$$eval('#ped-tbody tr:not(.group-row)', rs => rs.map(r => ({
    ml:        r.querySelector('td:nth-child(2)')?.innerText.trim(),
    status:    r.querySelector('td:nth-child(7)')?.innerText.trim().split('\n')[0],
    cancelada: r.classList.contains('row-cancelada'),
    acoes:     r.querySelector('td:nth-child(8)')?.innerText.replace(/\s+/g,' ').trim(),
  })));

  await page.goto(`http://localhost:${PORTA}/`);

  titulo('1. Login');
  await page.waitForSelector('#login-overlay.open', { timeout: 5000 });
  ok('tela de login aparece', true);
  await page.fill('#login-pass', 'senha-errada');
  await page.click('#login-btn');
  await page.waitForTimeout(400);
  ok('senha errada é recusada', (await page.textContent('#login-error')).includes('incorreta'));
  await page.fill('#login-pass', SENHA);
  await page.click('#login-btn');
  await page.waitForSelector('#login-overlay.open', { state: 'hidden', timeout: 5000 });
  ok('senha certa entra no sistema', true);
  await page.waitForTimeout(600);

  titulo('2. Estado inicial — nada cancelado ainda');
  await page.click('.nav-link[data-sec="pedidos"]');
  await page.waitForTimeout(300);
  let L = await linhas();
  ok('5 pedidos na tela', L.length === 5, `veio ${L.length}`);
  ok('nenhum aparece como cancelado', L.every(l => !l.cancelada));
  ok('receita do mês = R$300', (await page.textContent('#kpi-receita')).includes('300'),
     await page.textContent('#kpi-receita'));

  titulo('3. A verificação roda sozinha ao abrir');
  const s = await servidor();
  ok('o sistema consultou o ML sem ninguém clicar', s.chamadas.status >= 1, `chamadas=${s.chamadas.status}`);
  ok('venda direta não é consultada no ML', !s.chamadas.idsConsultados.includes('VENDA-DIRETA-1'));

  titulo('4. ML cancela o ML-102 (embalado) e o ML-103 (JÁ DESPACHADO)');
  await setML('102', { cancelado: true });
  await setML('103', { cancelado: true });
  await page.click('#btn-ml-sync');
  await page.waitForTimeout(1200);

  L = await linhas();
  const por = (ml) => L.find(l => l.ml === ml) || {};
  ok('ML-102 marcado como Cancelado', por('ML-102').status === 'Cancelado', por('ML-102').status);
  ok('ML-103 (despachado) marcado como Cancelado', por('ML-103').status === 'Cancelado', por('ML-103').status);
  ok('linha do cancelado fica destacada', por('ML-102').cancelada && por('ML-103').cancelada);
  ok('cancelado mostra a origem "via Mercado Livre"',
     (await page.textContent('#ped-tbody')).includes('via Mercado Livre'));
  ok('ML-101 continua Pendente', por('ML-101').status === 'Pendente', por('ML-101').status);
  ok('ML-104 (erro de rede) NÃO foi cancelado por engano',
     por('ML-104').status === 'Pendente', por('ML-104').status);
  ok('venda direta não foi afetada', por('VENDA-DIRETA-1').status === 'Pendente');

  titulo('5. Financeiro estornado');
  ok('receita do ML-103 saiu do mês', /R\$0$/.test(await page.textContent('#kpi-receita')),
     await page.textContent('#kpi-receita'));
  const st = (await servidor()).state.data;
  ok('receita automática removida', !st.receitas.some(r => r.pedidoId === 'c'));
  ok('taxa ML e embalagem removidas', !st.despesas.some(d => d.auto && d.pedidoId === 'c'));
  ok('despesa MANUAL de MDF preservada', st.despesas.some(d => d.descricao === 'Compra de MDF'),
     JSON.stringify(st.despesas.map(d => d.descricao)));
  ok('cancelamento foi salvo no servidor', st.pedidos.filter(p => p.status === 'cancelado').length === 2);

  titulo('6. Cancelado sai do fluxo');
  ok('cancelado não tem botão Avançar', !por('ML-102').acoes.includes('Avançar'), por('ML-102').acoes);
  ok('cancelado ganha botão Reabrir', por('ML-102').acoes.includes('Reabrir'));

  titulo('7. Lista de impressão exclui cancelados');
  await page.click('button:has-text("🖨 Imprimir")');
  await page.waitForSelector('#modal-imprimir.open', { timeout: 5000 });
  const imp = await page.textContent('#imp-datas');
  ok('modal de impressão abriu', true);
  ok('conta só os 3 pedidos válidos', /3 pedido\(s\)/.test(imp), imp.replace(/\s+/g,' ').trim());
  const total = imp.match(/R\$[\s ]?([\d.,]+)/);
  ok('total do dia = R$550 (100+400+50, sem os cancelados)',
     total && total[1].replace('.','') === '550,00', total && total[1]);
  await page.click('#modal-imprimir button:has-text("Cancelar")');

  titulo('8. Dashboard');
  await page.click('.nav-link[data-sec="dashboard"]');
  await page.waitForTimeout(300);
  ok('KPI mostra 3 pedidos ativos', (await page.textContent('#kpi-pedidos')).trim() === '3',
     await page.textContent('#kpi-pedidos'));
  ok('KPI informa os 2 cancelados', (await page.textContent('#kpi-pedidos-sub')).includes('2 cancelado'),
     await page.textContent('#kpi-pedidos-sub'));
  const recentes = await page.textContent('#dash-tbody');
  ok('cancelados fora dos pedidos recentes', !recentes.includes('ML-102') && !recentes.includes('ML-103'));
  ok('alerta de cancelamento aparece', (await page.textContent('#dash-alertas')).includes('cancelado'),
     (await page.textContent('#dash-alertas')).replace(/\s+/g,' ').slice(0, 90));

  titulo('9. Cancelamento manual e reabertura');
  await page.click('.nav-link[data-sec="pedidos"]');
  await page.waitForTimeout(300);
  await page.click('#ped-tbody tr:has-text("ML-101") button:has-text("Cancelar")');
  await page.waitForTimeout(700);
  ok('ML-101 cancelado manualmente', (await linhas()).find(l => l.ml === 'ML-101').status === 'Cancelado');
  await page.click('#ped-tbody tr:has-text("ML-101") button:has-text("Reabrir")');
  await page.waitForTimeout(700);
  ok('ML-101 reaberto volta a Pendente', (await linhas()).find(l => l.ml === 'ML-101').status === 'Pendente');

  titulo('10. Rodar de novo não duplica nem re-estorna');
  const antes = (await servidor()).state.data;
  await page.click('#btn-ml-sync');
  await page.waitForTimeout(1200);
  const depois = (await servidor()).state.data;
  ok('nº de cancelados não muda',
     depois.pedidos.filter(p=>p.status==='cancelado').length === antes.pedidos.filter(p=>p.status==='cancelado').length);
  ok('nada foi re-estornado',
     depois.receitas.length === antes.receitas.length && depois.despesas.length === antes.despesas.length);

  titulo('11. Saúde da página');
  ok('nenhuma exceção de JavaScript', excecoesJS.length === 0, excecoesJS.slice(0,3).join(' | '));
  // Ruído esperado do ambiente: as fontes do Google podem estar bloqueadas em
  // sandbox/CI, e o 401 é o login errado que o próprio teste provoca.
  const ruido = (m) => /fonts\.(googleapis|gstatic)\.com/.test(m) || m.includes('/api/login');
  const reais = falhasRede.filter(m => !ruido(m));
  ok('nenhuma falha de rede inesperada', reais.length === 0, reais.slice(0,4).join(' | '));
  const ignorados = [...new Set(falhasRede.filter(ruido))];
  if (ignorados.length) {
    console.log(`  ${C}(ignorados ${ignorados.length} ruído(s) esperado(s) do ambiente:${F}`);
    ignorados.forEach(m => console.log(`  ${C}   - ${m.slice(0, 110)}${F}`));
    console.log(`  ${C}   fontes do Google bloqueadas + o 401 do login errado proposital)${F}`);
  }

  if (process.env.PRINTS) {
    await page.click('.nav-link[data-sec="pedidos"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: __dirname + '/pedidos.png' });
    await page.click('.nav-link[data-sec="dashboard"]');
    await page.waitForTimeout(400);
    await page.screenshot({ path: __dirname + '/dashboard.png' });
    console.log(`\n  ${C}prints salvos em tests/${F}`);
  }

  await browser.close();
  server.close();

  console.log(`\n${B}${passou} passaram, ${falhas.length} falharam${F}`);
  if (falhas.length) { console.log(R + falhas.map(f => '  - ' + f).join('\n') + F); process.exit(1); }
})().catch(e => { console.error('ERRO NO TESTE:', e); process.exit(1); });
