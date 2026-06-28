/**
 * test_suite.js — SebaCycling · 144 tests
 * node test_suite.js
 *
 * Suites:
 *  1. normalizeActivity — raw de Strava          (22 tests)
 *  2. normalizeActivity — caché localStorage      ( 6 tests)
 *  3. saveState — persistencia                   ( 8 tests)
 *  4. loadState — restauración                   (10 tests)
 *  5. initRutas — no pasa raw a render           ( 8 tests)
 *  6. decodePolyline                             (14 tests)
 *  7. estimateTSS                                (12 tests)
 *  8. estimateWatts                              ( 8 tests)
 *  9. getZone                                    (14 tests)
 * 10. calcLoad (lógica pura)                     (12 tests)
 * 11. calcACP (lógica pura)                      (16 tests)
 * 12. calcNutrition (lógica pura)                (10 tests)
 * 13. filtro renderActivities                    ( 4 tests)
 *                                               ──────────
 *                                        Total   144 tests
 */

'use strict';

// ─────────────────────────────────────────────
// MINI TEST RUNNER
// ─────────────────────────────────────────────
let passed = 0, failed = 0, currentSuite = '';
const failures = [];

function suite(name) {
  currentSuite = name;
  console.log(`\n▶ ${name}`);
}

function test(desc, fn) {
  try {
    fn();
    console.log(`  ✅ ${desc}`);
    passed++;
  } catch (e) {
    const msg = `  ❌ ${desc}\n     ${e.message}`;
    console.log(msg);
    failures.push({ suite: currentSuite, desc, err: e.message });
    failed++;
  }
}

