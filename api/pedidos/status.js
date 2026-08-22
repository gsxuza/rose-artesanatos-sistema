const { getValidToken, mlGet } = require('../_lib/ml');
const { requireAuth } = require('../_lib/auth');

// Consulta no ML o status ATUAL de pedidos que já estão no sistema.
//
// A importação só enxerga vendas novas. Mas um pedido já emitido pode ser
// cancelado depois — inclusive depois de despachado. Sem perguntar ao ML "como
// está esse pedido agora?", o sistema continuaria tratando como venda válida
// algo que o ML já cancelou. Por isso aqui a consulta é pedido a pedido, pelo
// ID, e não por uma lista de cancelados recentes (que deixaria escapar um
// pedido antigo cancelado hoje).
//
// POST { ids: ["ML-123", "456", ...] } → { statuses: [...], erros: n }

const MAX_IDS     = 60;   // teto por chamada, para não estourar o tempo da função
const CONCORRENCIA = 6;   // requisições simultâneas ao ML

// Aceita "ML-123" ou "123" e devolve só o número.
const somenteId = (ref) => String(ref || '').replace(/^ML-/i, '').trim();

function classificar(order) {
  const envio = (order.shipping && order.shipping.status) || null;
  const cancelado = order.status === 'cancelled' || envio === 'cancelled';
  return {
    status: order.status || null,
    envio,
    cancelado,
    detalhe: order.status_detail || null,
  };
}

// Executa as consultas em lotes pequenos e paralelos.
async function consultarTodos(ids, token) {
  const statuses = [];
  let erros = 0;

  for (let i = 0; i < ids.length; i += CONCORRENCIA) {
    const lote = ids.slice(i, i + CONCORRENCIA);
    const res = await Promise.all(lote.map(async (id) => {
      try {
        const order = await mlGet(`/orders/${id}`, token);
        return { mlId: id, ml: `ML-${id}`, ok: true, ...classificar(order) };
      } catch (err) {
        // Falha de rede ou pedido inacessível NÃO vira cancelamento: na dúvida,
        // o pedido continua como está. Cancelar por engano é pior do que
        // descobrir o cancelamento no próximo ciclo.
        const code = err.response?.status;
        console.error(`[ML] Falha ao consultar pedido ${id}:`, code || err.message);
        return { mlId: id, ml: `ML-${id}`, ok: false, cancelado: false, status: null };
      }
    }));
    res.forEach(r => { if (!r.ok) erros++; statuses.push(r); });
  }

  return { statuses, erros };
}

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }

    const brutos = (body && Array.isArray(body.ids)) ? body.ids : null;
    if (!brutos) return res.status(400).json({ error: 'Envie { ids: [...] }.' });

    // Só IDs numéricos do ML, sem repetição, dentro do teto.
    const ids = [...new Set(brutos.map(somenteId).filter(id => /^\d+$/.test(id)))].slice(0, MAX_IDS);
    if (!ids.length) return res.status(200).json({ statuses: [], erros: 0, checados: 0 });

    const token = await getValidToken();
    if (!token) return res.status(401).json({ error: 'Não autenticado no ML.' });

    const { statuses, erros } = await consultarTodos(ids, token);
    return res.status(200).json({ statuses, erros, checados: ids.length });
  } catch (err) {
    console.error('[ML] Erro ao consultar status:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Erro ao consultar status dos pedidos no ML.' });
  }
};
