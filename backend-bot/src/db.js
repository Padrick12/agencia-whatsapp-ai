// Módulo de conexión, migraciones y helper DB a PostgreSQL para ARM64
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const dbUser = process.env.POSTGRES_USER || 'agencia_admin';
const dbPass = process.env.POSTGRES_PASSWORD || 'cambia_esta_contrasena_segura_123!';
const dbHost = process.env.POSTGRES_HOST || 'localhost';
const dbPort = process.env.POSTGRES_PORT || '5432';
const dbName = process.env.POSTGRES_DB || 'whatsapp_agency';

const connectionString = (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('${')) 
  ? process.env.DATABASE_URL 
  : `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`;

const pool = new Pool({ connectionString });

/**
 * Inicializa las tablas de la Base de Datos y un negocio por defecto si no existe
 */
async function initDb() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    console.log('✅ [PostgreSQL Schema] Tablas (businesses, leads, messages) inicializadas.');
    await getOrCreateDefaultBusiness();
  } catch (err) {
    console.error('❌ [PostgreSQL Schema Error] Error al crear tablas:', err.message);
  }
}

/**
 * Asegura la existencia de un negocio por defecto
 */
async function getOrCreateDefaultBusiness() {
  try {
    const res = await pool.query('SELECT * FROM businesses ORDER BY id ASC LIMIT 1;');
    if (res.rows.length > 0) {
      return res.rows[0];
    }

    const defaultPrompt = `Eres Sofía, una Asistente Comercial de IA ultra-inteligente, empática y profesional.
REGLAS:
1. Sé 100% humana y responde en 2 o 3 frases cortas.
2. NUNCA uses menús rígidos estilo "marca 1 para X".
3. Responde a las dudas del usuario basándote en la base de conocimiento y haz preguntas de seguimiento para cualificarlo.`;

    const defaultKB = `SERVICIOS:
- Asistentes Virtuales 24/7 por WhatsApp.
- Calificación automática de leads y agendamiento de citas.
PRECIOS:
- Setup Fee: $2,500 MXN.
- Mensualidad: $1,200 MXN.`;

    const insertRes = await pool.query(`
      INSERT INTO businesses (name, category, system_prompt, knowledge_base)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `, ['Agencia WhatsApp IA', 'Inmobiliaria / Servicios', defaultPrompt, defaultKB]);

    console.log('🏢 [Multi-Tenant] Negocio por defecto inicializado:', insertRes.rows[0].name);
    return insertRes.rows[0];
  } catch (err) {
    console.error('❌ Error al inicializar negocio por defecto:', err.message);
    return null;
  }
}

async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() as current_time, current_database() as db_name;');
    console.log('✅ [PostgreSQL] Conexión exitosa a la base de datos en la Pi 5!');
    console.log(`📊 DB Name: ${res.rows[0].db_name} | Timestamp Server: ${res.rows[0].current_time}`);
    await initDb();
  } catch (err) {
    console.error('❌ [PostgreSQL Error] No se pudo conectar a la base de datos:', err.message);
  }
}

async function saveOrGetLead(phone, name = 'Prospecto WhatsApp', businessId = 1) {
  try {
    const query = `
      INSERT INTO leads (phone, name, business_id) 
      VALUES ($1, $2, $3)
      ON CONFLICT (phone) DO UPDATE 
      SET updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await pool.query(query, [phone, name, businessId]);
    return res.rows[0];
  } catch (err) {
    console.error('❌ Error al guardar lead:', err.message);
    return null;
  }
}

async function saveMessage(leadId, sender, content) {
  try {
    const query = `
      INSERT INTO messages (lead_id, sender, content) 
      VALUES ($1, $2, $3) 
      RETURNING *;
    `;
    const res = await pool.query(query, [leadId, sender, content]);
    return res.rows[0];
  } catch (err) {
    console.error('❌ Error al guardar mensaje:', err.message);
    return null;
  }
}

module.exports = { pool, testConnection, initDb, saveOrGetLead, saveMessage, getOrCreateDefaultBusiness };
