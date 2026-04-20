const express = require('express');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── GET /api/stats/:restaurant_id/resume ──────
// Stats globales : aujourd'hui, cette semaine, ce mois
router.get('/:restaurant_id/resume', authMiddleware, async (req, res) => {
  if (req.gerant.restaurant_id !== req.params.restaurant_id) {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  try {
    const now = new Date();

    // Plages de dates
    const debutJour = new Date(now); debutJour.setHours(0,0,0,0);
    const debutSemaine = new Date(now); debutSemaine.setDate(now.getDate() - now.getDay()); debutSemaine.setHours(0,0,0,0);
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

    // Toutes les commandes du mois (non annulées)
    const { data: commandes } = await supabase
      .from('commandes')
      .select('montant_total, statut, mode, created_at')
      .eq('restaurant_id', req.params.restaurant_id)
      .neq('statut', 'annulee')
      .gte('created_at', debutMois.toISOString());

    const calculer = (liste) => ({
      count: liste.length,
      montant: liste.reduce((s, c) => s + c.montant_total, 0),
    });

    const aujourd_hui = commandes.filter(c => new Date(c.created_at) >= debutJour);
    const semaine     = commandes.filter(c => new Date(c.created_at) >= debutSemaine);
    const mois        = commandes;

    // Répartition par mode
    const parMode = ['sur_place','a_emporter','livraison'].map(mode => ({
      mode,
      count: aujourd_hui.filter(c => c.mode === mode).length,
    }));

    // Évolution sur les 7 derniers jours
    const sept_jours = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const debut = new Date(date); debut.setHours(0,0,0,0);
      const fin   = new Date(date); fin.setHours(23,59,59,999);
      const du_jour = commandes.filter(c => {
        const d = new Date(c.created_at);
        return d >= debut && d <= fin;
      });
      sept_jours.push({
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
        count: du_jour.length,
        montant: du_jour.reduce((s, c) => s + c.montant_total, 0),
      });
    }

    // Plats les plus commandés (du mois)
    const { data: lignes } = await supabase
      .from('lignes_commande')
      .select('nom_plat, quantite, commandes!inner(restaurant_id, created_at)')
      .eq('commandes.restaurant_id', req.params.restaurant_id)
      .gte('commandes.created_at', debutMois.toISOString());

    const platsCount = {};
    (lignes || []).forEach(l => {
      platsCount[l.nom_plat] = (platsCount[l.nom_plat] || 0) + l.quantite;
    });
    const top_plats = Object.entries(platsCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([nom, quantite]) => ({ nom, quantite }));

    res.json({
      aujourd_hui: calculer(aujourd_hui),
      semaine:     calculer(semaine),
      mois:        calculer(mois),
      par_mode:    parMode,
      evolution:   sept_jours,
      top_plats,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── GET /api/stats/:restaurant_id/historique ──
// Historique paginé avec filtres
router.get('/:restaurant_id/historique', authMiddleware, async (req, res) => {
  if (req.gerant.restaurant_id !== req.params.restaurant_id) {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  const { statut, mode, date_debut, date_fin, page = 1, limite = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limite);

  try {
    let query = supabase
      .from('commandes')
      .select('*, lignes_commande(*), paiements(methode, statut)', { count: 'exact' })
      .eq('restaurant_id', req.params.restaurant_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limite) - 1);

    if (statut) query = query.eq('statut', statut);
    if (mode)   query = query.eq('mode', mode);
    if (date_debut) query = query.gte('created_at', new Date(date_debut).toISOString());
    if (date_fin) {
      const fin = new Date(date_fin); fin.setHours(23,59,59,999);
      query = query.lte('created_at', fin.toISOString());
    }

    const { data, error, count } = await query;
    if (error) throw error;

    res.json({
      commandes: data,
      total: count,
      page: parseInt(page),
      pages: Math.ceil(count / parseInt(limite)),
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
