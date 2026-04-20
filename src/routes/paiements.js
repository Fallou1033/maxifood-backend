const express = require('express');
const supabase = require('../lib/supabase');
const { creerPaiementWave, validerWebhookWave } = require('../lib/wave');
const { creerPaiementOM } = require('../lib/orangemoney');
const { notifierClient } = require('../lib/notifications');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL  = process.env.BACKEND_URL  || 'http://localhost:3001';

// ── POST /api/paiements/wave/:commande_id ─────
router.post('/wave/:commande_id', async (req, res) => {
  try {
    const { data: commande, error } = await supabase
      .from('commandes')
      .select('*, restaurants(nom)')
      .eq('id', req.params.commande_id)
      .single();

    if (error || !commande) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const session = await creerPaiementWave({
      montant: commande.montant_total,
      referenceCommande: commande.id,
      urlSucces: `${FRONTEND_URL}/commande/${commande.id}?paiement=success`,
      urlEchec:  `${FRONTEND_URL}/commande/${commande.id}?paiement=echec`,
    });

    // Enregistrer le paiement en base
    await supabase.from('paiements').insert({
      commande_id: commande.id,
      methode: 'wave',
      statut: 'en_attente',
      montant: commande.montant_total,
      reference: session.session_id,
    });

    res.json({ checkout_url: session.checkout_url });
  } catch (err) {
    console.error('Erreur Wave:', err.message);
    res.status(500).json({ error: 'Erreur lors de la création du paiement Wave' });
  }
});

// ── POST /api/paiements/orange/:commande_id ───
router.post('/orange/:commande_id', async (req, res) => {
  try {
    const { data: commande, error } = await supabase
      .from('commandes')
      .select('*, restaurants(nom)')
      .eq('id', req.params.commande_id)
      .single();

    if (error || !commande) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    const session = await creerPaiementOM({
      montant: commande.montant_total,
      referenceCommande: commande.id,
      urlSucces:      `${FRONTEND_URL}/commande/${commande.id}?paiement=success`,
      urlEchec:       `${FRONTEND_URL}/commande/${commande.id}?paiement=echec`,
      urlNotification: `${BACKEND_URL}/api/paiements/webhook/orange`,
    });

    await supabase.from('paiements').insert({
      commande_id: commande.id,
      methode: 'orange_money',
      statut: 'en_attente',
      montant: commande.montant_total,
      reference: session.pay_token,
    });

    res.json({ checkout_url: session.checkout_url });
  } catch (err) {
    console.error('Erreur Orange Money:', err.message);
    res.status(500).json({ error: 'Erreur lors de la création du paiement Orange Money' });
  }
});

// ── POST /api/paiements/webhook/wave ──────────
router.post('/webhook/wave', async (req, res) => {
  try {
    const signature = req.headers['wave-signature'];
    const payload = req.body; // raw buffer

    if (!validerWebhookWave(payload, signature)) {
      return res.status(401).json({ error: 'Signature invalide' });
    }

    const event = JSON.parse(payload.toString());

    if (event.type === 'checkout.session.completed') {
      const commandeId = event.data.client_reference;
      const sessionId  = event.data.id;

      // Marquer le paiement comme confirmé
      await supabase
        .from('paiements')
        .update({ statut: 'confirme' })
        .eq('reference', sessionId);

      // Récupérer la commande + infos client
      const { data: commande } = await supabase
        .from('commandes')
        .select('*, restaurants(nom)')
        .eq('id', commandeId)
        .single();

      if (commande) {
        // Notifier le client
        await notifierClient(
          commande.telephone_client,
          commande.statut,
          commande.numero,
          commande.restaurants.nom
        );
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook Wave error:', err);
    res.status(500).json({ error: 'Erreur webhook' });
  }
});

// ── POST /api/paiements/webhook/orange ────────
router.post('/webhook/orange', async (req, res) => {
  try {
    const { order_id, status, txnid } = req.body;

    if (status === 'SUCCESS') {
      await supabase
        .from('paiements')
        .update({ statut: 'confirme', reference: txnid })
        .eq('reference', order_id);

      const { data: paiement } = await supabase
        .from('paiements')
        .select('commande_id')
        .eq('reference', txnid)
        .single();

      if (paiement) {
        const { data: commande } = await supabase
          .from('commandes')
          .select('*, restaurants(nom)')
          .eq('id', paiement.commande_id)
          .single();

        if (commande) {
          await notifierClient(
            commande.telephone_client,
            commande.statut,
            commande.numero,
            commande.restaurants.nom
          );
        }
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook OM error:', err);
    res.status(500).json({ error: 'Erreur webhook' });
  }
});

// ── GET /api/paiements/:commande_id — statut ──
router.get('/:commande_id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('paiements')
      .select('*')
      .eq('commande_id', req.params.commande_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) return res.status(404).json({ error: 'Aucun paiement trouvé' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
