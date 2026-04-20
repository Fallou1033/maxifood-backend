const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const MESSAGES_STATUT = {
  recue: (numero, restaurant) =>
    `✅ *${restaurant}* a bien reçu votre commande #${numero}. Nous la préparons très bientôt !`,
  en_preparation: (numero, restaurant) =>
    `👨‍🍳 Votre commande #${numero} chez *${restaurant}* est en cours de préparation. Encore un peu de patience !`,
  prete: (numero, restaurant) =>
    `🍽 Votre commande #${numero} chez *${restaurant}* est prête ! Vous pouvez venir la récupérer.`,
  livree: (numero, restaurant) =>
    `🎉 Votre commande #${numero} a été livrée. Merci et bon appétit ! — *${restaurant}*`,
  annulee: (numero, restaurant) =>
    `❌ Votre commande #${numero} chez *${restaurant}* a été annulée. Contactez-nous pour plus d'informations.`,
};

/**
 * Envoie une notification WhatsApp
 */
const envoyerWhatsApp = async (telephone, statut, numeroCommande, nomRestaurant) => {
  try {
    const message = MESSAGES_STATUT[statut]?.(numeroCommande, nomRestaurant);
    if (!message) return;

    // Formater le numéro (s'assurer qu'il commence par +221)
    const tel = formaterTelephone(telephone);
    if (!tel) return;

    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${tel}`,
      body: message,
    });

    console.log(`📱 WhatsApp envoyé à ${tel} — statut: ${statut}`);
  } catch (err) {
    console.error('Erreur WhatsApp:', err.message);
  }
};

/**
 * Envoie un SMS
 */
const envoyerSMS = async (telephone, statut, numeroCommande, nomRestaurant) => {
  try {
    const message = MESSAGES_STATUT[statut]?.(numeroCommande, nomRestaurant)
      ?.replace(/\*/g, ''); // Supprimer le markdown pour SMS

    if (!message) return;

    const tel = formaterTelephone(telephone);
    if (!tel) return;

    await client.messages.create({
      from: process.env.TWILIO_SMS_FROM,
      to: tel,
      body: message,
    });

    console.log(`📨 SMS envoyé à ${tel} — statut: ${statut}`);
  } catch (err) {
    console.error('Erreur SMS:', err.message);
  }
};

/**
 * Envoie WhatsApp + SMS simultanément
 */
const notifierClient = async (telephone, statut, numeroCommande, nomRestaurant) => {
  if (!telephone) return;
  await Promise.allSettled([
    envoyerWhatsApp(telephone, statut, numeroCommande, nomRestaurant),
    envoyerSMS(telephone, statut, numeroCommande, nomRestaurant),
  ]);
};

/**
 * Formate le numéro sénégalais en +221XXXXXXXXX
 */
const formaterTelephone = (tel) => {
  if (!tel) return null;
  const nettoye = tel.replace(/\s+/g, '').replace(/-/g, '');
  if (nettoye.startsWith('+')) return nettoye;
  if (nettoye.startsWith('00')) return '+' + nettoye.slice(2);
  if (nettoye.startsWith('7') && nettoye.length === 9) return '+221' + nettoye;
  if (nettoye.startsWith('221')) return '+' + nettoye;
  return null;
};

module.exports = { notifierClient, envoyerWhatsApp, envoyerSMS };
