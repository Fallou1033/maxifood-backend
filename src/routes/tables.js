const express = require('express');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── GET /api/tables/:restaurant_id — liste des tables ─
router.get('/:restaurant_id', authMiddleware, async (req, res) => {
  if (req.gerant.restaurant_id !== req.params.restaurant_id) {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  try {
    const { data, error } = await supabase
      .from('tables_restaurant')
      .select('*')
      .eq('restaurant_id', req.params.restaurant_id)
      .order('numero');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── POST /api/tables — ajouter une table ──────
router.post('/', authMiddleware, async (req, res) => {
  const { numero, capacite } = req.body;
  const restaurant_id = req.gerant.restaurant_id;

  // L'URL du QR code pointe vers le frontend
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const qr_code_url = `${frontendUrl}/table/${numero}`;

  try {
    const { data, error } = await supabase
      .from('tables_restaurant')
      .insert({ restaurant_id, numero, capacite: capacite || 4, qr_code_url })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: `Table ${numero} existe déjà` });
      }
      throw error;
    }

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── DELETE /api/tables/:id ────────────────────
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { data: table } = await supabase
      .from('tables_restaurant')
      .select('restaurant_id')
      .eq('id', req.params.id)
      .single();

    if (!table || table.restaurant_id !== req.gerant.restaurant_id) {
      return res.status(403).json({ error: 'Non autorisé' });
    }

    await supabase.from('tables_restaurant').delete().eq('id', req.params.id);
    res.json({ message: 'Table supprimée' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
