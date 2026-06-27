// netlify/functions/strava-config.js
// Expone SOLO el Client ID al frontend (el secret nunca sale del servidor)

exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID || '',
    }),
  };
};
