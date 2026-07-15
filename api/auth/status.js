const { readTokenRow } = require('../_lib/ml');

module.exports = async (req, res) => {
  try {
    const row = await readTokenRow();
    res.status(200).json({ connected: !!(row && row.refresh_token) });
  } catch (err) {
    console.error('[ML] Erro ao ler status:', err.message);
    res.status(500).json({ connected: false, error: 'Erro ao consultar status.' });
  }
};
