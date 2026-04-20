const express = require('express');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── GET /api/parametres — infos complètes ─────
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', req.gerant.restaurant_id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── PUT /api/parametres — mettre à jour ───────
router.put('/', authMiddleware, async (req, res) => {
  const {
    nom, slogan, adresse, telephone, email,
    couleur_principale, heure_ouverture, heure_fermeture, logo_url
  } = req.body;

  try {
    const { data, error } = await supabase
      .from('restaurants')
      .update({
        nom, slogan, adresse, telephone, email,
        couleur_principale, heure_ouverture, heure_fermeture, logo_url
      })
      .eq('id', req.gerant.restaurant_id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/parametres/logo — upload logo ───
// Pour simplifier : on accepte une URL (Supabase Storage ou URL externe)
router.post('/logo', authMiddleware, async (req, res) => {
  const { logo_url } = req.body;

  if (!logo_url) {
    return res.status(400).json({ error: 'URL du logo manquante' });
  }

  try {
    const { data, error } = await supabase
      .from('restaurants')
      .update({ logo_url })
      .eq('id', req.gerant.restaurant_id)
      .select('logo_url')
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
