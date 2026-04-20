const express = require('express');
const QRCode = require('qrcode');
const supabase = require('../lib/supabase');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ── GET /api/qr/table/:table_id — QR code PNG ─
router.get('/table/:table_id', async (req, res) => {
  try {
    const { data: table, error } = await supabase
      .from('tables_restaurant')
      .select('*, restaurants(nom, couleur_principale)')
      .eq('id', req.params.table_id)
      .single();

    if (error || !table) return res.status(404).json({ error: 'Table non trouvée' });

    const url = `${FRONTEND_URL}/table/${table.numero}`;
    const couleur = table.restaurants?.couleur_principale || '#D85A30';

    const qrBuffer = await QRCode.toBuffer(url, {
      type: 'png',
      width: 400,
      margin: 2,
      color: {
        dark: couleur,
        light: '#FFFFFF',
      },
    });

    res.set('Content-Type', 'image/png');
    res.set('Content-Disposition', `inline; filename="qr-table-${table.numero}.png"`);
    res.send(qrBuffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur génération QR code' });
  }
});

// ── GET /api/qr/table/:table_id/svg — QR code SVG ─
router.get('/table/:table_id/svg', async (req, res) => {
  try {
    const { data: table, error } = await supabase
      .from('tables_restaurant')
      .select('*, restaurants(nom, couleur_principale)')
      .eq('id', req.params.table_id)
      .single();

    if (error || !table) return res.status(404).json({ error: 'Table non trouvée' });

    const url = `${FRONTEND_URL}/table/${table.numero}`;
    const couleur = table.restaurants?.couleur_principale || '#D85A30';
    const nomRestaurant = table.restaurants?.nom || 'Restaurant';

    const qrSvg = await QRCode.toString(url, {
      type: 'svg',
      width: 200,
      margin: 1,
      color: { dark: couleur, light: '#FFFFFF' },
    });

    // Wrapper HTML imprimable
    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>QR Code Table ${table.numero} — ${nomRestaurant}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: white; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { width: 300px; border: 2px solid ${couleur}; border-radius: 20px; padding: 24px; text-align: center; }
    .restaurant { font-size: 22px; font-weight: bold; color: ${couleur}; margin-bottom: 4px; }
    .table-num { font-size: 14px; color: #666; margin-bottom: 20px; }
    .qr-wrap { display: flex; justify-content: center; margin-bottom: 16px; }
    .qr-wrap svg { width: 200px; height: 200px; }
    .instruction { font-size: 13px; color: #444; line-height: 1.5; }
    .url { font-size: 10px; color: #999; margin-top: 8px; word-break: break-all; }
    @media print {
      body { min-height: unset; }
      .card { border: 2px solid ${couleur}; }
    }
  </style>
</head>
<body>
  <div class="card">
    <p class="restaurant">${nomRestaurant}</p>
    <p class="table-num">Table ${table.numero}</p>
    <div class="qr-wrap">${qrSvg}</div>
    <p class="instruction">Scannez ce QR code avec votre téléphone pour commander directement depuis votre table</p>
    <p class="url">${url}</p>
  </div>
  <script>
    // Auto-print si ?print=1 dans l'URL
    if (new URLSearchParams(window.location.search).get('print') === '1') {
      window.onload = () => window.print();
    }
  </script>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur génération QR code' });
  }
});

// ── GET /api/qr/restaurant/:restaurant_id — tous les QR ─
router.get('/restaurant/:restaurant_id', authMiddleware, async (req, res) => {
  if (req.gerant.restaurant_id !== req.params.restaurant_id) {
    return res.status(403).json({ error: 'Non autorisé' });
  }

  try {
    const { data: tables, error } = await supabase
      .from('tables_restaurant')
      .select('*, restaurants(nom, couleur_principale)')
      .eq('restaurant_id', req.params.restaurant_id)
      .eq('actif', true)
      .order('numero');

    if (error) throw error;

    const couleur = tables[0]?.restaurants?.couleur_principale || '#D85A30';
    const nomRestaurant = tables[0]?.restaurants?.nom || 'Restaurant';

    // Page HTML avec tous les QR codes côte à côte (imprimable)
    const qrPromises = tables.map(async (table) => {
      const url = `${FRONTEND_URL}/table/${table.numero}`;
      const svg = await QRCode.toString(url, {
        type: 'svg', width: 160, margin: 1,
        color: { dark: couleur, light: '#FFFFFF' },
      });
      return { table, svg, url };
    });

    const results = await Promise.all(qrPromises);

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>QR Codes — ${nomRestaurant}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 20px; }
    h1 { text-align: center; color: ${couleur}; margin-bottom: 24px; font-size: 24px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 900px; margin: 0 auto; }
    .card { background: white; border: 2px solid ${couleur}; border-radius: 16px; padding: 16px; text-align: center; }
    .table-num { font-size: 18px; font-weight: bold; color: ${couleur}; margin-bottom: 12px; }
    .qr-wrap svg { width: 160px; height: 160px; }
    .url { font-size: 9px; color: #999; margin-top: 8px; word-break: break-all; }
    .print-btn { display: block; margin: 20px auto; padding: 12px 24px; background: ${couleur}; color: white; border: none; border-radius: 10px; font-size: 16px; cursor: pointer; }
    @media print { .print-btn { display: none; } body { background: white; } }
  </style>
</head>
<body>
  <h1>${nomRestaurant} — QR Codes des tables</h1>
  <button class="print-btn" onclick="window.print()">🖨 Imprimer tous les QR codes</button>
  <div class="grid">
    ${results.map(({ table, svg, url }) => `
    <div class="card">
      <p class="table-num">Table ${table.numero}</p>
      <div class="qr-wrap">${svg}</div>
      <p class="url">${url}</p>
    </div>`).join('')}
  </div>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur génération QR codes' });
  }
});

module.exports = router;
