// netlify/functions/ai-analyze.js
// Proxy para la API de Anthropic — analiza actividades de ciclismo

const SYSTEM_PROMPT = `Eres un coach ciclista experto analizando las actividades de Sebastián, ciclista de 98kg, FTP 298W (3.04 W/kg), entrenando para un brevet de 1000km en marzo 2027 siguiendo la escalera ACP 200→300→400→600→1000km. Sus commutes diarios son ~12km cada uno en Santiago. Genera un análisis mixto: 2-3 líneas técnicas (zonas, eficiencia, comparación con FTP) + 1-2 líneas de comentario personal y motivacional. Tono directo, como un coach real. Máximo 100 palabras. En español.`;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let activityData;
  try {
    ({ activityData } = JSON.parse(event.body || '{}'));
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'API key not configured' }) };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 250,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `Analiza esta actividad: ${JSON.stringify(activityData)}` }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { statusCode: res.status, body: JSON.stringify({ error: data.error?.message || 'Anthropic error' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ analysis: data.content?.[0]?.text || '' }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
