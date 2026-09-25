// Modulo de conexion, migraciones y helper DB a PostgreSQL para ARM64
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
 * Inicializa las tablas de la Base de Datos si no existen
 */
async function initDb() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schemaSql);
    console.log('✅ [PostgreSQL Schema] Tablas (leads, messages) verificadas e inicializadas correctamente.');
  } catch (err) {
    console.error('❌ [PostgreSQL Schema Error] Error al crear tablas:', err.message);
  }
}

/**
 * Prueba la conexion contra el contenedor Docker de PostgreSQL en la Pi 5
 */
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

/**
 * Guarda o obtiene un lead en la base de datos a partir de su número de teléfono
 */
async function saveOrGetLead(phone, name = 'Prospecto WhatsApp') {
  try {
    const query = `
      INSERT INTO leads (phone, name) 
      VALUES ($1, $2)
      ON CONFLICT (phone) DO UPDATE 
      SET updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const res = await pool.query(query, [phone, name]);
    return res.rows[0];
  } catch (err) {
    console.error('❌ Error al guardar lead:', err.message);
    return null;
  }
}

/**
 * Registra un mensaje en la tabla de historial
 */
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

module.exports = { pool, testConnection, initDb, saveOrGetLead, saveMessage };
