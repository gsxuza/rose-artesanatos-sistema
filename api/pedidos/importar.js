const { getValidToken, mlGet } = require('../_lib/ml');
const { requireAuth } = require('../_lib/auth');

// Importa as vendas pagas do Mercado Livre e informa quais pedidos o ML já
// cancelou.
//
// POST { jaTenho: ["ML-123", ...] } → { pedidos, cancelados, ... }
//
// IMPORTANTE — por que não existe mais uma tabela de "já importados":
// A versão anterior gravava o nº do pedido numa tabela (ml_imported_orders)
// ANTES de o navegador conseguir salvar o estado, e depois pulava para sempre
// tudo que estivesse lá. Bastava a gravação falhar (internet caindo, aba
// fechada, sessão expirada) para o pedido ficar marcado como importado no
// servidor sem nunca ter entrado no sistema — e ele nunca mais voltava. Limpar
// os dados ou remover um pedido por engano tinha o mesmo efeito permanente.
// Era isso que fazia a importação "às vezes puxar, às vezes não".
//
// Agora quem sabe o que já existe é o próprio sistema: o navegador manda o que
// tem (`jaTenho`) e o servidor devolve o resto. Se algo se perdeu no caminho,
// a importação seguinte traz de novo — ela se conserta sozinha.

const POR_PAGINA = 50;    // teto do /orders/search do ML
const MAX_PAGINAS = 4;    // até 200 pedidos recentes por busca

const mlRef = (id) => `ML-${id}`;

// Conta como cancelado o pedido cancelado e aquele cujo envio foi cancelado —
// na operação as duas coisas andam juntas.
function isCancelado(order) {
  if (!order) return false;
  if (order.status === 'cancelled') return true;
  return !!(order.shipping && order.shipping.status === 'cancelled');
}

// Percorre as páginas do /orders/search até acabar ou bater o teto.
async function buscarPorStatus(sellerId, status, token) {
  const todos = [];
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const offset = pagina * POR_PAGINA;
    let lote;
    try {
      const r = await mlGet(
        `/orders/search?seller=${sellerId}&order.status=${status}` +
        `&sort=date_desc&limit=${POR_PAGINA}&offset=${offset}`, token);
      lote = r.results || [];
    } catch (err) {
      console.error(`[ML] Falha ao buscar "${status}" (offset ${offset}):`,
                    err.response?.data || err.message);
      break;   // devolve o que já deu para juntar em vez de perder tudo
    }
    todos.push(...lote);
    if (lote.length < POR_PAGINA) break;   // acabou
  }
  return todos;
}

function montarPedido(order) {
  const mlId = String(order.id);
  const item = order.order_items?.[0];
  return {
    id:       mlId + '_ml',
    ml_id:    mlId,
    ml:       mlRef(mlId),
    sku:      item?.item?.seller_sku || item?.item?.id || '-',
    produto:  item?.item?.title || 'Produto',
    qtd:      item?.quantity || 1,
    resp:     'Daniel',
    valor:    order.total_amount || 0,
    status:   'pendente',
    criadoEm: order.date_created?.split('T')[0] || new Date().toISOString().split('T')[0],
  };
}

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const token = await getValidToken();
    if (!token) return res.status(401).json({ error: 'Não autenticado no ML.' });

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    // O que o sistema já tem (qualquer status, inclusive cancelado) e o que o
    // usuário removeu de propósito — nada disso deve voltar.
    const jaTenho = new Set(
      (body && Array.isArray(body.jaTenho) ? body.jaTenho : []).map(String)
    );

    const me = await mlGet('/users/me', token);

    const [pagos, cancelados] = await Promise.all([
      buscarPorStatus(me.id, 'paid', token),
      buscarPorStatus(me.id, 'cancelled', token),
    ]);

    const cancelRefs = new Set();
    cancelados.forEach(o => cancelRefs.add(mlRef(o.id)));
    pagos.filter(isCancelado).forEach(o => cancelRefs.add(mlRef(o.id)));

    const pedidos = pagos
      .filter(o => !isCancelado(o))              // não importa o que já nasceu cancelado
      .filter(o => !jaTenho.has(mlRef(o.id)))    // nem o que o sistema já tem
      .map(montarPedido);

    return res.status(200).json({
      importados:  pedidos.length,
      pedidos,
      cancelados:  [...cancelRefs],
      // Diagnóstico: ajuda a responder "por que não veio nada?" sem adivinhação.
      vistosNoML:  pagos.length,
      jaTinha:     jaTenho.size,
    });
  } catch (err) {
    console.error('[ML] Erro ao importar:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Erro ao buscar pedidos no ML.' });
  }
};
