const axios = require('axios');
const { getSupabase } = require('./supabase');

const ML_APP_ID = process.env.ML_APP_ID || '';
const ML_SECRET = process.env.ML_SECRET || '';

async function readTokenRow() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('ml_tokens').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data;
}

async function writeTokenRow(tokens) {
  const supabase = getSupabase();
  const { error } = await supabase.from('ml_tokens').upsert({ id: 1, ...tokens });
  if (error) throw error;
}

// Retorna um access_token válido, renovando via refresh_token se necessário.
async function getValidToken() {
  const row = await readTokenRow();
  if (!row || !row.refresh_token) return null;
  if (Date.now() < row.expires_at - 60_000) return row.access_token;

  const res = await axios.post('https://api.mercadolibre.com/oauth/token', {
    grant_type: 'refresh_token',
    client_id: ML_APP_ID,
    client_secret: ML_SECRET,
    refresh_token: row.refresh_token,
  });

  const tokens = {
    access_token: res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_at: Date.now() + res.data.expires_in * 1000,
  };
  await writeTokenRow(tokens);
  return tokens.access_token;
}

async function mlGet(endpoint, token) {
  const res = await axios.get(`https://api.mercadolibre.com${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data;
}

module.exports = { ML_APP_ID, ML_SECRET, readTokenRow, writeTokenRow, getValidToken, mlGet };
