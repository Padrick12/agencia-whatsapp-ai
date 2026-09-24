// Modulo de conexion a PostgreSQL para ARM64
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Construcción robusta de la cadena de conexión
const dbUser = process.env.POSTGRES_USER || 'agencia_admin';
const dbPass = process.env.POSTGRES_PASSWORD || 'cambia_esta_contrasena_segura_123!';
const dbHost = process.env.POSTGRES_HOST || 'localhost';
const dbPort = process.env.POSTGRES_PORT || '5432';
const dbName = process.env.POSTGRES_DB || 'whatsapp_agency';

// Prioriza DATABASE_URL si es válida, o construye dinámicamente
const connectionString = (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('${')) 
  ? process.env.DATABASE_URL 
  : `postgresql://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`;

const pool = new Pool({
  connectionString,
});

/**
 * Prueba la conexion contra el contenedor Docker de PostgreSQL en la Pi 5
 */
async function testConnection() {
  try {
    const res = await pool.query('SELECT NOW() as current_time, current_database() as db_name;');
    console.log('✅ [PostgreSQL] ¡Conexión exitosa a la base de datos en la Pi 5!');
    console.log(`📊 DB Name: ${res.rows[0].db_name} | Timestamp Server: ${res.rows[0].current_time}`);
  } catch (err) {
    console.error('❌ [PostgreSQL Error] No se pudo conectar a la base de datos:', err.message);
  } finally {
    await pool.end();
  }
}

module.exports = { pool, testConnection };
