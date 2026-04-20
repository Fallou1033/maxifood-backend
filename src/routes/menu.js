const express = require('express');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── GET /api/menu/:restaurant_id — menu complet ─
router.get('/:restaurant_id', async (req, res) => {
  try {
    const { data: categories, error: catError } = await supabase
      .from('categories')
      .select('*, plats(*)')
      .eq('restaurant_id', req.params.restaurant_id)
      .eq('actif', true)
      .order('ordre');

    if (catError) throw catError;

    // Filtrer les plats disponibles
    const menu = categories.map(cat => ({
      ...cat,
      plats: cat.plats
        .filter(p => p.disponible)
        .sort((a, b) => a.ordre - b.ordre)
    }));

    res.json(menu);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/menu/plats — ajouter un plat (gérant) ─
router.post('/plats', authMiddleware, async (req, res) => {
  const { nom, description, prix, categorie_id, image_url, est_populaire } = req.body;

  try {
    const { data, error } = await supabase
      .from('plats')
      .insert({
        restaurant_id: req.gerant.restaurant_id,
        categorie_id, nom, description, prix, image_url,
        est_populaire: est_populaire || false
      })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── PUT /api/menu/plats/:id — modifier un plat ─
router.put('/plats/:id', authMiddleware, async (req, res) => {
  const { nom, description, prix, disponible, image_url, est_populaire, categorie_id } = req.body;

  try {
    // Vérifier que le plat appartient au restaurant du gérant
    const { data: plat } = await supabase
      .from('plats')
      .select('restaurant_id')
      .eq('id', req.params.id)
      .single();

    if (!plat || plat.restaurant_id !== req.gerant.restaurant_id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    const { data, error } = await supabase
      .from('plats')
      .update({ nom, description, prix, disponible, image_url, est_populaire, categorie_id })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── DELETE /api/menu/plats/:id ─────────────────
router.delete('/plats/:id', authMiddleware, async (req, res) => {
  try {
    const { data: plat } = await supabase
      .from('plats')
      .select('restaurant_id')
      .eq('id', req.params.id)
      .single();

    if (!plat || plat.restaurant_id !== req.gerant.restaurant_id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    await supabase.from('plats').delete().eq('id', req.params.id);
    res.json({ message: 'Plat supprimé' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/menu/categories — ajouter catégorie ─
router.post('/categories', authMiddleware, async (req, res) => {
  const { nom, ordre } = req.body;
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert({ restaurant_id: req.gerant.restaurant_id, nom, ordre: ordre || 0 })
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
