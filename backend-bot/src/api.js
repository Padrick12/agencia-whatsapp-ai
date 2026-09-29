// API REST Server - Agencia WhatsApp IA (Multi-Tenant)
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
    const totalBusinessesRes = await pool.query('SELECT COUNT(*) FROM businesses;');
    const recentLeadsRes = await pool.query('SELECT COUNT(*) FROM leads WHERE created_at >= NOW() - INTERVAL \'24 hours\';');

    res.json({
      success: true,
      data: {
        totalLeads: parseInt(totalLeadsRes.rows[0].count, 10),
        totalMessages: parseInt(totalMsgsRes.rows[0].count, 10),
        totalBusinesses: parseInt(totalBusinessesRes.rows[0].count, 10),
        leadsLast24h: parseInt(recentLeadsRes.rows[0].count, 10),
        botStatus: 'ONLINE'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Endpoint: Obtener todos los Negocios / Clientes
app.get('/api/businesses', async (req, res) => {
  try {
    const bRes = await pool.query('SELECT * FROM businesses ORDER BY id ASC;');
    res.json({ success: true, data: bRes.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Endpoint: Obtener un Negocio por ID
app.get('/api/businesses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const bRes = await pool.query('SELECT * FROM businesses WHERE id = $1;', [id]);
    if (bRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Negocio no encontrado' });
    }
    res.json({ success: true, data: bRes.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Endpoint: Crear un Nuevo Negocio / Cliente
app.post('/api/businesses', async (req, res) => {
  const { name, category, system_prompt, knowledge_base, phone } = req.body;
  try {
    const insertRes = await pool.query(`
      INSERT INTO businesses (name, category, system_prompt, knowledge_base, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `, [name, category || 'General', system_prompt, knowledge_base || '', phone || '']);

    res.json({ success: true, data: insertRes.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Endpoint: Actualizar System Prompt o Base de Conocimiento de un Negocio en Tiempo Real
app.put('/api/businesses/:id', async (req, res) => {
  const { id } = req.params;
  const { name, category, system_prompt, knowledge_base, phone } = req.body;
  try {
    const updateRes = await pool.query(`
      UPDATE businesses 
      SET name = COALESCE($1, name),
          category = COALESCE($2, category),
          system_prompt = COALESCE($3, system_prompt),
          knowledge_base = COALESCE($4, knowledge_base),
          phone = COALESCE($5, phone),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *;
    `, [name, category, system_prompt, knowledge_base, phone, id]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Negocio no encontrado' });
    }

    console.log(`⚡ [Live Update] Negocio #${id} (${updateRes.rows[0].name}) actualizado en PostgreSQL.`);
    res.json({ success: true, data: updateRes.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Endpoint: Obtener todos los Leads registrados
app.get('/api/leads', async (req, res) => {
  try {
    const leadsRes = await pool.query(`
      SELECT l.*, b.name as business_name 
      FROM leads l 
      LEFT JOIN businesses b ON l.business_id = b.id 
      ORDER BY l.updated_at DESC;
    `);
    res.json({ success: true, data: leadsRes.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Endpoint: Historial de Chat de un Lead específico
app.get('/api/messages/:leadId', async (req, res) => {
  const { leadId } = req.params;
  try {
    const msgsRes = await pool.query(
      'SELECT * FROM messages WHERE lead_id = $1 ORDER BY created_at ASC;',
      [leadId]
    );
    res.json({ success: true, data: msgsRes.rows });
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