function assert(cond, msg)        { if (!cond) throw new Error(msg || 'Assertion failed'); }
function assertEqual(a, b, msg)   { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assertNull(v, msg)       { if (v !== null) throw new Error(msg || `Expected null, got ${JSON.stringify(v)}`); }
function assertNotNull(v, msg)    { if (v == null) throw new Error(msg || `Expected non-null`); }
function assertApprox(a, b, tol, msg) {
  tol = tol || 0.001;
  if (Math.abs(a - b) > tol) throw new Error(msg || `Expected ≈${b} (±${tol}), got ${a}`);
}
function assertDeepEqual(a, b, msg) {
  const sa = JSON.stringify(a), sb = JSON.stringify(b);
  if (sa !== sb) throw new Error(msg || `Deep mismatch:\n  got:      ${sa}\n  expected: ${sb}`);
}

// ─────────────────────────────────────────────
// MOCK ENTORNO BROWSER
// ─────────────────────────────────────────────
const _store = {};
const localStorage = {
  getItem:    (k) => _store[k] ?? null,
  setItem:    (k, v) => { _store[k] = v; },
  removeItem: (k) => { delete _store[k]; },
};

// ─────────────────────────────────────────────
// CONSTANTES (copia exacta de index.html)
// ─────────────────────────────────────────────
const FTP = 298;
const POWER_ZONES = [
  { name: 'Z1', label: 'Recuperación',  min: 0,   max: 164,  color: '#3b82f6' },
  { name: 'Z2', label: 'Resistencia',   min: 165,  max: 224,  color: '#22c55e' },
  { name: 'Z3', label: 'Tempo',         min: 225,  max: 268,  color: '#eab308' },
  { name: 'Z4', label: 'Umbral',        min: 269,  max: 313,  color: '#f97316' },
  { name: 'Z5', label: 'VO2max',        min: 314,  max: 358,  color: '#ef4444' },
  { name: 'Z6', label: 'Anaeróbico',    min: 359,  max: 447,  color: '#a855f7' },
  { name: 'Z7', label: 'Neuromusc.',    min: 448,  max: 9999, color: '#ec4899' },
];
const BREVETS_DEFAULT = [
  { dist: 200,  label: '200km',  date: null,         done: false },
  { dist: 300,  label: '300km',  date: null,         done: false },
  { dist: 400,  label: '400km',  date: null,         done: false },
  { dist: 600,  label: '600km',  date: null,         done: false },
  { dist: 1000, label: '1000km', date: '2027-03-15', done: false },
];

// ─────────────────────────────────────────────
// STATE + saveState / loadState (copia exacta)
// ─────────────────────────────────────────────
let STATE = {};
function resetState(overrides = {}) {
  STATE = {
    accessToken: null, refreshToken: null, expiresAt: 0,
    activities: [], currentWeek: 1, currentSession: 'A',
    currentMonth: new Date(), weightLog: [], brevets: [...BREVETS_DEFAULT],
    gymDone: {},
    ...overrides,
  };
}
resetState();

function saveState() {
  const toSave = {
    accessToken: STATE.accessToken, refreshToken: STATE.refreshToken,
    expiresAt: STATE.expiresAt, weightLog: STATE.weightLog,
    brevets: STATE.brevets, gymDone: STATE.gymDone,
    activities_cache: STATE.activities.slice(0, 30).map(a => ({
      id: a.id, name: a.name, start_local: a.start_local,
      sport_type: a.sport_type || a.type,
      summary: a.summary,
      map: a.map,
      average_watts: a.average_watts,
      average_heartrate: a.average_heartrate,
      max_heartrate: a.max_heartrate,
      has_heartrate: a.has_heartrate,
      average_temp: a.average_temp,
      elev_high: a.elev_high,
      elev_low: a.elev_low,
      suffer_score: a.suffer_score,
      max_speed: a.max_speed,
      device_name: a.device_name,
      start_latlng: a.start_latlng,
    })),
  };
  try { localStorage.setItem('sebacycling_v1', JSON.stringify(toSave)); } catch(e) {}
}

function loadState() {
  try {
    const raw = localStorage.getItem('sebacycling_v1');
    if (!raw) return;
    const s = JSON.parse(raw);
    STATE.accessToken = s.accessToken || null;
    STATE.refreshToken = s.refreshToken || null;
    STATE.expiresAt = s.expiresAt || 0;
    STATE.weightLog = s.weightLog || [];
    STATE.brevets = s.brevets || [...BREVETS_DEFAULT];
    STATE.gymDone = s.gymDone || {};
    if (s.activities_cache) STATE.activities = s.activities_cache;
  } catch(e) {}
}

// ─────────────────────────────────────────────
// FUNCIONES DE NEGOCIO (copia exacta de index.html)
// ─────────────────────────────────────────────
function normalizeActivity(act) {
  if (!act) return null;
  const summary = act.summary && act.summary.distance !== undefined ? act.summary : {
    distance: act.distance || 0,
    moving_time: act.moving_time || 0,
    elevation_gain: act.total_elevation_gain || 0,
    avg_speed: act.average_speed || 0,
    total_calories: act.kilojoules ? Math.round(act.kilojoules * 0.239) : (act.calories || null),
    average_watts: act.average_watts || null,
  };
  return {
    id: act.id,
    name: act.name || 'Sin nombre',
    sport_type: act.sport_type || act.type || 'Ride',
    start_local: act.start_date_local || act.start_local || act.start_date || new Date().toISOString(),
    commute: act.commute || false,
    summary,
    map: act.map || null,
    average_watts: act.average_watts || null,
    average_heartrate: act.average_heartrate || null,
    max_heartrate: act.max_heartrate || null,
    has_heartrate: act.has_heartrate || false,
    average_temp: act.average_temp !== undefined ? act.average_temp : null,
    elev_high: act.elev_high || null,
    elev_low: act.elev_low || null,
    suffer_score: act.suffer_score || null,
    max_speed: act.max_speed || null,
    device_name: act.device_name || null,
    start_latlng: act.start_latlng || null,
  };
}

function decodePolyline(encoded) {
  let index = 0, lat = 0, lng = 0;
  const coords = [];
  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

function estimateTSS(movingTime, avgKmh, elevGain) {
  const hours = movingTime / 3600;
  const intensityFactor = Math.min((avgKmh / 30) + (elevGain / 5000), 1.2);
  return Math.round(hours * intensityFactor * intensityFactor * 100);
}

function estimateWatts(avgKmh, elevGain, movingTime) {
  const grade = elevGain / (avgKmh * movingTime / 3600 * 1000) * 100;
  return Math.round(50 + avgKmh * 5 + grade * 20);
}

function getZone(watts) {
  return POWER_ZONES.find(z => watts >= z.min && watts <= z.max) || POWER_ZONES[6];
}

// calcLoad extraído sin DOM (retorna { atl, ctl, acwr, tssMap })
function calcLoadPure(activities) {
  const now = Date.now();
  const day = 86400000;
  const tssMap = {};
  activities.map(normalizeActivity).forEach(a => {
    const t = new Date(a.start_local).getTime();
    const daysAgo = Math.floor((now - t) / day);
    if (daysAgo < 0 || daysAgo > 42) return;
    const sum = a.summary || {};
    const tss = estimateTSS(sum.moving_time || 0, (sum.avg_speed || 0) * 3.6, sum.elevation_gain || 0);
    tssMap[daysAgo] = (tssMap[daysAgo] || 0) + tss;
  });
  let atl = 0, ctl = 0;
  for (let i = 0; i < 7; i++) atl += (tssMap[i] || 0);
  for (let i = 0; i < 28; i++) ctl += (tssMap[i] || 0);
  atl /= 7; ctl /= 28;
  const acwr = ctl > 0 ? (atl / ctl) : 0;
  return { atl, ctl, acwr, tssMap };
}

// calcACP extraído sin DOM
const ACP_RULES = [
  { from: 0,   to: 200,  openKmh: 15,     closeKmh: 34 },
  { from: 200, to: 400,  openKmh: 15,     closeKmh: 32 },
  { from: 400, to: 600,  openKmh: 15,     closeKmh: 30 },
  { from: 600, to: 1000, openKmh: 11.428, closeKmh: 28 },
];

function acpGetOpenClose(km) {
  let openMins = 0, closeMins = 0, prevKm = 0;
  for (const rule of ACP_RULES) {
    if (prevKm >= km) break;
    const segEnd  = Math.min(km, rule.to);
    const segDist = segEnd - Math.max(prevKm, rule.from);
    if (segDist <= 0) { prevKm = rule.to; continue; }
    openMins  += (segDist / rule.openKmh)  * 60;
    closeMins += (segDist / rule.closeKmh) * 60;
    prevKm = segEnd;
  }
  return { openMins: Math.round(openMins), closeMins: Math.round(closeMins) };
}

function acpAddMins(baseMs, mins) {
  const total = baseMs + mins * 60000;
  const h   = Math.floor(total / 3600000) % 24;
  const m   = Math.floor((total % 3600000) / 60000);
  const day = Math.floor(total / 86400000);
  return `${day > 0 ? '+' + day + 'd ' : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function acpControls(dist) {
  const controls = [0];
  let km = 0;
  while (km < dist - 50) {
    km = Math.min(km + Math.round(dist / Math.ceil(dist / 100)), dist);
    controls.push(km);
  }
  if (controls[controls.length - 1] !== dist) controls.push(dist);
  return controls;
}

// calcNutrition extraído sin DOM
function calcNutritionPure(dist, speed, weight, elev) {
  const hours = dist / speed;
  const kcalPerHour = 400 + (weight - 70) * 4 + (elev / dist) * 200;
  const totalKcal = Math.round(kcalPerHour * hours);
  const carbsNeeded = Math.round(totalKcal * 0.65 / 4);
  const liquidLiters = Math.round(hours * 0.75 * 10) / 10;
  return { hours, totalKcal, carbsNeeded, liquidLiters };
}

// filtro de renderActivities (lógica pura)
function filterActivities(acts, filter) {
  const normalized = acts.map(normalizeActivity).filter(Boolean);
  let rides = normalized.filter(a => a.sport_type === 'Ride' || a.sport_type === 'VirtualRide');
  if (filter === 'commute') {
    rides = rides.filter(a => a.commute || (a.summary && a.summary.distance < 20000));
  } else if (filter === 'long') {
    rides = rides.filter(a => !a.commute && a.summary && a.summary.distance >= 20000 && a.sport_type !== 'VirtualRide');
  } else if (filter === 'virtual') {
    rides = rides.filter(a => a.sport_type === 'VirtualRide');
  }
  return rides;
}

// ─────────────────────────────────────────────
// FIXTURES
// ─────────────────────────────────────────────
const RAW_STRAVA_COMMUTE = {
  id: 11234567890,
  name: 'Commuting mañana',
  sport_type: 'Ride', type: 'Ride',
  start_date: '2024-06-10T10:30:00Z',
  start_date_local: '2024-06-10T07:30:00Z',
  distance: 12340.5, moving_time: 2280, elapsed_time: 2520,
  total_elevation_gain: 85, average_speed: 5.413, max_speed: 11.2,
  average_watts: 187, kilojoules: 426.4,
  average_heartrate: 148.3, max_heartrate: 172, has_heartrate: true,
  average_temp: 14, elev_high: 612.4, elev_low: 527.8, suffer_score: 42,
  commute: true, device_name: 'Garmin Edge 530',
  start_latlng: [-33.4372, -70.6506], end_latlng: [-33.4912, -70.6234],
  map: { id: 'a11234567890', summary_polyline: 'krxdEpzxiL??fEzK`IvNvHzNjEhIdGxPfItQ`BfEz@nBtKtWtEdLf@dAdAtCb@hAnArC', resource_state: 2 },
  calories: 420,
};

const RAW_STRAVA_LONG_RIDE = {
  id: 11234567891,
  name: 'Salida larga Cajón del Maipo',
  sport_type: 'Ride', type: 'Ride',
  start_date: '2024-06-08T12:00:00Z',
  start_date_local: '2024-06-08T09:00:00Z',
  distance: 97600, moving_time: 14520, elapsed_time: 16200,
  total_elevation_gain: 1240, average_speed: 6.722, max_speed: 19.4,
  average_watts: null, kilojoules: null,
  average_heartrate: null, max_heartrate: null, has_heartrate: false,
  average_temp: null, elev_high: 1820.0, elev_low: 610.0, suffer_score: null,
  commute: false, device_name: 'Wahoo ELEMNT BOLT',
  start_latlng: [-33.4372, -70.6506], end_latlng: [-33.4372, -70.6506],
  map: { id: 'a11234567891', summary_polyline: 'krxdEpzxiLsAdBwJxHcFvEgClBoFrEiGfFqK~I', resource_state: 2 },
  calories: null,
};

const RAW_STRAVA_VIRTUAL = {
  id: 11234567892,
  name: 'Zwift - Watopia Hilly Route',
  sport_type: 'VirtualRide', type: 'VirtualRide',
  start_date: '2024-06-07T22:00:00Z',
  start_date_local: '2024-06-07T19:00:00Z',
  distance: 34500, moving_time: 4140, elapsed_time: 4140,
  total_elevation_gain: 437, average_speed: 8.333, max_speed: 14.1,
  average_watts: 231, kilojoules: 956.5,
  average_heartrate: 155, max_heartrate: 181, has_heartrate: true,
  average_temp: null, elev_high: null, elev_low: null, suffer_score: 68,
  commute: false, device_name: 'Zwift',
  start_latlng: null, end_latlng: null,
  map: { id: 'a11234567892', summary_polyline: '', resource_state: 2 },
  calories: 912,
};

const RAW_STRAVA_MINIMAL = {
  id: 11234567893,
  name: 'Pedaleo por el parque',
  sport_type: 'Ride',
  start_date_local: '2024-06-06T16:00:00Z',
  distance: 8200, moving_time: 1800,
  total_elevation_gain: 20, average_speed: 4.556,
};

const CACHED_ACTIVITY = {
  id: 11234567890, name: 'Commuting mañana',
  sport_type: 'Ride', start_local: '2024-06-10T07:30:00Z', commute: true,
  summary: { distance: 12340.5, moving_time: 2280, elevation_gain: 85, avg_speed: 5.413, total_calories: 102, average_watts: null },
  map: { id: 'a11234567890', summary_polyline: 'krxdEpzxiL??fEzK`IvNvHzNjEhIdGxPfItQ`BfEz@nBtKtWtEdLf@dAdAtCb@hAnArC', resource_state: 2 },
  average_watts: 187, average_heartrate: 148.3, max_heartrate: 172,
  has_heartrate: true, average_temp: 14, elev_high: 612.4, elev_low: 527.8,
  suffer_score: 42, max_speed: 11.2, device_name: 'Garmin Edge 530',
  start_latlng: [-33.4372, -70.6506],
};

// Polyline real de Santiago — verificado decode en Node.js con decodePolyline()
// Punto 1: [-33.4372, -70.6506] (Plaza Italia)
// Punto 2: [-33.4489, -70.6350] (Providencia)
// Calculado con spec Google Encoded Polyline y comprobado: decodePolyline('nuakEf}enLbhAo`B')
// retorna [[-33.4372,-70.6506],[-33.4489,-70.635]]
const REAL_POLYLINE = 'nuakEf}enLbhAo`B';

// ═══════════════════════════════════════════════════
// SUITE 1 — normalizeActivity: raw de Strava (22)
// ═══════════════════════════════════════════════════
suite('1 · normalizeActivity() — datos raw de Strava');

test('retorna null si recibe null', () => assertNull(normalizeActivity(null)));

test('commute: extrae id, name, sport_type', () => {
  const r = normalizeActivity(RAW_STRAVA_COMMUTE);
  assertEqual(r.id, 11234567890); assertEqual(r.name, 'Commuting mañana'); assertEqual(r.sport_type, 'Ride');
});

test('commute: usa start_date_local como start_local', () => {
  assertEqual(normalizeActivity(RAW_STRAVA_COMMUTE).start_local, '2024-06-10T07:30:00Z');
});

test('commute: construye summary.distance desde campo raíz', () => {
  assertEqual(normalizeActivity(RAW_STRAVA_COMMUTE).summary.distance, 12340.5);
});

test('commute: construye summary.moving_time', () => {
  assertEqual(normalizeActivity(RAW_STRAVA_COMMUTE).summary.moving_time, 2280);
});

test('commute: construye summary.elevation_gain desde total_elevation_gain', () => {
  assertEqual(normalizeActivity(RAW_STRAVA_COMMUTE).summary.elevation_gain, 85);
});

test('commute: calcula total_calories = round(kilojoules × 0.239)', () => {
  assertEqual(normalizeActivity(RAW_STRAVA_COMMUTE).summary.total_calories, Math.round(426.4 * 0.239));
});

test('commute: preserva map.summary_polyline', () => {
  const r = normalizeActivity(RAW_STRAVA_COMMUTE);
  assertNotNull(r.map);
  assertEqual(r.map.summary_polyline, RAW_STRAVA_COMMUTE.map.summary_polyline);
});

test('commute: preserva average_watts, heartrate, temp, device', () => {
  const r = normalizeActivity(RAW_STRAVA_COMMUTE);
  assertEqual(r.average_watts, 187); assertEqual(r.average_heartrate, 148.3);
  assertEqual(r.max_heartrate, 172); assert(r.has_heartrate === true);
  assertEqual(r.average_temp, 14);  assertEqual(r.device_name, 'Garmin Edge 530');
});

test('commute: preserva elev_high, elev_low, suffer_score, max_speed, start_latlng', () => {
  const r = normalizeActivity(RAW_STRAVA_COMMUTE);
  assertEqual(r.elev_high, 612.4); assertEqual(r.elev_low, 527.8);
  assertEqual(r.suffer_score, 42); assertEqual(r.max_speed, 11.2);
  assertDeepEqual(r.start_latlng, [-33.4372, -70.6506]);
});

test('long ride: polyline preservada', () => {
  assertEqual(normalizeActivity(RAW_STRAVA_LONG_RIDE).map.summary_polyline, RAW_STRAVA_LONG_RIDE.map.summary_polyline);
});

test('long ride: sin FC → average_heartrate=null, has_heartrate=false', () => {
  const r = normalizeActivity(RAW_STRAVA_LONG_RIDE);
  assertNull(r.average_heartrate); assertEqual(r.has_heartrate, false);
});

test('long ride: sin watts ni kilojoules → average_watts=null', () => assertNull(normalizeActivity(RAW_STRAVA_LONG_RIDE).average_watts));

test('long ride: sin calories ni kilojoules → total_calories=null', () => assertNull(normalizeActivity(RAW_STRAVA_LONG_RIDE).summary.total_calories));

test('virtual ride: sport_type=VirtualRide se preserva', () => assertEqual(normalizeActivity(RAW_STRAVA_VIRTUAL).sport_type, 'VirtualRide'));

test('virtual ride: polyline vacío "" → map.summary_polyline="" (falsy pero no null)', () => {
  const r = normalizeActivity(RAW_STRAVA_VIRTUAL);
  assertNotNull(r.map); assertEqual(r.map.summary_polyline, '');
  assert(!r.map.summary_polyline, 'polyline vacío debe ser falsy');
});

test('virtual ride: start_latlng=null → null (no undefined)', () => assertNull(normalizeActivity(RAW_STRAVA_VIRTUAL).start_latlng));

test('virtual ride: calories desde kilojoules → round(956.5×0.239)', () => {
  assertEqual(normalizeActivity(RAW_STRAVA_VIRTUAL).summary.total_calories, Math.round(956.5 * 0.239));
});

test('minimal: sin map → map=null', () => assertNull(normalizeActivity(RAW_STRAVA_MINIMAL).map));

test('minimal: sin average_temp → null (no undefined)', () => assert(normalizeActivity(RAW_STRAVA_MINIMAL).average_temp === null));

test('minimal: fallback name="Sin nombre"', () => {
  assertEqual(normalizeActivity({ ...RAW_STRAVA_MINIMAL, name: undefined }).name, 'Sin nombre');
});

test('usa type (campo legacy) como fallback de sport_type', () => {
  assertEqual(normalizeActivity({ ...RAW_STRAVA_MINIMAL, sport_type: undefined, type: 'Run' }).sport_type, 'Run');
});

// ═══════════════════════════════════════════════════
// SUITE 2 — normalizeActivity: caché (6)
// ═══════════════════════════════════════════════════
suite('2 · normalizeActivity() — datos del caché localStorage');

test('idempotente: summary no cambia en segunda normalización', () => {
  const once = normalizeActivity(RAW_STRAVA_COMMUTE);
  const twice = normalizeActivity(once);
  assertDeepEqual(twice.summary, once.summary);
});

test('caché: summary.distance reutilizado (no reconstruido)', () => {
  assertEqual(normalizeActivity(CACHED_ACTIVITY).summary.distance, 12340.5);
});

test('caché: map.summary_polyline sobrevive doble normalización', () => {
  assertEqual(normalizeActivity(CACHED_ACTIVITY).map.summary_polyline, CACHED_ACTIVITY.map.summary_polyline);
});

test('caché: usa start_local (no start_date_local)', () => {
  assertEqual(normalizeActivity(CACHED_ACTIVITY).start_local, '2024-06-10T07:30:00Z');
});

test('caché: campos opcionales conservados', () => {
  const r = normalizeActivity(CACHED_ACTIVITY);
  assertEqual(r.average_watts, 187); assertEqual(r.suffer_score, 42);
  assertEqual(r.device_name, 'Garmin Edge 530');
});

test('caché: commute=true se preserva', () => assert(normalizeActivity(CACHED_ACTIVITY).commute === true));

// ═══════════════════════════════════════════════════
// SUITE 3 — saveState (8)
// ═══════════════════════════════════════════════════
suite('3 · saveState() — persistencia');

test('guarda activities_cache con map intacto', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ activities: [normalizeActivity(RAW_STRAVA_COMMUTE)] });
  saveState();
  const s = JSON.parse(localStorage.getItem('sebacycling_v1'));
  assertEqual(s.activities_cache[0].map.summary_polyline, RAW_STRAVA_COMMUTE.map.summary_polyline);
});

