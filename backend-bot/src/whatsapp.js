// Módulo de Conexión a WhatsApp vía Baileys
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');

const logger = pino({ level: 'silent' });
const authFolder = path.join(__dirname, '../../whatsapp_sessions');

/**
 * Inicializa el Socket de WhatsApp y maneja reconexión y QR
 */
async function connectToWhatsApp() {
  console.log("📱 [WhatsApp] Inicializando sesión y conectando...");
  
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: ["Agencia IA (Raspberry Pi 5)", "Chrome", "1.0.0"]
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n⚡ [WhatsApp] ESCANEA ESTE CÓDIGO QR CON TU WHATSAPP:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
      console.log('⚠️ [WhatsApp] Conexión cerrada debido a:', lastDisconnect?.error, 'Reconectando:', shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ [WhatsApp] ¡CONECTADO CON ÉXITO! El bot de WhatsApp está en línea en la Raspberry Pi 5.');
    }
  });

  // Escucha de mensajes entrantes
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type === 'notify') {
      for (const msg of m.messages) {
        if (!msg.key.fromMe) {
          const from = msg.key.remoteJid;
          const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
          console.log(`📩 [Mensaje Entrante de ${from}]:`, text);
        }
      }
    }
  });

  return sock;
}

module.exports = { connectToWhatsApp };
