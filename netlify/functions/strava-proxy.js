// netlify/functions/strava-proxy.js
// Proxy transparente a la API de Strava. Refresca tokens automáticamente.

exports.handler = async (event) => {
  const path = event.path
    .replace('/.netlify/functions/strava-proxy', '')
    .replace('/api/strava', '');
  const stravaUrl = `https://www.strava.com/api/v3${path}${event.rawQuery ? '?' + event.rawQuery : ''}`;

  let accessToken = event.headers['x-strava-token'];
  const refreshToken = event.headers['x-strava-refresh'];
  const expiresAt = parseInt(event.headers['x-strava-expires'] || '0');

  // Refrescar si el token está vencido o vence en los próximos 5 minutos
  const needsRefresh = Date.now() / 1000 > expiresAt - 300;

  if (needsRefresh && refreshToken) {
    try {
      const refreshRes = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      const refreshData = await refreshRes.json();
      if (refreshData.access_token) {
        accessToken = refreshData.access_token;
        // El frontend debe leer estos headers para actualizar localStorage
      }
    } catch (e) {
      console.error('Token refresh error:', e);
    }
  }

  try {
    const stravaRes = await fetch(stravaUrl, {
      method: event.httpMethod,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: event.httpMethod !== 'GET' ? event.body : undefined,
    });

    const data = await stravaRes.text();

    return {
      statusCode: stravaRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'x-new-access-token': accessToken || '',
      },
      body: data,
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Proxy error', detail: err.message }),
    };
  }
};