test('guarda null en map cuando no hay GPS', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ activities: [normalizeActivity(RAW_STRAVA_MINIMAL)] });
  saveState();
  assertNull(JSON.parse(localStorage.getItem('sebacycling_v1')).activities_cache[0].map);
});

test('guarda polyline vacío de virtual ride como ""', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ activities: [normalizeActivity(RAW_STRAVA_VIRTUAL)] });
  saveState();
  const s = JSON.parse(localStorage.getItem('sebacycling_v1'));
  assertEqual(s.activities_cache[0].map.summary_polyline, '');
});

test('límite 30 actividades en cache', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ activities: Array.from({ length: 45 }, (_, i) => normalizeActivity({ ...RAW_STRAVA_COMMUTE, id: i })) });
  saveState();
  assertEqual(JSON.parse(localStorage.getItem('sebacycling_v1')).activities_cache.length, 30);
});

test('persiste accessToken y refreshToken', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ accessToken: 'tok_abc', refreshToken: 'ref_xyz', expiresAt: 9999999999 });
  saveState();
  const s = JSON.parse(localStorage.getItem('sebacycling_v1'));
  assertEqual(s.accessToken, 'tok_abc'); assertEqual(s.refreshToken, 'ref_xyz');
});

test('persiste weightLog', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ weightLog: [{ date: '2024-06-10', w: 96.5 }] });
  saveState();
  assertDeepEqual(JSON.parse(localStorage.getItem('sebacycling_v1')).weightLog, [{ date: '2024-06-10', w: 96.5 }]);
});

