// Módulo de Conexión a WhatsApp vía Baileys con Persistencia en BD
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const path = require('path');
const { saveOrGetLead, saveMessage } = require('./db');

const logger = pino({ level: 'silent' });
const authFolder = path.join(__dirname, '../../whatsapp_sessions');

/**
 * Inicializa el Socket de WhatsApp con guardado automático en PostgreSQL y auto-respuesta
 */
async function connectToWhatsApp() {
  console.log("📱 [WhatsApp Engine] Inicializando sesión y conectando...");
  
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
      console.log('⚠️ [WhatsApp] Conexión cerrada. Reconectando:', shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('✅ [WhatsApp Engine] ¡CONECTADO CON ÉXITO! Bot en línea y listo para recibir leads.');
    }
  });

  // Escucha y procesado de mensajes entrantes
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type === 'notify') {
      for (const msg of m.messages) {
        // Ignorar mensajes enviados por el propio bot para evitar bucles
        if (!msg.key.fromMe) {
          const from = msg.key.remoteJid;
          const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
          const pushName = msg.pushName || 'Prospecto WhatsApp';

          if (!text) continue;

          console.log(`\n📩 [Mensaje Entrante] De: ${pushName} (${from}) | Contenido: "${text}"`);

          // 1. Guardar o actualizar lead en PostgreSQL
          const lead = await saveOrGetLead(from, pushName);
          if (lead) {
            // 2. Guardar mensaje entrante del lead
            await saveMessage(lead.id, 'LEAD', text);
            console.log(`💾 [BD PostgreSQL] Lead #${lead.id} (${pushName}) y mensaje guardados.`);

            // 3. Generar Respuesta Automática del Bot
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

            // 4. Enviar respuesta por WhatsApp
            await sock.sendMessage(from, { text: replyText });
            
            // 5. Registrar la respuesta del Bot en BD
            await saveMessage(lead.id, 'BOT', replyText);
            console.log(`🤖 [Auto-Respuesta] Enviada a ${from} y registrada en BD.`);
          }
        }
      }
    }
  });

  return sock;
}

module.exports = { connectToWhatsApp };
