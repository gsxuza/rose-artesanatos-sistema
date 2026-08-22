const { getValidToken, mlGet } = require('../_lib/ml');
const { getSupabase } = require('../_lib/supabase');
const { requireAuth } = require('../_lib/auth');

// Um pedido do ML pode ser cancelado depois de pago (o comprador desiste, o
// envio é cancelado, o ML cancela por falta de estoque...). Sem acompanhar
// isso, uma venda cancelada continuaria contando como receita e entraria na
// lista de separação. Por isso o import devolve duas coisas:
//   pedidos    → vendas pagas ainda não importadas (novas)
//   cancelados → nº dos pedidos que o ML já marcou como cancelados
const ML_PAGE = 50;

// Normaliza para o mesmo formato usado no app ("ML-123456").
const mlRef = (id) => `ML-${id}`;

// Um pedido conta como cancelado se o próprio pedido foi cancelado ou se o
// envio associado foi cancelado (as duas coisas andam juntas na operação).
function isCancelado(order) {
  if (!order) return false;
  if (order.status === 'cancelled') return true;
  const envio = order.shipping && order.shipping.status;
  return envio === 'cancelled';
}

async function buscarPorStatus(sellerId, status, token) {
  try {
    const r = await mlGet(
      `/orders/search?seller=${sellerId}&order.status=${status}` +
      `&sort=date_desc&limit=${ML_PAGE}`, token);
    return r.results || [];
  } catch (err) {
    console.error(`[ML] Falha ao buscar pedidos "${status}":`, err.response?.data || err.message);
    return [];
  }
}

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const token = await getValidToken();
    if (!token) return res.status(401).json({ error: 'Não autenticado no ML.' });

    const supabase = getSupabase();
    const me = await mlGet('/users/me', token);

    // Pagos (candidatos a importação) e cancelados (para baixar no app).
    const [pagos, cancelados] = await Promise.all([
      buscarPorStatus(me.id, 'paid', token),
      buscarPorStatus(me.id, 'cancelled', token),
    ]);

    // Um pedido pago cujo envio foi cancelado também é um cancelamento.
    const cancelRefs = new Set();
    cancelados.forEach(o => cancelRefs.add(mlRef(o.id)));
    pagos.filter(isCancelado).forEach(o => cancelRefs.add(mlRef(o.id)));

    const { data: already } = await supabase.from('ml_imported_orders').select('ml_id');
    const knownIds = new Set((already || []).map(r => r.ml_id));

    const pedidos = [];
    for (const order of pagos) {
      const mlId = String(order.id);
      if (knownIds.has(mlId)) continue;
      if (isCancelado(order)) continue;   // não importa algo que já nasceu cancelado
      const item = order.order_items?.[0];
      pedidos.push({
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
      });
    }

    if (pedidos.length) {
      await supabase.from('ml_imported_orders').insert(pedidos.map(p => ({ ml_id: p.ml_id })));
    }

    res.status(200).json({
      importados: pedidos.length,
      pedidos,
      cancelados: [...cancelRefs],
    });
  } catch (err) {
    console.error('[ML] Erro ao importar:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erro ao buscar pedidos no ML.' });
  }
};
