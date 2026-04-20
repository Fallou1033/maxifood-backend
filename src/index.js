require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes        = require('./routes/auth');
const restaurantRoutes  = require('./routes/restaurant');
const menuRoutes        = require('./routes/menu');
const commandeRoutes    = require('./routes/commandes');
const tableRoutes       = require('./routes/tables');
const paiementRoutes    = require('./routes/paiements');
const qrRoutes          = require('./routes/qrcodes');
const statsRoutes       = require('./routes/stats');
const parametresRoutes  = require('./routes/parametres');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use('/api/paiements/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

app.use('/api/auth',        authRoutes);
app.use('/api/restaurant',  restaurantRoutes);
app.use('/api/menu',        menuRoutes);
app.use('/api/commandes',   commandeRoutes);
app.use('/api/tables',      tableRoutes);
app.use('/api/paiements',   paiementRoutes);
app.use('/api/qr',          qrRoutes);
app.use('/api/stats',       statsRoutes);
app.use('/api/parametres',  parametresRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res) => res.status(404).json({ error: 'Route non trouvée' }));
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Erreur serveur interne' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Maxi-food API démarrée sur http://localhost:${PORT}`);
});