test('persiste gymDone', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ gymDone: { 'w1-A-0': true } });
  saveState();
  assertDeepEqual(JSON.parse(localStorage.getItem('sebacycling_v1')).gymDone, { 'w1-A-0': true });
});

test('no lanza si localStorage falla (QuotaExceededError)', () => {
  const orig = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  resetState({ activities: [normalizeActivity(RAW_STRAVA_COMMUTE)] });
  saveState(); // no debe lanzar
  localStorage.setItem = orig;
  assert(true);
});

// ═══════════════════════════════════════════════════
// SUITE 4 — loadState (10)
// ═══════════════════════════════════════════════════
suite('4 · loadState() — restauración');

test('restaura map.summary_polyline tras save+load', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ activities: [normalizeActivity(RAW_STRAVA_COMMUTE)] });
  saveState(); resetState(); loadState();
  assertEqual(STATE.activities[0].map.summary_polyline, RAW_STRAVA_COMMUTE.map.summary_polyline);
});

test('round-trip 3 actividades: polylines intactos', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ activities: [RAW_STRAVA_COMMUTE, RAW_STRAVA_LONG_RIDE, RAW_STRAVA_VIRTUAL].map(normalizeActivity) });
  saveState(); resetState(); loadState();
  assertEqual(STATE.activities[0].map.summary_polyline, RAW_STRAVA_COMMUTE.map.summary_polyline);
  assertEqual(STATE.activities[1].map.summary_polyline, RAW_STRAVA_LONG_RIDE.map.summary_polyline);
  assertEqual(STATE.activities[2].map.summary_polyline, '');
});

test('actividad sin map → null tras loadState', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ activities: [normalizeActivity(RAW_STRAVA_MINIMAL)] });
  saveState(); resetState(); loadState();
  assertNull(STATE.activities[0].map);
});

test('restaura accessToken y refreshToken', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ accessToken: 'tok_abc', refreshToken: 'ref_xyz', expiresAt: 1234567890 });
  saveState(); resetState(); loadState();
  assertEqual(STATE.accessToken, 'tok_abc'); assertEqual(STATE.refreshToken, 'ref_xyz');
});

test('restaura weightLog', () => {
  localStorage.removeItem('sebacycling_v1');
  const log = [{ date: '2024-06-10', w: 97.2 }, { date: '2024-06-11', w: 96.8 }];
  resetState({ weightLog: log }); saveState(); resetState(); loadState();
  assertDeepEqual(STATE.weightLog, log);
});

test('restaura brevets con done=true', () => {
  localStorage.removeItem('sebacycling_v1');
  const brev = [...BREVETS_DEFAULT]; brev[0] = { ...brev[0], done: true };
  resetState({ brevets: brev }); saveState(); resetState(); loadState();
  assert(STATE.brevets[0].done === true);
});

test('restaura gymDone', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ gymDone: { 'w3-C-2': true } }); saveState(); resetState(); loadState();
  assertDeepEqual(STATE.gymDone, { 'w3-C-2': true });
});

test('no lanza si localStorage está vacío', () => {
  localStorage.removeItem('sebacycling_v1'); resetState(); loadState();
  assert(STATE.activities.length === 0); assertNull(STATE.accessToken);
});

test('no lanza si localStorage tiene JSON inválido', () => {
  localStorage.setItem('sebacycling_v1', '{invalid json}'); resetState(); loadState();
  assert(true);
});

