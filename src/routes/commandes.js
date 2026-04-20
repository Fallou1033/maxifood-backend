const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');
const { notifierClient } = require('../lib/notifications');

const router = express.Router();

router.post('/',
  body('restaurant_id').notEmpty().withMessage('restaurant_id requis'),
  body('mode').isIn(['sur_place', 'a_emporter', 'livraison']),
  body('lignes').isArray({ min: 1 }),
  body('lignes.*.plat_id').isUUID(),
  body('lignes.*.quantite').isInt({ min: 1 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { restaurant_id, table_id, mode, lignes, nom_client, telephone_client, adresse_livraison, note_client } = req.body;

    try {
      const platIds = lignes.map(l => l.plat_id);
      const { data: plats, error: platsError } = await supabase
        .from('plats').select('id, nom, prix, disponible')
        .in('id', platIds).eq('restaurant_id', restaurant_id);

      if (platsError) throw platsError;

      const platsMap = Object.fromEntries(plats.map(p => [p.id, p]));
      for (const ligne of lignes) {
        if (!platsMap[ligne.plat_id]?.disponible) {
          return res.status(400).json({ error: `Le plat "${platsMap[ligne.plat_id]?.nom}" n'est plus disponible` });
        }
      }

      const montant_total = lignes.reduce((sum, l) => sum + (platsMap[l.plat_id].prix * l.quantite), 0);

      const { data: commande, error: cmdError } = await supabase
        .from('commandes')
        .insert({ restaurant_id, table_id, mode, montant_total, nom_client, telephone_client, adresse_livraison, note_client })
        .select('*, restaurants(nom)').single();

      if (cmdError) throw cmdError;

      await supabase.from('lignes_commande').insert(
        lignes.map(l => ({
          commande_id: commande.id,
          plat_id: l.plat_id,
          nom_plat: platsMap[l.plat_id].nom,
          prix_unitaire: platsMap[l.plat_id].prix,
          quantite: l.quantite,
          note: l.note || null
        }))
      );

      await notifierClient(telephone_client, 'recue', commande.numero, commande.restaurants?.nom || 'Maxi-food');

      res.status(201).json({ id: commande.id, numero: commande.numero, statut: commande.statut, montant_total: commande.montant_total });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('commandes').select('*, lignes_commande(*)').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Commande non trouvée' });
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.get('/restaurant/:restaurant_id', authMiddleware, async (req, res) => {
  if (req.gerant.restaurant_id !== req.params.restaurant_id) return res.status(403).json({ error: 'Non autorisé' });
  const { statut, date } = req.query;
  try {
    let query = supabase.from('commandes').select('*, lignes_commande(*)')
      .eq('restaurant_id', req.params.restaurant_id).order('created_at', { ascending: false });
    if (statut) query = query.eq('statut', statut);
    if (date) {
      const debut = new Date(date); debut.setHours(0,0,0,0);
      const fin = new Date(date); fin.setHours(23,59,59,999);
      query = query.gte('created_at', debut.toISOString()).lte('created_at', fin.toISOString());
    }
    const { data, error } = await query.limit(100);
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

router.patch('/:id/statut', authMiddleware, async (req, res) => {
  const { statut } = req.body;
  if (!['recue','en_preparation','prete','livree','annulee'].includes(statut)) {
    return res.status(400).json({ error: 'Statut invalide' });
  }
  try {
    const { data: commande } = await supabase
      .from('commandes').select('restaurant_id, telephone_client, numero, restaurants(nom)')
      .eq('id', req.params.id).single();
    if (!commande || commande.restaurant_id !== req.gerant.restaurant_id) return res.status(403).json({ error: 'Non autorisé' });
    const { data, error } = await supabase.from('commandes').update({ statut }).eq('id', req.params.id).select().single();
    if (error) throw error;
    await notifierClient(commande.telephone_client, statut, commande.numero, commande.restaurants?.nom || 'Maxi-food');
    res.json(data);
  } catch (err) { res.status(500).json({ error: 'Erreur serveur' }); }
});

module.exports = router;
