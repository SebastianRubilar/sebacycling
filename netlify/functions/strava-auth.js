// netlify/functions/strava-auth.js
// Maneja el OAuth callback de Strava: intercambia el code por access_token + refresh_token

exports.handler = async (event) => {
  const code = event.queryStringParameters?.code;
  const error = event.queryStringParameters?.error;

  if (error || !code) {
    return {
      statusCode: 302,
      headers: { Location: `/?auth=error&reason=${error || 'no_code'}` },
    };
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Strava token error:', data);
      return {
        statusCode: 302,
        headers: { Location: `/?auth=error&reason=token_exchange` },
      };
    }

    // Redirige al frontend con los tokens en el hash (no en query params, más seguro)
    const params = new URLSearchParams({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete_id: data.athlete?.id || '',
      athlete_name: data.athlete?.firstname || '',
    });

    return {
      statusCode: 302,
      headers: { Location: `/?auth=success#${params.toString()}` },
    };
  } catch (err) {
    console.error('Auth function error:', err);
    return {
      statusCode: 302,
      headers: { Location: `/?auth=error&reason=server_error` },
    };
  }
};