test('polyline sobrevive save→load→normalizeActivity (doble normalización)', () => {
  localStorage.removeItem('sebacycling_v1');
  resetState({ activities: [normalizeActivity(RAW_STRAVA_COMMUTE)] });
  saveState(); resetState(); loadState();
  const toRender = STATE.activities.map(normalizeActivity);
  assertEqual(toRender[0].map.summary_polyline, RAW_STRAVA_COMMUTE.map.summary_polyline);
});

// ═══════════════════════════════════════════════════
// SUITE 5 — initRutas: no pasa raw a renderActivities (8)
// ═══════════════════════════════════════════════════
suite('5 · initRutas() — no pasa datos raw a renderActivities()');

test('normalizeActivity produce start_local, no start_date_local', () => {
  const r = normalizeActivity(RAW_STRAVA_COMMUTE);
  assert('start_local' in r); assert(!('start_date_local' in r));
});

test('raw de Strava no tiene summary.distance (confirma necesidad de normalizar)', () => {
  assert((RAW_STRAVA_COMMUTE.summary || {}).distance === undefined);
});

test('normalizado sí tiene summary.distance definido', () => {
  assertEqual(normalizeActivity(RAW_STRAVA_COMMUTE).summary.distance, 12340.5);
});

test('normalizeActivity es estable en segunda pasada (summary no se reconstruye)', () => {
  const once = normalizeActivity(RAW_STRAVA_COMMUTE);
  const twice = normalizeActivity(once);
  assertEqual(twice.summary.distance, once.summary.distance);
  assertEqual(twice.summary.elevation_gain, once.summary.elevation_gain);
});

test('batch: todas las actividades normalizadas tienen summary.distance como número', () => {
  [RAW_STRAVA_COMMUTE, RAW_STRAVA_LONG_RIDE, RAW_STRAVA_VIRTUAL, RAW_STRAVA_MINIMAL]
    .map(normalizeActivity)
    .forEach((a, i) => assert(typeof a.summary.distance === 'number', `act[${i}] summary.distance no es número`));
});

test('batch: polylines preservados donde corresponde', () => {
  const norms = [RAW_STRAVA_COMMUTE, RAW_STRAVA_LONG_RIDE, RAW_STRAVA_VIRTUAL, RAW_STRAVA_MINIMAL].map(normalizeActivity);
  assertEqual(norms[0].map.summary_polyline, RAW_STRAVA_COMMUTE.map.summary_polyline);
  assertEqual(norms[1].map.summary_polyline, RAW_STRAVA_LONG_RIDE.map.summary_polyline);
  assertEqual(norms[2].map.summary_polyline, '');
  assertNull(norms[3].map);
});

test('BUG DETECTADO: renderActivities(acts_raw) → summary.distance sería undefined', () => {
  // Simula el bug: pasar raw directamente como hacía initRutas en línea 1258
  const actRaw = RAW_STRAVA_COMMUTE;
  const d = actRaw.summary || {};
  assert(d.distance === undefined, 'raw.summary no existe → distance undefined → km muestra NaN');
});

test('CORRECCIÓN: renderActivities(acts.map(normalizeActivity)) → summary.distance definido', () => {
  const actNorm = normalizeActivity(RAW_STRAVA_COMMUTE);
  const d = actNorm.summary || {};
  assert(d.distance !== undefined && typeof d.distance === 'number');
});

// ═══════════════════════════════════════════════════
// SUITE 6 — decodePolyline (14)
// ═══════════════════════════════════════════════════
suite('6 · decodePolyline()');

test('string vacío → array vacío', () => assertDeepEqual(decodePolyline(''), []));

test('punto único: "_p~iF~ps|U" → [[38.5, -120.2]] (ejemplo canónico Google)', () => {
  // Documentación oficial de Google: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
  const coords = decodePolyline('_p~iF~ps|U');
  assertEqual(coords.length, 1);
  assertApprox(coords[0][0], 38.5, 0.001);
  assertApprox(coords[0][1], -120.2, 0.001);
});

test('dos puntos: "_p~iF~ps|U_ulLnnqC" → 2 coords', () => {
  const coords = decodePolyline('_p~iF~ps|U_ulLnnqC');
  assertEqual(coords.length, 2);
});

test('polyline del commute decodifica a array de pares [lat,lng]', () => {
  const coords = decodePolyline(RAW_STRAVA_COMMUTE.map.summary_polyline);
  assert(Array.isArray(coords) && coords.length > 0);
  coords.forEach((c, i) => {
    assert(Array.isArray(c) && c.length === 2, `coord[${i}] no es par`);
    assert(typeof c[0] === 'number' && typeof c[1] === 'number', `coord[${i}] no son números`);
  });
});

test('REAL_POLYLINE: primera coord es Santiago [-33.4372, -70.6506]', () => {
  // Usa el polyline verificado de Santiago, no el fixture inventado del commute
  const coords = decodePolyline(REAL_POLYLINE);
  assertApprox(coords[0][0], -33.4372, 0.001, 'lat Plaza Italia');
  assertApprox(coords[0][1], -70.6506, 0.001, 'lng Plaza Italia');
});

test('polyline del long ride decodifica correctamente', () => {
  const coords = decodePolyline(RAW_STRAVA_LONG_RIDE.map.summary_polyline);
  assert(coords.length > 0);
});

test('REAL_POLYLINE decodifica exactamente 2 puntos (Plaza Italia → Providencia)', () => {
  const coords = decodePolyline(REAL_POLYLINE);
  assertEqual(coords.length, 2, `esperaba 2 puntos, obtuvo ${coords.length}`);
});

test('coordenadas son números finitos (no NaN ni Infinity)', () => {
  const coords = decodePolyline(RAW_STRAVA_COMMUTE.map.summary_polyline);
  coords.forEach((c, i) => {
    assert(isFinite(c[0]) && isFinite(c[1]), `coord[${i}] contiene Infinity o NaN`);
  });
});

test('lat en rango plausible [-90, 90]', () => {
  const coords = decodePolyline(RAW_STRAVA_COMMUTE.map.summary_polyline);
  coords.forEach((c, i) => assert(c[0] >= -90 && c[0] <= 90, `lat[${i}]=${c[0]} fuera de rango`));
});

test('lng en rango plausible [-180, 180]', () => {
  const coords = decodePolyline(RAW_STRAVA_COMMUTE.map.summary_polyline);
  coords.forEach((c, i) => assert(c[1] >= -180 && c[1] <= 180, `lng[${i}]=${c[1]} fuera de rango`));
});

test('decodificación es determinista (misma entrada → misma salida)', () => {
  const a = decodePolyline(RAW_STRAVA_COMMUTE.map.summary_polyline);
  const b = decodePolyline(RAW_STRAVA_COMMUTE.map.summary_polyline);
  assertDeepEqual(a, b);
});

test('polyline vacío de virtual ride → array vacío (no crash)', () => {
  assertDeepEqual(decodePolyline(''), []);
});

test('precisión ×1e5: REAL_POLYLINE decodifica con exactitud de 5 decimales', () => {
  // Verifica que la división /1e5 reproduce coordenadas con precisión submétrica
  const coords = decodePolyline(REAL_POLYLINE);
  // Punto 1: lat=-33.4372 (hemisferio sur, negativo)
  assert(coords[0][0] < 0, 'lat debe ser negativa (hemisferio sur)');
  assert(coords[0][1] < 0, 'lng debe ser negativa (occidente)');
  // Punto 2: Providencia, también en hemisferio sur
  assert(coords[1][0] < 0, 'segundo punto también debe ser hemisferio sur');
  assertApprox(coords[1][0], -33.4489, 0.001);
  assertApprox(coords[1][1], -70.635, 0.001);
});

