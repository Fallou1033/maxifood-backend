const axios = require('axios');

const WAVE_BASE_URL = 'https://api.wave.com/v1';

/**
 * Crée un lien de paiement Wave
 * Retourne { checkout_url, id } ou lève une erreur
 */
const creerPaiementWave = async ({ montant, referenceCommande, telephoneClient, urlSucces, urlEchec }) => {
  const response = await axios.post(
    `${WAVE_BASE_URL}/checkout/sessions`,
    {
      currency: 'XOF',
      amount: montant.toString(),
      error_url: urlEchec,
      success_url: urlSucces,
      client_reference: referenceCommande,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.WAVE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  return {
    checkout_url: response.data.wave_launch_url,
    session_id: response.data.id,
    expires_at: response.data.when_expires,
  };
};

/**
 * Vérifie le statut d'une session de paiement Wave
 */
const verifierPaiementWave = async (sessionId) => {
  const response = await axios.get(
    `${WAVE_BASE_URL}/checkout/sessions/${sessionId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.WAVE_API_KEY}`,
      },
    }
  );

  return {
    statut: response.data.payment_status, // 'succeeded' | 'failed' | 'pending'
    montant: response.data.amount,
    reference: response.data.client_reference,
  };
};

/**
 * Valide la signature du webhook Wave
 */
const validerWebhookWave = (payload, signature) => {
  const crypto = require('crypto');
  const expected = crypto
    .createHmac('sha256', process.env.WAVE_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  return signature === expected;
};

module.exports = { creerPaiementWave, verifierPaiementWave, validerWebhookWave };
