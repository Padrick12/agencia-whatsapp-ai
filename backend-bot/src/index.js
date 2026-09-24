// Engine Principal Backend - Agencia WhatsApp IA
const { testConnection } = require('./db');
const { connectToWhatsApp } = require('./whatsapp');

async function main() {
  console.log("====================================================");
  console.log("🚀 [Agencia IA] Motor Principal Iniciado en Raspberry Pi 5");
  console.log("====================================================");

  // 1. Probar Base de Datos
  await testConnection();

  // 2. Conectar Cliente de WhatsApp Baileys
  await connectToWhatsApp();
}

main().catch(err => {
  console.error("❌ Error Fatal en el Motor:", err);
});
