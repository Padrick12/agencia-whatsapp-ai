// Engine Principal Backend - Agencia WhatsApp IA
const { testConnection } = require('./db');
const { connectToWhatsApp } = require('./whatsapp');
const { startApiServer } = require('./api');

async function main() {
  console.log("====================================================");
  console.log("🚀 [Agencia IA] Motor Principal Iniciado en Raspberry Pi 5");
  console.log("====================================================");

  // 1. Probar Base de Datos e Inicializar Esquema SQL
  await testConnection();

  // 2. Iniciar Servidor de API REST para el Dashboard Web
  startApiServer();

  // 3. Conectar Cliente de WhatsApp Baileys con Agente de IA
  await connectToWhatsApp();
}

main().catch(err => {
  console.error("❌ Error Fatal en el Motor:", err);
});
