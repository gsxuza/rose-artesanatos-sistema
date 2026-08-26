const axios = require('axios');
const { getSupabase } = require('./supabase');

const ML_APP_ID = process.env.ML_APP_ID || '';
const ML_SECRET = process.env.ML_SECRET || '';

// Renova o token um pouco antes de expirar, para nunca usar um token vencido
// no meio de uma requisição.
const MARGEM_MS = 5 * 60 * 1000;

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

async function renovar(refreshToken) {
  const res = await axios.post('https://api.mercadolibre.com/oauth/token', {
    grant_type:    'refresh_token',
    client_id:     ML_APP_ID,
    client_secret: ML_SECRET,
    refresh_token: refreshToken,
  });
  const tokens = {
    access_token:  res.data.access_token,
    refresh_token: res.data.refresh_token,
    expires_at:    Date.now() + res.data.expires_in * 1000,
  };
  await writeTokenRow(tokens);
  return tokens.access_token;
}

// Devolve um access_token válido, renovando quando necessário.
//
// O refresh_token do ML é de uso único: cada renovação devolve um novo e
// invalida o anterior. Como cada requisição roda numa função isolada, duas
// pessoas usando o sistema ao mesmo tempo podem tentar renovar com o mesmo
// token — a segunda falha e a integração fica fora do ar até reconectar à mão.
// Era um dos motivos de a importação funcionar uma hora e outra não.
//
// Não dá para travar entre instâncias sem um lock, então tratamos a corrida:
// se a renovação falhar, relemos a linha. Se outra instância já renovou (o
// expires_at andou para frente), usamos o token dela em vez de dar erro.
async function getValidToken({ forcar = false } = {}) {
  const row = await readTokenRow();
  if (!row || !row.refresh_token) return null;

  const valido = Date.now() < Number(row.expires_at || 0) - MARGEM_MS;
  if (valido && !forcar) return row.access_token;

  try {
    return await renovar(row.refresh_token);
  } catch (err) {
    console.warn('[ML] Renovação falhou; verificando se outra instância já renovou:',
                 err.response?.data || err.message);

    const atual = await readTokenRow();
    const outraRenovou = atual
      && Number(atual.expires_at || 0) > Number(row.expires_at || 0)
      && Date.now() < Number(atual.expires_at || 0);
    if (outraRenovou) return atual.access_token;

    console.error('[ML] Não foi possível renovar o token. É preciso reconectar o Mercado Livre.');
    return null;
  }
}

// GET na API do ML. Se o ML recusar por token (401/403), renova à força e tenta
// mais uma vez — cobre o caso do token trocado por outra instância no meio.
async function mlGet(endpoint, token) {
  try {
    const res = await axios.get(`https://api.mercadolibre.com${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (err) {
    const code = err.response?.status;
    if (code !== 401 && code !== 403) throw err;

    const novo = await getValidToken({ forcar: true });
    if (!novo || novo === token) throw err;

    const res = await axios.get(`https://api.mercadolibre.com${endpoint}`, {
      headers: { Authorization: `Bearer ${novo}` },
    });
    return res.data;
  }
}

module.exports = { ML_APP_ID, ML_SECRET, readTokenRow, writeTokenRow, getValidToken, mlGet };
