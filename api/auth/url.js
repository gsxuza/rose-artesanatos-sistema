const { ML_APP_ID } = require('../_lib/ml');

module.exports = (req, res) => {
  const redirect = process.env.ML_REDIRECT || '';
  const url = `https://auth.mercadolivre.com.br/authorization?response_type=code`
    + `&client_id=${ML_APP_ID}&redirect_uri=${encodeURIComponent(redirect)}`;
  res.status(200).json({ url });
};