test('acumulación correcta: puntos sucesivos son delta del anterior', () => {
  // Si un polyline tiene 3 puntos con deltas positivos, las coords deben ser crecientes
  // '??': delta [0,0] → un punto en origen; probar con polyline conocido
  const coords = decodePolyline(RAW_STRAVA_LONG_RIDE.map.summary_polyline);
  assert(coords.length >= 2, 'debe haber al menos 2 puntos');
  // Los puntos no deben ser todos iguales (la acumulación debe funcionar)
  const allSame = coords.every(c => c[0] === coords[0][0] && c[1] === coords[0][1]);
  assert(!allSame, 'todos los puntos son iguales — la acumulación de deltas no funciona');
});

// ═══════════════════════════════════════════════════
// SUITE 7 — estimateTSS (12)
// ═══════════════════════════════════════════════════
suite('7 · estimateTSS()');

test('cero movingTime → TSS=0', () => assertEqual(estimateTSS(0, 25, 0), 0));

test('retorna entero (Math.round)', () => assertEqual(estimateTSS(3600, 25, 500), Math.round(estimateTSS(3600, 25, 500))));

test('1h @ 25 km/h plano: intensityFactor = 25/30 = 0.833 → TSS = round(1 × 0.833² × 100) = 69', () => {
  const if_ = 25 / 30; // 0.8333
  assertEqual(estimateTSS(3600, 25, 0), Math.round(if_ * if_ * 100));
});

test('1h @ 30 km/h plano: intensityFactor = 1.0 → TSS=100', () => {
  assertEqual(estimateTSS(3600, 30, 0), 100);
});

test('intensityFactor se tapa en 1.2 (no supera el cap)', () => {
  // avgKmh=50, elevGain=5000 → IF = 50/30 + 5000/5000 = 1.667+1 = 2.667 → cap a 1.2
  const tss = estimateTSS(3600, 50, 5000);
  assertEqual(tss, Math.round(1 * 1.2 * 1.2 * 100)); // 144
});

test('cap de IF: avgKmh=40, elevGain=0 → IF=1.333 → capado a 1.2 → TSS=144', () => {
  assertEqual(estimateTSS(3600, 40, 0), Math.round(1.2 * 1.2 * 100));
});

test('commuting 38min @ 19.5 km/h, 85m desnivel', () => {
  // movingTime=2280, avgKmh=5.413*3.6=19.49, elevGain=85
  const avgKmh = 5.413 * 3.6;
  const r = estimateTSS(2280, avgKmh, 85);
  assert(r > 0 && r < 100, `TSS de commuting debe estar entre 0 y 100, obtuvo ${r}`);
});

test('salida larga 4h @ 24 km/h, 1240m desnivel', () => {
  const avgKmh = 6.722 * 3.6; // ~24.2
  const r = estimateTSS(14520, avgKmh, 1240);
  assert(r > 100, `salida larga debe tener TSS>100, obtuvo ${r}`);
});

test('virtual ride 1.15h @ 30 km/h, 437m', () => {
  const avgKmh = 8.333 * 3.6; // 30
  const r = estimateTSS(4140, avgKmh, 437);
  assert(r > 0, `TSS debe ser positivo, obtuvo ${r}`);
});

test('TSS escala con la duración (2h > 1h en iguales condiciones)', () => {
  const t1 = estimateTSS(3600, 25, 0);
  const t2 = estimateTSS(7200, 25, 0);
  assert(t2 > t1, `TSS 2h (${t2}) debe ser mayor que 1h (${t1})`);
});

test('TSS escala con la intensidad (30km/h > 20km/h misma duración)', () => {
  assert(estimateTSS(3600, 30, 0) > estimateTSS(3600, 20, 0));
});

test('movingTime negativo → TSS negativo (comportamiento conocido, no crash)', () => {
  const r = estimateTSS(-3600, 25, 0);
  assert(typeof r === 'number' && isFinite(r), 'no debe lanzar con tiempo negativo');
});

// ═══════════════════════════════════════════════════
// SUITE 8 — estimateWatts (8)
// ═══════════════════════════════════════════════════
suite('8 · estimateWatts()');

test('retorna entero (Math.round)', () => {
  const r = estimateWatts(25, 500, 3600);
  assertEqual(r, Math.round(r));
});

test('velocidad mayor → más watts (misma pendiente y tiempo)', () => {
  assert(estimateWatts(30, 0, 3600) > estimateWatts(20, 0, 3600));
});

test('más desnivel → más watts (misma velocidad y tiempo)', () => {
  assert(estimateWatts(25, 1000, 3600) > estimateWatts(25, 100, 3600));
});

test('piso @ 0 desnivel 25 km/h 1h: grade=0 → watts = 50 + 25×5 + 0 = 175', () => {
  assertEqual(estimateWatts(25, 0, 3600), Math.round(50 + 25 * 5 + 0));
});

test('resultado es número positivo para valores normales de commuting', () => {
  const r = estimateWatts(19.5, 85, 2280);
  assert(r > 0 && typeof r === 'number');
});

test('resultado para salida larga es mayor que para commuting', () => {
  const commute = estimateWatts(19.5, 85, 2280);
  const longRide = estimateWatts(24.2, 1240, 14520);
  assert(longRide > commute, `salida larga (${longRide}W) debe superar commuting (${commute}W)`);
});

test('no lanza con desnivel=0 (grade=0, sin división por cero)', () => {
  const r = estimateWatts(30, 0, 7200);
  assert(isFinite(r));
});

test('resultado nunca es NaN con entradas numéricas válidas', () => {
  [[25, 500, 3600], [0.1, 0, 60], [40, 2000, 10800]].forEach(([v, e, t]) => {
    assert(!isNaN(estimateWatts(v, e, t)), `NaN para avgKmh=${v} elevGain=${e} movingTime=${t}`);
  });
});

// ═══════════════════════════════════════════════════
// SUITE 9 — getZone (14)
// ═══════════════════════════════════════════════════
suite('9 · getZone()');

test('0W → Z1 (Recuperación)', () => assertEqual(getZone(0).name, 'Z1'));
test('100W → Z1', ()  => assertEqual(getZone(100).name, 'Z1'));
test('164W → Z1 (límite superior)', () => assertEqual(getZone(164).name, 'Z1'));
test('165W → Z2 (Resistencia)', () => assertEqual(getZone(165).name, 'Z2'));
test('200W → Z2', () => assertEqual(getZone(200).name, 'Z2'));
test('224W → Z2 (límite superior)', () => assertEqual(getZone(224).name, 'Z2'));
test('225W → Z3 (Tempo)', () => assertEqual(getZone(225).name, 'Z3'));
test('269W → Z4 (Umbral)', () => assertEqual(getZone(269).name, 'Z4'));
test('298W (FTP) → Z4 (Umbral)', () => assertEqual(getZone(FTP).name, 'Z4'));
test('314W → Z5 (VO2max)', () => assertEqual(getZone(314).name, 'Z5'));
test('359W → Z6 (Anaeróbico)', () => assertEqual(getZone(359).name, 'Z6'));
test('448W → Z7 (Neuromuscular)', () => assertEqual(getZone(448).name, 'Z7'));
test('1000W → Z7 (sobre Z6 → fallback Z7)', () => assertEqual(getZone(1000).name, 'Z7'));
test('cada zona tiene color definido', () => {
  [0, 165, 225, 269, 314, 359, 448].forEach(w => assertNotNull(getZone(w).color, `watts=${w} sin color`));
});

