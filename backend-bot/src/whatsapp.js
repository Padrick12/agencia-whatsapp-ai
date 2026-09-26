// Módulo de Conexión a WhatsApp vía Baileys con Agente de IA Conversacional y PostgreSQL
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const { saveOrGetLead, saveMessage, pool } = require('./db');
const { generateAIResponse } = require('./ai');

const logger = pino({ level: 'silent' });
const authFolder = path.join(__dirname, '../../whatsapp_sessions');

/**
 * Extrae de forma segura el texto de cualquier tipo de mensaje de WhatsApp
 */
function extractMessageText(msg) {
  if (!msg || !msg.message) return null;
  const m = msg.message;
  return m.conversation || 
         m.extendedTextMessage?.text || 
         m.imageMessage?.caption || 
         m.videoMessage?.caption || 
         m.buttonsResponseMessage?.selectedButtonId ||
         m.listResponseMessage?.singleSelectReply?.selectedRowId ||
         null;
}

/**
 * Obtiene el historial reciente de la conversación para darle memoria a la IA
 */
async function getRecentHistory(leadId) {
  try {
    const res = await pool.query(
      'SELECT sender, content FROM messages WHERE lead_id = $1 ORDER BY id DESC LIMIT 6;',
      [leadId]
    );
    return res.rows.reverse();
  } catch (err) {
    return [];
  }
}

/**
 * Inicializa el Socket de WhatsApp impulsado por Agente de IA Conversacional
 */
async function connectToWhatsApp() {
  console.log("📱 [WhatsApp Engine] Inicializando Agente de IA Conversacional...");
  
  let version = [2, 3000, 1015901307];
  try {
    const vInfo = await fetchLatestBaileysVersion();
    version = vInfo.version;
    console.log(`ℹ️ [Baileys Version] Versión activa: v${version.join('.')} (Última versión: ${vInfo.isLatest})`);
  } catch (e) {
    console.log("ℹ️ [Baileys Version] Usando versión fallback estable.");
  }

  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: ["Agencia IA (Raspberry Pi 5)", "Chrome", "1.0.0"],
    syncFullHistory: false,
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    getMessage: async () => ({ conversation: 'Bot Active' })
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
      console.log('⚠️ [WhatsApp] Conexión cerrada. Reconectando:', shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ [WhatsApp Engine] ¡CONECTADO CON ÉXITO! Agente de IA Conversacional listo.');
    }
  });

  // Escucha y procesado inteligente de mensajes entrantes
  sock.ev.on('messages.upsert', async (m) => {
    try {
      console.log(`\n🔔 [Evento Upsert Recibido] Tipo: "${m.type}" | Cantidad de Mensajes: ${m.messages.length}`);

      for (const msg of m.messages) {
        const from = msg.key.remoteJid;
        const isFromMe = msg.key.fromMe;
        const pushName = msg.pushName || (isFromMe ? 'Tú (Mismo número)' : 'Prospecto WhatsApp');
        const text = extractMessageText(msg);

        console.log(`💬 [Mensaje Recibido] De: ${pushName} (${from}) | Es de mí mismo: ${isFromMe} | Texto: "${text}"`);

        // Ignorar estados o mensajes sin texto
        if (!text || from === 'status@broadcast') continue;

        if (!isFromMe) {
          console.log(`🚀 [Procesando Agente IA] De: ${pushName} (${from}) -> Guardando en BD...`);

          const lead = await saveOrGetLead(from, pushName);
          if (lead) {
            // 1. Guardar mensaje del usuario
            await saveMessage(lead.id, 'LEAD', text);

            // 2. Obtener historial previo para darle memoria a la IA
            const history = await getRecentHistory(lead.id);

            // 3. Generar respuesta conversacional del Agente de IA (sin menús rígidos)
            const aiReplyText = await generateAIResponse(pushName, text, history);

            // 4. Enviar respuesta por WhatsApp
            await sock.sendMessage(from, { text: aiReplyText });
            
            // 5. Registrar respuesta de la IA en la BD
            await saveMessage(lead.id, 'BOT', aiReplyText);
            console.log(`🤖 [Agente IA -> ${pushName}]: "${aiReplyText}"`);
          }
        } else {
          console.log(`ℹ️ [Mensaje de Salida] El mensaje fue enviado por ti mismo desde WhatsApp.`);
        }
      }
    } catch (err) {
      console.error('❌ Error procesando mensaje en upsert:', err);
    }
  });

  return sock;
}

module.exports = { connectToWhatsApp };
