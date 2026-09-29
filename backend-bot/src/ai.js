// Módulo de Agente de Inteligencia Artificial Conversacional Multi-Tenant
const Groq = require('groq-sdk');
const path = require('path');
const { pool, getOrCreateDefaultBusiness } = require('./db');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const groqApiKey = process.env.GROQ_API_KEY || '';
let groqClient = null;

if (groqApiKey && !groqApiKey.includes('tu_clave')) {
  groqClient = new Groq({ apiKey: groqApiKey });
}

/**
 * Genera una respuesta inteligente utilizando el System Prompt y la Base de Conocimiento del Negocio desde PostgreSQL
 * @param {string} pushName - Nombre del usuario en WhatsApp
 * @param {string} userMessage - Mensaje actual enviado por el cliente
 * @param {Array} historyMsgs - Historial reciente de mensajes
 * @param {number} businessId - ID del negocio en PostgreSQL
 */
async function generateAIResponse(pushName, userMessage, historyMsgs = [], businessId = 1) {
  let business = null;
  try {
    const bRes = await pool.query('SELECT * FROM businesses WHERE id = $1;', [businessId]);
    business = bRes.rows[0];
  } catch (e) {
    business = await getOrCreateDefaultBusiness();
  }

  if (!business) {
    business = await getOrCreateDefaultBusiness();
  }

  const systemPrompt = `${business.system_prompt || 'Eres un asistente comercial amable.'}

---
BASE DE CONOCIMIENTO Y DATOS EXCLUSIVOS DEL NEGOCIO ("${business.name}"):
${business.knowledge_base || 'Atención general de servicios.'}

---
REGLAS ADICIONALES:
1. Responde de forma concisa y humana (2 a 3 oraciones cortas max para WhatsApp).
2. Usa la base de conocimiento anterior para responder precios, productos o preguntas frecuentes con total precisión.
3. Dirígete al cliente por su nombre: "${pushName}".`;

  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  historyMsgs.forEach(msg => {
    messages.push({
      role: msg.sender === 'LEAD' ? 'user' : 'assistant',
      content: msg.content
    });
  });

  messages.push({ role: 'user', content: userMessage });

  if (groqClient) {
    try {
      const completion = await groqClient.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.6,
        max_tokens: 300,
      });

      return completion.choices[0]?.message?.content || `¡Hola ${pushName}! ¿En qué te podemos ayudar en ${business.name}?`;
    } catch (err) {
      console.error('⚠️ [AI Agent Error] Error al consultar Groq API:', err.message);
    }
  }

  return fallbackAIResponse(pushName, userMessage, business);
}

/**
 * Fallback de respuesta conversacional cuando no hay API Key activa
 */
function fallbackAIResponse(pushName, text, business) {
  const clean = text.toLowerCase();
  
  if (clean.includes('hola') || clean.includes('buenas')) {
    return `¡Hola ${pushName}! 👋 Qué gusto saludarte. Bienvenido a ${business.name}. ¿En qué te puedo ayudar hoy?`;
  }
  if (clean.includes('precio') || clean.includes('costo') || clean.includes('cuanto')) {
    return `Con gusto te comparto información de ${business.name}, ${pushName}. ¿Tienes alguna duda en particular?`;
  }
  
  return `¡Con mucho gusto te atiendo en ${business.name}, ${pushName}! ¿Te gustaría agendar una breve llamada o prefieres detalles por aquí?`;
}

module.exports = { generateAIResponse };
