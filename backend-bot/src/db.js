// Modulo de conexion a PostgreSQL para ARM64
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://agencia_admin:cambia_esta_contrasena_segura_123!@localhost:5432/whatsapp_agency?schema=public',
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
