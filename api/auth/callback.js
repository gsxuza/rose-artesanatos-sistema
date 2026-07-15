const axios = require('axios');
const { ML_APP_ID, ML_SECRET, writeTokenRow } = require('../_lib/ml');

module.exports = async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('Código de autorização ausente.');

  try {
    const r = await axios.post('https://api.mercadolibre.com/oauth/token', {
      grant_type: 'authorization_code',
      client_id: ML_APP_ID,
      client_secret: ML_SECRET,
      code,
      redirect_uri: process.env.ML_REDIRECT || '',
    });

    await writeTokenRow({
      access_token: r.data.access_token,
      refresh_token: r.data.refresh_token,
      expires_at: Date.now() + r.data.expires_in * 1000,
    });

    res.status(200).send(`<script>
      window.opener && window.opener.postMessage('ml_connected', '*');
      setTimeout(() => window.close(), 1000);
    </script>
    <p style="font-family:sans-serif;text-align:center;padding:40px">
      ✅ Conectado! Esta janela fechará automaticamente.
    </p>`);
  } catch (err) {
    console.error('[ML] Erro no callback:', err.response?.data || err.message);
    res.status(500).send('Erro ao autenticar. Verifique as credenciais na Vercel.');
  }
};
