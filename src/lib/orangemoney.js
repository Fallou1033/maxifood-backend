const axios = require('axios');

const OM_BASE_URL = 'https://api.orange.com/orange-money-webpay/sn/v1';

/**
 * Récupère un token d'accès Orange Money
 */
const getTokenOM = async () => {
  const credentials = Buffer.from(
    `${process.env.OM_API_KEY}:${process.env.OM_API_SECRET}`
  ).toString('base64');

  const response = await axios.post(
    'https://api.orange.com/oauth/v3/token',
    'grant_type=client_credentials',
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    }
  );

  return response.data.access_token;
};

/**
 * Crée un lien de paiement Orange Money
 */
const creerPaiementOM = async ({ montant, referenceCommande, urlSucces, urlEchec, urlNotification }) => {
  const token = await getTokenOM();

  const response = await axios.post(
    `${OM_BASE_URL}/webpayment`,
    {
      merchant_key: process.env.OM_MERCHANT_KEY,
      currency: 'OUV',
      order_id: referenceCommande,
      amount: montant,
      return_url: urlSucces,
      cancel_url: urlEchec,
      notif_url: urlNotification,
      lang: 'fr',
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    }
  );

  return {
    checkout_url: response.data.payment_url,
    pay_token: response.data.pay_token,
    notif_token: response.data.notif_token,
  };
};

/**
 * Vérifie le statut d'un paiement Orange Money
 */
const verifierPaiementOM = async (payToken) => {
  const token = await getTokenOM();

  const response = await axios.get(
    `${OM_BASE_URL}/transactionstatus`,
    {
      params: {
        order_id: payToken,
        merchant_key: process.env.OM_MERCHANT_KEY,
      },
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    }
  );

  return {
    statut: response.data.status, // 'SUCCESS' | 'FAILED' | 'PENDING'
    txnid: response.data.txnid,
  };
};

module.exports = { creerPaiementOM, verifierPaiementOM };
