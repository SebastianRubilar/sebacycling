# SebaCycling — Deploy en Netlify

## Estructura del proyecto
```
sebacycling/
├── public/
│   └── index.html          ← App principal (único archivo frontend)
├── netlify/
│   └── functions/
│       ├── strava-auth.js  ← OAuth callback (token exchange)
│       ├── strava-proxy.js ← Proxy para la API de Strava
│       └── strava-config.js ← Expone Client ID al frontend
└── netlify.toml            ← Configuración de redirects
```

## Pasos de deploy

### 1. Sube el proyecto a GitHub
```bash
git init
git add .
git commit -m "SebaCycling v1"
git remote add origin https://github.com/TU_USUARIO/sebacycling.git
git push -u origin main
```

### 2. Conecta con Netlify
1. Ve a https://netlify.com → New site from Git
2. Conecta tu repo de GitHub
3. Build settings: dejar vacío (no hay build step)
4. Publish directory: `public`

### 3. Variables de entorno en Netlify
Ve a Site Settings → Environment Variables y agrega:
- `STRAVA_CLIENT_ID` → tu Client ID de https://www.strava.com/settings/api
- `STRAVA_CLIENT_SECRET` → tu Client Secret

### 4. Configura Strava API
En https://www.strava.com/settings/api:
- Authorization Callback Domain: `TU-SITIO.netlify.app`

### 5. ¡Listo!
La app estará en `https://TU-SITIO.netlify.app`

## Módulos incluidos
- **Rutas**: Actividades de Strava con detalle (splits, desnivel, TSS, zona)
- **Carga**: ATL/CTL/ACWR con semáforo, spark bar 8 semanas, zonas de potencia
- **Gym**: Plan MacLab 4 semanas × 4 sesiones con checkbox de completado
- **Nutrición**: Calculadora de brevet + plan diario con colación 17:15
- **Calendario**: Vista mensual con rutas/gym/brevets, escalera ACP, countdown, calculadora de controles, tracker W/kg
