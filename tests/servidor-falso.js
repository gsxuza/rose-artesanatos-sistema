// Servidor de teste: serve o sistema real (index.html, css/, js/) e simula as
// rotas /api. O "Mercado Livre" é o objeto ML abaixo, que o teste altera em
// tempo de execução para simular um cancelamento lá.
//
// Sobe sozinho quando o e2e.js roda; não precisa ser iniciado à mão.

const http = require('http');
const fs   = require('fs');
const path = require('path');

const ROOT  = path.resolve(__dirname, '..');
const PORTA = Number(process.env.PORTA || 4321);
const SENHA = 'rose123';
const TOKEN = 'token-de-teste';

// Estado do "Mercado Livre". O teste vira `cancelado` para true via POST /_ml.
// O ML-104 falha sempre de propósito: serve para provar que erro de rede não
// pode virar cancelamento.
const ML = {
  '101': { cancelado: false },
  '102': { cancelado: false },
  '103': { cancelado: false },
  '104': { cancelado: false, erro: true },
};

const hoje = new Date().toISOString().split('T')[0];

// Estado inicial. O ML-103 já foi despachado, então tem receita e despesas
// automáticas lançadas — é o caso que importa: cancelar depois do despacho.
// A despesa de MDF é manual e não pode ser estornada por nada.
const estadoInicial = () => ({
  data: {
    pedidos: [
      { id:'a', ml:'ML-101', sku:'ART-1', produto:'Caixa MDF',    qtd:1, resp:'Daniel', valor:100, status:'pendente',   criadoEm:hoje },
      { id:'b', ml:'ML-102', sku:'ART-2', produto:'Porta-Retrato',qtd:2, resp:'Luiz',   valor:200, status:'embalado',   criadoEm:hoje },
      { id:'c', ml:'ML-103', sku:'ART-3', produto:'Bandeja',      qtd:1, resp:'Daniel', valor:300, status:'despachado', criadoEm:hoje, despachadoEm:hoje },
      { id:'d', ml:'ML-104', sku:'ART-4', produto:'Quadro',       qtd:1, resp:'Yasmin', valor:400, status:'pendente',   criadoEm:hoje },
      { id:'e', ml:'VENDA-DIRETA-1', sku:'ART-5', produto:'Vaso', qtd:1, resp:'Luiz',   valor:50,  status:'pendente',   criadoEm:hoje },
    ],
    receitas: [
      { id:'r1', descricao:'Venda: Bandeja', subDesc:'ML-103', valor:300, data:hoje, origem:'auto', pedidoId:'c' },
    ],
    despesas: [
      { id:'x1', descricao:'Taxa Mercado Livre — ML-103', valor:36,  categoria:'Taxas ML',      data:hoje, status:'pago', auto:true,  pedidoId:'c' },
      { id:'x2', descricao:'Embalagem — ML-103',          valor:3.5, categoria:'Embalagens',    data:hoje, status:'pago', auto:true,  pedidoId:'c' },
      { id:'x3', descricao:'Compra de MDF',               valor:80,  categoria:'Matéria-prima', data:hoje, status:'pago', auto:false },
    ],
    estoque: [], enviosFull: [], despesasRecorrentes: [], appliedRecurring: [],
    config: { mlConnected:true, taxaML:12, custoEmbalagem:3.50,
              hCorte:'08:00', hDespacho:'14:00', nomeEmpresa:'Rose Artesanatos' },
  },
  updated_at: new Date().toISOString(),
});

// Catálogo de vendas pagas no "ML". A 105 e a 106 ainda não estão no sistema.
const VENDAS = [
  { id:'101', sku:'ART-1', produto:'Caixa MDF',     valor:100 },
  { id:'102', sku:'ART-2', produto:'Porta-Retrato', valor:200 },
  { id:'103', sku:'ART-3', produto:'Bandeja',       valor:300 },
  { id:'104', sku:'ART-4', produto:'Quadro',        valor:400 },
  { id:'105', sku:'ART-6', produto:'Luminária',     valor:150 },
  { id:'106', sku:'ART-7', produto:'Espelho',       valor:250 },
];

