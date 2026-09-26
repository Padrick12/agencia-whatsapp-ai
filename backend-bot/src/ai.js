// Módulo de Agente de Inteligencia Artificial Conversacional
const Groq = require('groq-sdk');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const groqApiKey = process.env.GROQ_API_KEY || '';
let groqClient = null;

if (groqApiKey && !groqApiKey.includes('tu_clave')) {
  groqClient = new Groq({ apiKey: groqApiKey });
}

/**
 * Genera una respuesta inteligente y humana utilizando un Agente de IA Conversacional (LLM)
 * @param {string} pushName - Nombre del usuario en WhatsApp
 * @param {string} userMessage - Mensaje actual enviado por el cliente
 * @param {Array} historyMsgs - Historial reciente de mensajes en PostgreSQL
 */
async function generateAIResponse(pushName, userMessage, historyMsgs = []) {
  const systemPrompt = `Eres Sofía, una Asistente Comercial de IA ultra-inteligente, empática, profesional y eficiente para una agencia inmobiliaria y de servicios locales.

REGLAS DE COMPORTAMIENTO:
1. Sé 100% humana, amable y directa. Responde en 2 o 3 frases cortas como un mensaje real de WhatsApp (no envíes textos gigantes).
2. NUNCA uses menús rígidos estilo "marca 1 para X, marca 2 para Y". Entiende el contexto del cliente en lenguaje natural.
3. Si el cliente pregunta por información de lotes/casas/servicios, dale una respuesta clara y hazle una pregunta abierta de seguimiento para cualificarlo (ej. "¿En qué zona estás buscando?" o "¿Cuál es tu presupuesto estimado?").
4. Si el cliente quiere agendar una cita o llamada, pide de forma natural su nombre completo y el día/hora de su preferencia.
5. El nombre del cliente es "${pushName}". Dirígete a él/ella de forma amigable.`;

  // Construir historial en formato para el LLM
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // Añadir mensajes previos del historial si existen
  historyMsgs.forEach(msg => {
    messages.push({
      role: msg.sender === 'LEAD' ? 'user' : 'assistant',
      content: msg.content
    });
  });

  // Agregar el mensaje actual
  messages.push({ role: 'user', content: userMessage });

  if (groqClient) {
    try {
      const completion = await groqClient.chat.completions.create({
        messages,
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        max_tokens: 300,
      });

      return completion.choices[0]?.message?.content || `¡Hola ${pushName}! Un placer saludarte. ¿En qué te puedo ayudar hoy?`;
    } catch (err) {
      console.error('⚠️ [AI Agent Error] Error al consultar Groq API:', err.message);
    }
  }

  // Fallback Inteligente (si aún no se ha configurado la GROQ_API_KEY)
  return fallbackAIResponse(pushName, userMessage);
}

/**
 * Fallback de respuesta inteligente conversacional en lenguaje natural cuando no hay API Key activa
 */
function fallbackAIResponse(pushName, text) {
  const clean = text.toLowerCase();
  
  if (clean.includes('hola') || clean.includes('buenas')) {
    return `¡Hola ${pushName}! 👋 Qué gusto saludarte. Soy Sofía, tu asistente virtual. ¿En qué te puedo ayudar hoy?`;
  }
  if (clean.includes('precio') || clean.includes('costo') || clean.includes('cuanto')) {
    return `Con gusto te comparto la información de precios, ${pushName}. Tenemos opciones desde $1,500 MXN en lotes y servicios destacados. ¿Tienes alguna ubicación o presupuesto en mente?`;
  }
  if (clean.includes('cita') || clean.includes('agendar') || clean.includes('ver') || clean.includes('demo')) {
    return `¡Excelente elección! Me encantaría agendar una cita contigo, ${pushName}. ¿Qué día y horario se te acomoda mejor?`;
  }
  
  return `Entiendo perfectamente lo que necesitas, ${pushName}. Déjame ayudarte con la información precisa. ¿Te gustaría agendar una breve llamada o prefieres que te envíe los detalles por aquí?`;
}

module.exports = { generateAIResponse };
