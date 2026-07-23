const { getSupabase } = require('./_lib/supabase');
const { requireAuth } = require('./_lib/auth');

// Estado compartilhado do sistema (linha única em app_state).
// GET  → devolve { data, updated_at } com todo o "banco" do app.
// POST → grava o corpo recebido como novo estado e devolve o updated_at.
// Protegido: exige token de sessão válido (login).
module.exports = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const supabase = getSupabase();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('app_state').select('data, updated_at').eq('id', 1).maybeSingle();
      if (error) throw error;
      return res.status(200).json({
        data: data ? data.data : null,
        updated_at: data ? data.updated_at : null,
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch { body = null; }
      }
      if (!body || typeof body !== 'object') {
        return res.status(400).json({ error: 'Corpo inválido.' });
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('app_state').upsert({ id: 1, data: body, updated_at: now });
      if (error) throw error;
      return res.status(200).json({ ok: true, updated_at: now });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('[STATE] erro:', err.message);
    return res.status(500).json({ error: 'Erro ao acessar o estado do sistema.' });
  }
};
