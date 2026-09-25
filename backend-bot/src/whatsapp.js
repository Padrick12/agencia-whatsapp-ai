// Módulo de Conexión a WhatsApp vía Baileys con Persistencia en BD y Resiliencia de Eventos
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const { saveOrGetLead, saveMessage } = require('./db');

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
 * Inicializa el Socket de WhatsApp con guardado automático en PostgreSQL y auto-respuesta
 */
async function connectToWhatsApp() {
  console.log("📱 [WhatsApp Engine] Inicializando versión y sesión de Baileys...");
  
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
      console.log('✅ [WhatsApp Engine] ¡CONECTADO CON ÉXITO! Bot en línea y listo para recibir leads.');
    }
  });

  // Escucha y procesado universal de mensajes entrantes
  sock.ev.on('messages.upsert', async (m) => {
    try {
      console.log(`\n🔔 [Evento Upsert Recibido] Tipo: "${m.type}" | Cantidad de Mensajes: ${m.messages.length}`);

      for (const msg of m.messages) {
        const from = msg.key.remoteJid;
        const isFromMe = msg.key.fromMe;
        const pushName = msg.pushName || (isFromMe ? 'Tú (Mismo número)' : 'Prospecto WhatsApp');
        const text = extractMessageText(msg);

        console.log(`💬 [Mensaje Recibido] De: ${pushName} (${from}) | Es de mí mismo: ${isFromMe} | Texto: "${text}"`);

        // Ignorar estados / historias o mensajes sin texto
        if (!text || from === 'status@broadcast') continue;

        if (!isFromMe) {
          console.log(`🚀 [Procesando Lead] De: ${pushName} (${from}) -> Guardando en BD...`);

          const lead = await saveOrGetLead(from, pushName);
          if (lead) {
            await saveMessage(lead.id, 'LEAD', text);
            console.log(`💾 [BD PostgreSQL] Lead #${lead.id} (${pushName}) y mensaje guardados.`);

            let replyText = '';
            const cleanText = text.trim().toLowerCase();
            if (cleanText === '1' || cleanText.includes('servicio') || cleanText.includes('info')) {
              replyText = `📌 *Servicios de nuestra Agencia IA*\n\n1. Asistentes Virtuales 24/7 por WhatsApp.\n2. Calificación automática de leads.\n3. Agendamiento automático de citas.\n\n¿Te gustaría ver una demostración interactiva? Responde con *2*.`;
            } else if (cleanText === '2' || cleanText.includes('demo') || cleanText.includes('cita')) {
              replyText = `📅 *Agendamiento de Citas*\n\n¡Excelente! Por favor indícanos tu nombre completo y la fecha/hora que te gustaría para tu demostración.`;
            } else if (cleanText === '3' || cleanText.includes('asesor') || cleanText.includes('humano')) {
              replyText = `👨‍💼 *Atención Personalizada*\n\nUn asesor humano ha sido notificado y se pondrá en contacto contigo en breve.`;
            } else {
              replyText = `¡Hola ${pushName}! 👋 Gracias por escribirnos.\n\nSoy el Asistente IA operando desde la Raspberry Pi 5.\n\n*Menú de Opciones:*\n1️⃣ Información de Servicios\n2️⃣ Agendar Demo / Cita\n3️⃣ Hablar con un Asesor\n\n_Escribe 1, 2 o 3 para continuar._`;
            }

            await sock.sendMessage(from, { text: replyText });
            await saveMessage(lead.id, 'BOT', replyText);
            console.log(`🤖 [Auto-Respuesta] Enviada a ${from} y registrada en BD.`);
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
