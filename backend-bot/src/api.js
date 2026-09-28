// API REST Server - Agencia WhatsApp IA
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir el Dashboard Web de forma estática
const publicPath = path.join(__dirname, '../../frontend-dashboard');
app.use(express.static(publicPath));

// 1. Endpoint: Métricas y Estadísticas del Dashboard
app.get('/api/stats', async (req, res) => {
  try {
    const totalLeadsRes = await pool.query('SELECT COUNT(*) FROM leads;');
    const totalMsgsRes = await pool.query('SELECT COUNT(*) FROM messages;');
    const recentLeadsRes = await pool.query('SELECT COUNT(*) FROM leads WHERE created_at >= NOW() - INTERVAL \'24 hours\';');

    res.json({
      success: true,
      data: {
        totalLeads: parseInt(totalLeadsRes.rows[0].count, 10),
        totalMessages: parseInt(totalMsgsRes.rows[0].count, 10),
        leadsLast24h: parseInt(recentLeadsRes.rows[0].count, 10),
        botStatus: 'ONLINE'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Endpoint: Obtener todos los Leads registrados
app.get('/api/leads', async (req, res) => {
  try {
    const leadsRes = await pool.query('SELECT * FROM leads ORDER BY updated_at DESC;');
    res.json({
      success: true,
      data: leadsRes.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Endpoint: Historial de Chat de un Lead específico
app.get('/api/messages/:leadId', async (req, res) => {
  const { leadId } = req.params;
  try {
    const msgsRes = await pool.query(
      'SELECT * FROM messages WHERE lead_id = $1 ORDER BY created_at ASC;',
      [leadId]
    );
    res.json({
      success: true,
      data: msgsRes.rows
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Inicializa el Servidor Express de la API REST y Servidor Web
 */
function startApiServer() {
  app.listen(PORT, () => {
    console.log(`🌐 [API REST & Dashboard Web] Disponible en http://localhost:${PORT}`);
  });
}

module.exports = { startApiServer, app };
