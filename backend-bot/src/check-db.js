// Helper script para inspeccionar los leads y mensajes en PostgreSQL
const { pool } = require('./db');

async function checkDatabaseContent() {
  console.log("====================================================");
  console.log("📊 [PostgreSQL] CONSULTA DE LEADS Y MENSAJES REGISTRADOS");
  console.log("====================================================\n");

  try {
    const leadsRes = await pool.query('SELECT * FROM leads ORDER BY id DESC;');
    console.log(`📋 Total de Leads Registrados: ${leadsRes.rows.length}`);
    console.table(leadsRes.rows);

    const msgsRes = await pool.query(`
      SELECT m.id, l.name as lead_name, m.sender, m.content, m.created_at 
      FROM messages m 
      JOIN leads l ON m.lead_id = l.id 
      ORDER BY m.id ASC;
    `);
    console.log(`\n💬 Historial Completo de Mensajes (${msgsRes.rows.length} registros):`);
    console.table(msgsRes.rows);
  } catch (err) {
    console.error("❌ Error al consultar la base de datos:", err.message);
  } finally {
    await pool.end();
  }
}

checkDatabaseContent();