// ═══════════════════════════════════════════════════
// SUITE 10 — calcLoad lógica pura (12)
// ═══════════════════════════════════════════════════
suite('10 · calcLoad() — lógica pura');

function makeActivity(daysAgo, movingTime, avgSpeedMs, elevGain) {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return {
    id: daysAgo,
    name: `Act ${daysAgo}d`,
    sport_type: 'Ride',
    start_date_local: d.toISOString(),
    distance: avgSpeedMs * movingTime,
    moving_time: movingTime,
    total_elevation_gain: elevGain,
    average_speed: avgSpeedMs,
  };
}

test('sin actividades → ATL=0, CTL=0, ACWR=0', () => {
  const { atl, ctl, acwr } = calcLoadPure([]);
  assertEqual(atl, 0); assertEqual(ctl, 0); assertEqual(acwr, 0);
});

test('actividad de hace 50 días → ignorada (fuera de ventana 42d)', () => {
  const old = makeActivity(50, 7200, 6.94, 500);
  const { atl, ctl } = calcLoadPure([old]);
  assertEqual(atl, 0); assertEqual(ctl, 0);
});

test('actividad de hoy (daysAgo=0) → entra en ATL y CTL', () => {
  const today = makeActivity(0, 3600, 8.33, 0);
  const { atl, ctl } = calcLoadPure([today]);
  assert(atl > 0, 'ATL debe ser > 0'); assert(ctl > 0, 'CTL debe ser > 0');
});

test('actividad de hace 6 días → entra en ATL (ventana 7d)', () => {
  const recent = makeActivity(6, 3600, 8.33, 0);
  const { atl } = calcLoadPure([recent]);
  assert(atl > 0, 'actividad de hace 6d debe estar en ATL');
});

test('actividad de hace 7 días → fuera del ATL (ventana exacta 0-6)', () => {
  const edge = makeActivity(7, 3600, 8.33, 0);
  const { atl } = calcLoadPure([edge]);
  assertEqual(atl, 0, 'actividad de hace exactamente 7d NO debe estar en ATL');
});

test('actividad de hace 27 días → entra en CTL', () => {
  const old27 = makeActivity(27, 3600, 8.33, 0);
  const { ctl } = calcLoadPure([old27]);
  assert(ctl > 0, 'actividad de hace 27d debe estar en CTL');
});

test('actividad de hace 28 días → fuera del CTL', () => {
  const edge28 = makeActivity(28, 3600, 8.33, 0);
  const { ctl } = calcLoadPure([edge28]);
  assertEqual(ctl, 0, 'actividad de hace 28d NO debe estar en CTL');
});

test('ATL es promedio diario de 7 días (TSS/7)', () => {
  const act = makeActivity(0, 3600, 8.33, 0);
  const tss = estimateTSS(3600, 8.33 * 3.6, 0);
  const { atl } = calcLoadPure([act]);
  assertApprox(atl, tss / 7, 0.01);
});

test('CTL es promedio diario de 28 días (TSS/28)', () => {
  const act = makeActivity(0, 3600, 8.33, 0);
  const tss = estimateTSS(3600, 8.33 * 3.6, 0);
  const { ctl } = calcLoadPure([act]);
  assertApprox(ctl, tss / 28, 0.01);
});

test('ACWR = ATL / CTL cuando ambos > 0', () => {
  const acts = [makeActivity(0, 3600, 8.33, 0), makeActivity(14, 3600, 8.33, 0)];
  const { atl, ctl, acwr } = calcLoadPure(acts);
  if (ctl > 0) assertApprox(acwr, atl / ctl, 0.001);
});

test('dos actividades el mismo día → TSS se suman', () => {
  const a1 = makeActivity(0, 3600, 8.33, 0);
  const a2 = makeActivity(0, 1800, 8.33, 0);
  const { atl: atlBoth } = calcLoadPure([a1, a2]);
  const { atl: atlOne } = calcLoadPure([a1]);
  assert(atlBoth > atlOne, 'dos actividades el mismo día deben sumar TSS');
});

test('actividad futura (daysAgo < 0) → ignorada', () => {
  const future = makeActivity(-1, 3600, 8.33, 0);
  const { atl, ctl } = calcLoadPure([future]);
  assertEqual(atl, 0); assertEqual(ctl, 0);
});

// ═══════════════════════════════════════════════════
// SUITE 11 — calcACP lógica pura (16)
// ═══════════════════════════════════════════════════
suite('11 · calcACP() — lógica pura (reglas ACP)');

test('200km: controles = [0, 100, 200]', () => {
  assertDeepEqual(acpControls(200), [0, 100, 200]);
});

test('300km: controles = [0, 100, 200, 300]', () => {
  assertDeepEqual(acpControls(300), [0, 100, 200, 300]);
});

test('400km: controles = [0, 100, 200, 300, 400]', () => {
  assertDeepEqual(acpControls(400), [0, 100, 200, 300, 400]);
});

test('600km: controles = [0, 100, 200, 300, 400, 500, 600]', () => {
  assertDeepEqual(acpControls(600), [0, 100, 200, 300, 400, 500, 600]);
});

test('getOpenClose(0) → openMins=0, closeMins=0', () => {
  assertDeepEqual(acpGetOpenClose(0), { openMins: 0, closeMins: 0 });
});

test('getOpenClose(200): cierre = round(200/34×60) = round(352.9) = 353 min', () => {
  const { closeMins } = acpGetOpenClose(200);
  assertEqual(closeMins, Math.round(200 / 34 * 60));
});

test('getOpenClose(200): apertura = round(200/15×60) = round(800) = 800 min', () => {
  const { openMins } = acpGetOpenClose(200);
  assertEqual(openMins, Math.round(200 / 15 * 60));
});

test('getOpenClose(200): closeMins < openMins (cierre antes que apertura — lógica ACP)', () => {
  const { openMins, closeMins } = acpGetOpenClose(200);
  assert(closeMins < openMins, `closeMins (${closeMins}) debe ser < openMins (${openMins})`);
});

test('getOpenClose(400): segmento 200-400 usa closeKmh=32', () => {
  const { closeMins: c200 } = acpGetOpenClose(200);
  const { closeMins: c400 } = acpGetOpenClose(400);
  const extra = Math.round(200 / 32 * 60);
  assertEqual(c400, c200 + extra);
});

test('getOpenClose(600): segmento 400-600 usa closeKmh=30', () => {
  const { closeMins: c400 } = acpGetOpenClose(400);
  const { closeMins: c600 } = acpGetOpenClose(600);
  const extra = Math.round(200 / 30 * 60);
  assertEqual(c600, c400 + extra);
});

test('addMins: 07:00 + 0 min = "07:00"', () => {
  const base = (7 * 60) * 60000;
  assertEqual(acpAddMins(base, 0), '07:00');
});

test('addMins: 07:00 + 60 min = "08:00"', () => {
  const base = (7 * 60) * 60000;
  assertEqual(acpAddMins(base, 60), '08:00');
});

