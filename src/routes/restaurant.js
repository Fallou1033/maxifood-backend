const express = require('express');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── GET /api/restaurant/:id — infos publiques ─
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('restaurants')
      .select('id, nom, slogan, adresse, telephone, logo_url, couleur_principale, heure_ouverture, heure_fermeture')
      .eq('id', req.params.id)
      .eq('actif', true)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Restaurant non trouvé' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── PUT /api/restaurant/:id — mise à jour (gérant) ─
router.put('/:id', authMiddleware, async (req, res) => {
  if (req.gerant.restaurant_id !== req.params.id) {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  const { nom, slogan, adresse, telephone, logo_url, couleur_principale, heure_ouverture, heure_fermeture } = req.body;

  try {
    const { data, error } = await supabase
      .from('restaurants')
      .update({ nom, slogan, adresse, telephone, logo_url, couleur_principale, heure_ouverture, heure_fermeture })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
