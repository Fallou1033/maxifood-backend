const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/login ──────────────────────
router.post('/login',
  body('email').isEmail().withMessage('Email invalide'),
  body('mot_de_passe').notEmpty().withMessage('Mot de passe requis'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, mot_de_passe } = req.body;

    try {
      // Récupérer le gérant
      const { data: gerant, error } = await supabase
        .from('gerants')
        .select('*, restaurants(*)')
        .eq('email', email)
        .single();

      if (error || !gerant) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      // Vérifier le mot de passe
      const valide = await bcrypt.compare(mot_de_passe, gerant.mot_de_passe);
      if (!valide) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      // Générer le JWT
      const token = jwt.sign(
        {
          id: gerant.id,
          email: gerant.email,
          restaurant_id: gerant.restaurant_id,
          role: gerant.role
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
      );

      res.json({
        token,
        gerant: {
          id: gerant.id,
          nom: gerant.nom,
          email: gerant.email,
          role: gerant.role,
          restaurant: gerant.restaurants
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// ── POST /api/auth/register (premier setup) ───
router.post('/register',
  body('nom').notEmpty(),
  body('email').isEmail(),
  body('mot_de_passe').isLength({ min: 6 }),
  body('restaurant_id').notEmpty().withMessage('restaurant_id requis'),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { nom, email, mot_de_passe, restaurant_id } = req.body;

    try {
      const hash = await bcrypt.hash(mot_de_passe, 10);

      const { data, error } = await supabase
        .from('gerants')
        .insert({ nom, email, mot_de_passe: hash, restaurant_id })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ error: 'Email déjà utilisé' });
        }
        throw error;
      }

      res.status(201).json({ message: 'Compte créé avec succès', id: data.id });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// ── GET /api/auth/me ──────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('gerants')
      .select('id, nom, email, role, restaurants(*)')
      .eq('id', req.gerant.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
