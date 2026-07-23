const { getValidToken, mlGet } = require('../_lib/ml');
const { getSupabase } = require('../_lib/supabase');
const { requireAuth } = require('../_lib/auth');

module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const token = await getValidToken();
    if (!token) return res.status(401).json({ error: 'Não autenticado no ML.' });

    const supabase = getSupabase();
    const me     = await mlGet('/users/me', token);
    const search = await mlGet(`/orders/search?seller=${me.id}&order.status=paid&sort=date_desc`, token);
    const orders = search.results || [];

    const { data: already } = await supabase.from('ml_imported_orders').select('ml_id');
    const knownIds = new Set((already || []).map(r => r.ml_id));

    const pedidos = [];
    for (const order of orders) {
      const mlId = String(order.id);
      if (knownIds.has(mlId)) continue;
      const item = order.order_items?.[0];
      pedidos.push({
        id:       mlId + '_ml',
        ml_id:    mlId,
        ml:       `ML-${mlId}`,
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

    res.status(200).json({ importados: pedidos.length, pedidos });
  } catch (err) {
    console.error('[ML] Erro ao importar:', err.response?.data || err.message);
    res.status(500).json({ error: 'Erro ao buscar pedidos no ML.' });
  }
};