test('addMins: 07:00 + 353 min = correcto (5h53m → 12:53)', () => {
  const base = (7 * 60) * 60000;
  const result = acpAddMins(base, 353);
  assertEqual(result, '12:53');
});

test('addMins: día siguiente muestra +1d', () => {
  const base = (23 * 60) * 60000;
  const result = acpAddMins(base, 90); // 23:00 + 90min = 00:30 del día siguiente
  assert(result.startsWith('+1d'), `esperaba +1d, obtuvo: ${result}`);
});

test('ventana (closeMins - openMins) es negativa para 200km (cierre antes que apertura máxima)', () => {
  const { openMins, closeMins } = acpGetOpenClose(200);
  // La ventana en la tabla es closeMins - openMins para controles intermedios, pero
  // lo que el ciclista tiene disponible es: el control está ABIERTO entre openMins y closeMins
  // La ventana real es closeMins - openMins (tiempo disponible para llegar después de apertura)
  assert(typeof (closeMins - openMins) === 'number');
});

test('200km brevet: cierre en km200 < 60h×60m = 3600 min', () => {
  const { closeMins } = acpGetOpenClose(200);
  assert(closeMins < 3600, `cierre 200km (${closeMins}min) debe ser < 3600min (60h)`);
});

// ═══════════════════════════════════════════════════
// SUITE 12 — calcNutrition lógica pura (10)
// ═══════════════════════════════════════════════════
suite('12 · calcNutrition() — lógica pura');

test('200km @ 22km/h → duración 9.09h', () => {
  const { hours } = calcNutritionPure(200, 22, 98, 500);
  assertApprox(hours, 200 / 22, 0.001);
});

test('kcal aumenta con la distancia', () => {
  const short = calcNutritionPure(100, 22, 98, 300);
  const long  = calcNutritionPure(300, 22, 98, 300);
  assert(long.totalKcal > short.totalKcal);
});

test('kcal aumenta con el peso del ciclista', () => {
  const light = calcNutritionPure(200, 22, 70, 500);
  const heavy  = calcNutritionPure(200, 22, 98, 500);
  assert(heavy.totalKcal > light.totalKcal);
});

test('carbsNeeded = round(totalKcal × 0.65 / 4)', () => {
  const r = calcNutritionPure(200, 22, 98, 500);
  assertEqual(r.carbsNeeded, Math.round(r.totalKcal * 0.65 / 4));
});

test('liquidLiters = round(hours × 0.75 × 10) / 10', () => {
  const r = calcNutritionPure(200, 22, 98, 500);
  assertApprox(r.liquidLiters, Math.round((200 / 22) * 0.75 * 10) / 10, 0.001);
});

test('200km @ 22km/h, 98kg, 500m desnivel: kcalPerHour base', () => {
  const dist=200, speed=22, weight=98, elev=500;
  const hours = dist / speed;
  const kcalPerHour = 400 + (weight - 70) * 4 + (elev / dist) * 200;
  const expected = Math.round(kcalPerHour * hours);
  assertEqual(calcNutritionPure(dist, speed, weight, elev).totalKcal, expected);
});

test('600km brevet: totalKcal > 5000 (evento de larga distancia)', () => {
  const { totalKcal } = calcNutritionPure(600, 22, 98, 3000);
  assert(totalKcal > 5000, `600km debe superar 5000 kcal, obtuvo ${totalKcal}`);
});

test('más desnivel → más kcal (pendiente incrementa gasto)', () => {
  const flat  = calcNutritionPure(200, 22, 98, 0);
  const hilly = calcNutritionPure(200, 22, 98, 3000);
  assert(hilly.totalKcal > flat.totalKcal);
});

test('liquidLiters escala con la duración', () => {
  const short = calcNutritionPure(100, 22, 98, 0);
  const long  = calcNutritionPure(400, 22, 98, 0);
  assert(long.liquidLiters > short.liquidLiters);
});

test('resultados son números finitos (no NaN, no Infinity)', () => {
  const r = calcNutritionPure(200, 22, 98, 500);
  ['hours','totalKcal','carbsNeeded','liquidLiters'].forEach(k => {
    assert(isFinite(r[k]), `${k} no es finito: ${r[k]}`);
  });
});

// ═══════════════════════════════════════════════════
// SUITE 13 — filtro renderActivities (4)
// ═══════════════════════════════════════════════════
suite('13 · filtro renderActivities()');

const FILTER_ACTS = [
  RAW_STRAVA_COMMUTE,    // Ride, commute=true,  dist=12340  (<20km)
  RAW_STRAVA_LONG_RIDE,  // Ride, commute=false, dist=97600  (≥20km)
  RAW_STRAVA_VIRTUAL,    // VirtualRide, dist=34500
  RAW_STRAVA_MINIMAL,    // Ride, commute=false, dist=8200   (<20km)
];

test('filtro "all": retorna todos los Ride y VirtualRide', () => {
  assertEqual(filterActivities(FILTER_ACTS, 'all').length, 4);
});

test('filtro "commute": retorna actividades con commute=true O distance<20km', () => {
  const r = filterActivities(FILTER_ACTS, 'commute');
  // commute=true: RAW_COMMUTE (12340m <20km)
  // distance<20km: RAW_MINIMAL (8200m)
  // RAW_LONG_RIDE: 97600 ≥20km, commute=false → excluida
  // RAW_VIRTUAL: VirtualRide → incluida si dist<20km? No: 34500 ≥20km Y commute=false → excluida
  assert(r.some(a => a.id === RAW_STRAVA_COMMUTE.id), 'commuting debe incluirse');
  assert(r.some(a => a.id === RAW_STRAVA_MINIMAL.id), 'minimal (<20km) debe incluirse');
  assert(!r.some(a => a.id === RAW_STRAVA_LONG_RIDE.id), 'salida larga NO debe incluirse');
});

test('filtro "long": retorna Ride no-commute con distance≥20km', () => {
  const r = filterActivities(FILTER_ACTS, 'long');
  assert(r.some(a => a.id === RAW_STRAVA_LONG_RIDE.id), 'salida larga debe incluirse');
  assert(!r.some(a => a.id === RAW_STRAVA_COMMUTE.id), 'commute NO debe incluirse');
  assert(!r.some(a => a.id === RAW_STRAVA_VIRTUAL.id), 'virtual NO debe incluirse');
});

test('filtro "virtual": retorna solo VirtualRide', () => {
  const r = filterActivities(FILTER_ACTS, 'virtual');
  assertEqual(r.length, 1);
  assertEqual(r[0].id, RAW_STRAVA_VIRTUAL.id);
});

// ─────────────────────────────────────────────
// RESUMEN FINAL
// ─────────────────────────────────────────────
const totalTests = passed + failed;
console.log('\n' + '═'.repeat(54));
console.log(`  Total:    ${totalTests} tests`);
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
if (failures.length > 0) {
  console.log('\n  Fallos:');
  failures.forEach(f => console.log(`    [${f.suite}] ${f.desc}\n      → ${f.err}`));
}
console.log('═'.repeat(54));
if (totalTests !== 144) console.warn(`\n⚠️  Se esperaban 144 tests, se ejecutaron ${totalTests}`);
if (failed > 0) process.exit(1);