let STATE = estadoInicial();
const CHAMADAS = { status: 0, importar: 0, idsConsultados: [] };

const MIME = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json' };

const corpo = (req) => new Promise(r => {
  let b = ''; req.on('data', c => b += c);
  req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } });
});
const json = (res, code, obj) => { res.writeHead(code, {'Content-Type':'application/json'}); res.end(JSON.stringify(obj)); };
const autorizado = (req) => (req.headers.authorization || '') === 'Bearer ' + TOKEN;

const server = http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname;

  if (p === '/api/login') {
    const b = await corpo(req);
    return b.password === SENHA ? json(res, 200, { token: TOKEN })
                                : json(res, 401, { error: 'Senha incorreta.' });
  }

  if (p === '/api/auth/status') return json(res, 200, { connected: true });

  if (p === '/api/state') {
    if (!autorizado(req)) return json(res, 401, { error: 'Não autorizado.' });
    if (req.method === 'GET') return json(res, 200, STATE);
    STATE = { data: await corpo(req), updated_at: new Date().toISOString() };
    return json(res, 200, { ok: true, updated_at: STATE.updated_at });
  }

  // Espelha api/pedidos/status.js: consulta pedido a pedido pelo ID.
  if (p === '/api/pedidos/status') {
    if (!autorizado(req)) return json(res, 401, { error: 'Não autorizado.' });
    CHAMADAS.status++;
    const b = await corpo(req);
    const ids = (b.ids || []).map(s => String(s).replace(/^ML-/, ''));
    CHAMADAS.idsConsultados.push(...ids);
    let erros = 0; const statuses = [];
    ids.forEach(id => {
      const o = ML[id];
      if (!o || o.erro) { erros++; statuses.push({ ml:'ML-'+id, ok:false, cancelado:false, status:null }); }
      else statuses.push({ ml:'ML-'+id, ok:true, cancelado:o.cancelado, status:o.cancelado?'cancelled':'paid' });
    });
    return json(res, 200, { statuses, erros, checados: ids.length });
  }

  // Espelha api/pedidos/importar.js: devolve o que o sistema NÃO tem.
  // VENDAS é o catálogo de vendas pagas no "ML".
  if (p === '/api/pedidos/importar') {
    if (!autorizado(req)) return json(res, 401, { error: 'Não autorizado.' });
    CHAMADAS.importar++;
    const b = await corpo(req);
    const jaTenho = new Set((b.jaTenho || []).map(String));
    CHAMADAS.ultimoJaTenho = [...jaTenho];
    const pagas = VENDAS.filter(v => !ML[v.id] || !ML[v.id].cancelado);
    const pedidos = pagas.filter(v => !jaTenho.has('ML-' + v.id)).map(v => ({
      id: v.id + '_ml', ml_id: v.id, ml: 'ML-' + v.id, sku: v.sku,
      produto: v.produto, qtd: 1, resp: 'Daniel', valor: v.valor,
      status: 'pendente', criadoEm: hoje,
    }));
    return json(res, 200, {
      importados: pedidos.length, pedidos,
      cancelados: Object.keys(ML).filter(id => ML[id].cancelado).map(id => 'ML-' + id),
      vistosNoML: pagas.length, jaTinha: jaTenho.size,
    });
  }

  // Painel de controle do teste (não existe em produção).
  if (p === '/_ml')     { const b = await corpo(req); Object.assign(ML[b.id], b.patch); return json(res, 200, ML); }
  if (p === '/_estado') return json(res, 200, { state: STATE, chamadas: CHAMADAS });

  // Arquivos estáticos do sistema real.
  const f = path.join(ROOT, p === '/' ? 'index.html' : p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) {
    res.writeHead(404); return res.end('404');
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'text/plain' });
  res.end(fs.readFileSync(f));
});

if (require.main === module) server.listen(PORTA, () => console.log('servidor de teste na ' + PORTA));

module.exports = { server, PORTA, SENHA };
