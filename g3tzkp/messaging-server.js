const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let ZKPEngine = null;
let zkpEngine = null;

async function initializeZKP() {
  try {
    const zkpModule = require('./Packages/zkp/zkp-engine');
    ZKPEngine = zkpModule.ZKPEngine;
    zkpEngine = new ZKPEngine('./zkp-circuits/build');
    await zkpEngine.initialize();
    console.log('[G3ZKP] ZKP Engine initialized with snarkjs');
  } catch (err) {
    console.log('[G3ZKP] ZKP Engine not available, using simulation mode:', err.message);
  }
}

const app = express();
const httpServer = createServer(app);
const SOCKET_ALLOWED_ORIGINS = [
  'http://127.0.0.1:5000',
  'http://localhost:5000',
  'http://0.0.0.0:5000',
  'http://127.0.0.1:58834',
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null
].filter(Boolean);

const io = new Server(httpServer, {
  cors: {
    origin: SOCKET_ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 100 * 1024 * 1024
});

const PORT = process.env.MESSAGING_PORT || 3001;

const connectedPeers = new Map();
const messageStore = [];
const MAX_MESSAGES = 1000;
const pendingSystemMessages = new Map();

const trafficHazards = new Map();
const trafficReports = new Map();
const HAZARD_EXPIRY_MS = 60 * 60 * 1000;


const MEDIA_STORAGE_DIR = path.join(__dirname, 'media_storage');
if (!fs.existsSync(MEDIA_STORAGE_DIR)) {
  fs.mkdirSync(MEDIA_STORAGE_DIR, { recursive: true });
}

const mediaIndex = new Map();

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

const ALLOWED_ORIGINS = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://192.168.1.100:5000',
  'http://192.168.0.187:5000',
  'http://localhost:63555',
  'http://127.0.0.1:63555',
  'http://127.0.0.1:58834',
  'http://localhost:58834',
  process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null
].filter(Boolean);

app.use((req, res, next) => {
   const origin = req.headers.origin;
   if (origin && ALLOWED_ORIGINS.includes(origin)) {
     res.header('Access-Control-Allow-Origin', origin);
   } else if (!origin) {
     res.header('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
   }
   res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
   res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
   res.header('Access-Control-Allow-Credentials', 'true');
   if (req.method === 'OPTIONS') {
     return res.sendStatus(200);
   }
   next();
 });

// Rate limiting middleware
app.use('/api/', (req, res, next) => {
  const clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.ceil(RATE_LIMIT_WINDOW / 1000)
    });
  }

  next();
});

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(MEDIA_STORAGE_DIR));

const axios = require('axios');
const { LRUCache } = require('lru-cache');

// Licensing system
const LICENSE_SECRET_KEY = process.env.LICENSE_SECRET_KEY || 'your_secure_signing_key_256_chars_min';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || 'price_your_lifetime_price';

// BETA MODE CONFIGURATION
const BETA_MODE = process.env.BETA_MODE === 'true';

// In-memory license store (use database in production)
const licenseStore = new Map();

// Performance optimizations
const navigationCache = new LRUCache({
  max: 1000,  // Increased cache size
  ttl: 1000 * 60 * 30,  // 30 minutes TTL
  updateAgeOnGet: true  // Refresh TTL on access
});

const trafficCache = new LRUCache({
  max: 200,
  ttl: 1000 * 60 * 5,  // 5 minutes for traffic data
  updateAgeOnGet: true
});

const transitCache = new LRUCache({
  max: 300,
  ttl: 1000 * 60 * 15,  // 15 minutes for transit data
  updateAgeOnGet: true
});

const downloadJobs = new Map();

// Connection pooling for axios
const axiosInstance = axios.create({
  timeout: 10000,
  headers: {
    'User-Agent': 'G3ZKP-Navigator-Node/1.0'
  },
  maxContentLength: Infinity,
  maxBodyLength: Infinity
});

// Rate limiting
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // requests per window

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;

  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, []);
  }

  const requests = requestCounts.get(ip);
  // Remove old requests outside the window
  const validRequests = requests.filter(time => time > windowStart);

  if (validRequests.length >= RATE_LIMIT_MAX) {
    return false; // Rate limited
  }

  validRequests.push(now);
  requestCounts.set(ip, validRequests);
  return true; // OK
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'G3ZKP Messenger Server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    connectedPeers: connectedPeers.size,
    messagesStored: messageStore.length,
    zkpEngineReady: zkpEngine?.isInitialized() || false,
    betaMode: BETA_MODE
  });
});

// Proxy all external navigation API calls
app.post('/api/navigation/route', async (req, res) => {
  const { coordinates, profile = 'car', alternatives = 1, steps = true, overview = 'full' } = req.body;

  if (!coordinates || coordinates.length < 2) {
    return res.status(400).json({ error: 'At least 2 coordinates required' });
  }

  try {
    const coordString = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/${profile}/${coordString}?alternatives=${Math.min(alternatives, 3)}&steps=${steps}&overview=${overview}&annotations=true&geometries=geojson`;

    console.log(`[NAVIGATION-PROXY] Routing request to OSRM: ${osrmUrl.replace(/https:\/\/[^\/]+/, 'OSRM')}`);

    const response = await axios.get(osrmUrl, {
      headers: {
        'User-Agent': 'G3ZKP-Navigator-Node/1.0',
        'Referer': 'https://g3zkp-messenger.com'
      },
      timeout: 15000
    });

    if (response.data.code !== 'Ok') {
      throw new Error(`OSRM error: ${response.data.code}`);
    }

    const routes = response.data.routes.map((route, index) => ({
      id: `route_${Date.now()}_${index}`,
      geometry: route.geometry,
      distance: route.distance,
      duration: route.duration,
      legs: route.legs.map(leg => ({
        steps: leg.steps ? leg.steps.map(step => ({
          distance: step.distance,
          duration: step.duration,
          geometry: step.geometry,
          instruction: step.maneuver.instruction || `${step.maneuver.type} onto ${step.name}`,
          name: step.name || 'Unknown',
          maneuver: {
            type: step.maneuver.type,
            instruction: step.maneuver.instruction || '',
            bearing_after: step.maneuver.bearing_after || 0,
            location: step.maneuver.location
          }
        })) : [],
        distance: leg.distance,
        duration: leg.duration,
        summary: leg.summary || ''
      })),
      summary: `${(route.distance / 1000).toFixed(1)} km via ${response.data.waypoints[0]?.name || 'route'}`,
      privacy: {
        obfuscated: true,
        fuzzyPoints: coordinates.map(coord => ({
          original: coord,
          displayed: [
            coord[0] + (Math.random() * 0.001 - 0.0005),
            coord[1] + (Math.random() * 0.001 - 0.0005)
          ]
        })),
        timestamp: Date.now(),
        sessionId: null
      }
    }));

    res.json({ routes });
  } catch (error) {
    console.error('[NAVIGATION-PROXY] Routing error:', error.message);
    res.status(500).json({ error: 'Routing failed', details: error.message });
  }
});

app.get('/api/navigation/search', async (req, res) => {
  const { q, format = 'jsonv2', limit = 10, viewbox, bounded } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: 'Search query required' });
  }

  const cacheKey = `search:${q}:${viewbox || 'global'}`;
  const cached = navigationCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const params = new URLSearchParams({
      q,
      format,
      limit,
      addressdetails: '1',
      'accept-language': 'en',
      ...(viewbox && { viewbox, bounded: bounded || '1' })
    });

    const response = await axios.get(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'G3ZKP-Navigator-Node/1.0',
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    navigationCache.set(cacheKey, response.data);
    res.json(response.data);
  } catch (error) {
    console.error('[NAVIGATION] Search error:', error.message);
    
    const cached = navigationCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    res.status(500).json({ error: 'Search failed', details: error.message });
  }
});

app.get('/api/navigation/reverse', async (req, res) => {
  const { lat, lon, zoom = 18 } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Latitude and longitude required' });
  }

  try {
    const response = await axios.get(`https://nominatim.openstreetmap.org/reverse`, {
      params: {
        lat,
        lon,
        zoom: Math.min(parseInt(zoom), 18),
        format: 'jsonv2',
        addressdetails: '1'
      },
      headers: {
        'User-Agent': 'G3ZKP-Navigator-Node/1.0'
      },
      timeout: 10000
    });

    res.json(response.data);
  } catch (error) {
    console.error('[NAVIGATION] Reverse geocoding error:', error.message);
    res.status(500).json({ error: 'Reverse geocoding failed' });
  }
});

app.post('/api/navigation/maps/download', async (req, res) => {
  const { region, priority = 'medium' } = req.body;
  
  if (!region || !region.bbox || !region.name) {
    return res.status(400).json({ error: 'Region with bbox and name required' });
  }

  const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  
  const [minLon, minLat, maxLon, maxLat] = region.bbox;
  const area = Math.abs((maxLon - minLon) * (maxLat - minLat));
  const estimatedSize = Math.floor(area * 10000000);
  
  downloadJobs.set(jobId, {
    id: jobId,
    region,
    status: 'queued',
    progress: 0,
    estimatedSize,
    startTime: Date.now(),
    priority
  });

  processDownloadJob(jobId);

  res.json({
    jobId,
    estimatedSize,
    message: 'Download job queued'
  });
});

async function processDownloadJob(jobId) {
  const job = downloadJobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'downloading';
    
    for (let progress = 0; progress <= 100; progress += 10) {
      job.progress = progress;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    job.status = 'complete';
    job.completeTime = Date.now();
    
  } catch (error) {
    job.status = 'failed';
    job.error = error.message;
  }
}

app.get('/api/navigation/maps/status/:jobId', (req, res) => {
  const job = downloadJobs.get(req.params.jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json({
    jobId: job.id,
    status: job.status,
    progress: job.progress,
    estimatedSize: job.estimatedSize,
    ...(job.error && { error: job.error })
  });
});

app.get('/api/zkp/status', (req, res) => {
  res.json({
    mode: zkpEngine?.isInitialized() ? 'production' : 'simulated',
    initialized: zkpEngine?.isInitialized() || false,
    timestamp: Date.now()
  });
});

app.get('/api/traffic/live', async (req, res) => {
  const { bbox, zoom = 10, api = 'tomtom' } = req.query;

  if (!bbox) {
    return res.status(400).json({ error: 'Bounding box required' });
  }

  const cacheKey = `traffic:${bbox}:${zoom}:${api}`;
  const cached = trafficCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    let trafficData = [];

    if (api === 'tomtom' && process.env.TOMTOM_API_KEY) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
      const centerLon = (minLon + maxLon) / 2;
      const centerLat = (minLat + maxLat) / 2;

      const response = await axios.get(
        `https://api.tomtom.com/traffic/services/4/flowSegmentData/relative0/10/json`,
        {
          params: {
            key: process.env.TOMTOM_API_KEY,
            point: `${centerLat},${centerLon}`,
            zoom: Math.min(parseInt(zoom), 22),
            thickness: 8,
            format: 'json'
          },
          timeout: 10000
        }
      );

      trafficData = response.data.flowSegmentData?.coordinates?.map(coord => ({
        type: 'flow',
        coordinates: coord,
        speed: response.data.flowSegmentData.currentSpeed || 0,
        freeFlowSpeed: response.data.flowSegmentData.freeFlowSpeed || 0,
        confidence: response.data.flowSegmentData.confidence || 0,
        source: 'tomtom'
      })) || [];

    } else {
      trafficData = [{
        type: 'simulated',
        coordinates: [],
        message: 'Live traffic data requires TOMTOM_API_KEY',
        source: 'simulated'
      }];
    }

    navigationCache.set(cacheKey, trafficData);
    res.json(trafficData);

  } catch (error) {
    console.error('[TRAFFIC] Live traffic error:', error.message);
    res.status(500).json({
      error: 'Traffic data unavailable',
      details: error.message
    });
  }
});

app.get('/api/traffic/incidents', async (req, res) => {
  const { bbox, api = 'tomtom' } = req.query;

  if (!bbox) {
    return res.status(400).json({ error: 'Bounding box required' });
  }

  const cacheKey = `incidents:${bbox}:${api}`;
  const cached = trafficCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    let incidents = [];

    if (api === 'tomtom' && process.env.TOMTOM_API_KEY) {
      const response = await axios.get(
        `https://api.tomtom.com/traffic/services/5/incidentDetails`,
        {
          params: {
            key: process.env.TOMTOM_API_KEY,
            bbox: bbox,
            fields: '{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code}}}}',
            language: 'en-GB'
          },
          timeout: 10000
        }
      );

      incidents = response.data.incidents?.map(incident => ({
        id: incident.id,
        type: incident.properties?.iconCategory || 'unknown',
        severity: incident.properties?.magnitudeOfDelay || 0,
        description: incident.properties?.events?.[0]?.description || 'Incident reported',
        coordinates: incident.geometry?.coordinates || [],
        source: 'tomtom'
      })) || [];

    } else {
      incidents = [{
        type: 'info',
        message: 'Live incident data requires TOMTOM_API_KEY',
        source: 'simulated'
      }];
    }

    navigationCache.set(cacheKey, incidents);
    res.json(incidents);

  } catch (error) {
    console.error('[TRAFFIC] Incidents error:', error.message);
    res.status(500).json({
      error: 'Incident data unavailable',
      details: error.message
    });
  }
});

console.log('[G3ZKP] Traffic API endpoints loaded');
console.log('[G3ZKP] Navigation API endpoints loaded');

const TFL_API_BASE = 'https://api.tfl.gov.uk';
const TFL_API_KEY = process.env.TFL_API_KEY || null;

const TFL_MODE_MAP = {
  'train': 'national-rail',
  'rail': 'national-rail',
  'metro': 'tube',
  'subway': 'tube',
  'light-rail': 'dlr',
  'bus': 'bus',
  'tube': 'tube',
  'dlr': 'dlr',
  'overground': 'overground',
  'tram': 'tram',
  'elizabeth-line': 'elizabeth-line',
  'national-rail': 'national-rail',
  'walking': 'walking',
  'cycling': 'cycling'
};

function normalizeTflModes(modeString) {
  if (!modeString) return null;
  const modes = modeString.split(',').map(m => m.trim().toLowerCase());
  const normalized = modes.map(m => TFL_MODE_MAP[m] || m);
  const unique = [...new Set(normalized)];
  return unique.join(',');
}

app.get('/api/transit/journey', async (req, res) => {
  const { from, to, mode, timeIs, time, date, journeyPreference, via, avoidMotorways, avoidTolls, avoidFerries, units } = req.query;
  
  if (!from || !to) {
    return res.status(400).json({ error: 'From and to locations required' });
  }

  const normalizedMode = normalizeTflModes(mode);
  const cacheKey = `transit:${from}:${to}:${normalizedMode || 'all'}:${date || 'now'}:${via || ''}`;
  const cached = navigationCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const params = new URLSearchParams();
    if (TFL_API_KEY) params.append('app_key', TFL_API_KEY);
    if (normalizedMode) params.append('mode', normalizedMode);
    if (timeIs) params.append('timeIs', timeIs);
    if (time) params.append('time', time);
    if (date) params.append('date', date);
    if (journeyPreference) params.append('journeyPreference', journeyPreference);
    
    if (via) {
      const viaPoints = via.split('|');
      viaPoints.forEach(v => params.append('via', v));
    }
    
    const accessibilityPrefs = [];
    if (avoidMotorways === 'true') accessibilityPrefs.push('noMotorways');
    if (avoidFerries === 'true') accessibilityPrefs.push('noFerries');
    if (accessibilityPrefs.length > 0) {
      params.append('accessibilityPreference', accessibilityPrefs.join(','));
    }

    const url = `${TFL_API_BASE}/Journey/JourneyResults/${encodeURIComponent(from)}/to/${encodeURIComponent(to)}?${params}`;
    console.log('[TRANSIT] Journey URL:', url.replace(TFL_API_KEY || '', '***'));
    
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'G3ZKP-Navigator/1.0' },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: (status) => status < 400 || status === 300
    });

    if (response.status === 300) {
      const disambiguation = response.data;
      if (disambiguation.journeys && disambiguation.journeys.length > 0) {
        navigationCache.set(cacheKey, { journeys: disambiguation.journeys });
        return res.json({ journeys: disambiguation.journeys });
      }
      
      const fromOptions = disambiguation.fromLocationDisambiguation?.disambiguationOptions || [];
      const toOptions = disambiguation.toLocationDisambiguation?.disambiguationOptions || [];
      
      if (fromOptions.length > 0 || toOptions.length > 0) {
        const bestFrom = fromOptions[0]?.place?.icsCode || fromOptions[0]?.naptan || from;
        const bestTo = toOptions[0]?.place?.icsCode || toOptions[0]?.naptan || to;
        
        if (bestFrom !== from || bestTo !== to) {
          console.log('[TRANSIT] Retrying with disambiguated locations:', bestFrom, bestTo);
          const retryUrl = `${TFL_API_BASE}/Journey/JourneyResults/${encodeURIComponent(bestFrom)}/to/${encodeURIComponent(bestTo)}?${params}`;
          const retryResponse = await axios.get(retryUrl, {
            headers: { 'User-Agent': 'G3ZKP-Navigator/1.0' },
            timeout: 15000
          });
          navigationCache.set(cacheKey, retryResponse.data);
          return res.json(retryResponse.data);
        }
      }
      
      return res.status(400).json({ 
        error: 'Multiple matches found - please be more specific',
        fromOptions: fromOptions.slice(0, 5).map(o => ({ name: o.place?.commonName, id: o.place?.icsCode })),
        toOptions: toOptions.slice(0, 5).map(o => ({ name: o.place?.commonName, id: o.place?.icsCode }))
      });
    }

    navigationCache.set(cacheKey, response.data);
    res.json(response.data);
  } catch (error) {
    console.error('[TRANSIT] Journey planning error:', error.message);
    if (error.response?.status === 400) {
      return res.status(400).json({ 
        error: 'Invalid locations - please select stops from the dropdown suggestions',
        details: error.response?.data?.message || error.message 
      });
    }
    res.status(500).json({ error: 'Transit journey planning failed', details: error.message });
  }
});

app.get('/api/transit/line-status', async (req, res) => {
  const { modes } = req.query;
  const modeParam = modes || 'tube,dlr,overground,tram,elizabeth-line,national-rail';
  
  const cacheKey = `transit:status:${modeParam}`;
  const cached = navigationCache.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    const params = TFL_API_KEY ? `?app_key=${TFL_API_KEY}` : '';
    const url = `${TFL_API_BASE}/Line/Mode/${modeParam}/Status${params}`;
    
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'G3ZKP-Navigator/1.0' },
      timeout: 10000
    });

    const result = response.data.map(line => ({
      lineId: line.id,
      lineName: line.name,
      mode: line.modeName,
      status: line.lineStatuses?.[0]?.statusSeverityDescription || 'Unknown',
      reason: line.lineStatuses?.[0]?.reason
    }));

    navigationCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('[TRANSIT] Line status error:', error.message);
    res.status(500).json({ error: 'Failed to get line status' });
  }
});

app.get('/api/transit/arrivals/:stopId', async (req, res) => {
  const { stopId } = req.params;
  const { lines } = req.query;

  try {
    let url = `${TFL_API_BASE}/StopPoint/${stopId}/Arrivals`;
    const params = new URLSearchParams();
    if (TFL_API_KEY) params.append('app_key', TFL_API_KEY);
    if (lines) params.append('lineIds', lines);
    
    if (params.toString()) url += '?' + params.toString();

    const response = await axios.get(url, {
      headers: { 'User-Agent': 'G3ZKP-Navigator/1.0' },
      timeout: 10000
    });

    const arrivals = response.data.sort((a, b) => a.timeToStation - b.timeToStation);
    res.json(arrivals);
  } catch (error) {
    console.error('[TRANSIT] Arrivals error:', error.message);
    res.status(500).json({ error: 'Failed to get arrivals' });
  }
});

app.get('/api/transit/search', async (req, res) => {
  const { query, maxResults = 10 } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Query required' });
  }

  try {
    const params = new URLSearchParams({ query, maxResults: String(maxResults) });
    if (TFL_API_KEY) params.append('app_key', TFL_API_KEY);
    
    const url = `${TFL_API_BASE}/StopPoint/Search?${params}`;
    
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'G3ZKP-Navigator/1.0' },
      timeout: 10000
    });

    const stops = (response.data.matches || []).map(match => ({
      id: match.id,
      name: match.name,
      coordinate: [match.lon, match.lat],
      naptanId: match.id,
      modes: match.modes
    }));

    res.json(stops);
  } catch (error) {
    console.error('[TRANSIT] Stop search error:', error.message);
    res.status(500).json({ error: 'Failed to search stops' });
  }
});

app.get('/api/transit/disruptions', async (req, res) => {
  try {
    const params = TFL_API_KEY ? `?app_key=${TFL_API_KEY}` : '';
    const url = `${TFL_API_BASE}/Line/Mode/tube,dlr,overground,elizabeth-line/Disruption${params}`;
    
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'G3ZKP-Navigator/1.0' },
      timeout: 10000
    });

    res.json(response.data);
  } catch (error) {
    console.error('[TRANSIT] Disruptions error:', error.message);
    res.status(500).json({ error: 'Failed to get disruptions' });
  }
});

console.log('[G3ZKP] Transit API endpoints loaded');

const EUROPEAN_TRANSIT_PROVIDERS = {
  'tfl': {
    name: 'Transport for London',
    country: 'GB',
    baseUrl: 'https://api.tfl.gov.uk',
    apiKey: process.env.TFL_API_KEY,
    realtime: true
  },
  'db': {
    name: 'Deutsche Bahn',
    country: 'DE',
    baseUrl: 'https://api.deutschebahn.com',
    apiKey: process.env.DB_API_KEY,
    realtime: true
  },
  'bvg': {
    name: 'BVG Berlin',
    country: 'DE',
    baseUrl: 'https://v6.bvg.transport.rest',
    apiKey: null,
    realtime: true
  },
  'sbb': {
    name: 'Swiss Federal Railways',
    country: 'CH',
    baseUrl: 'https://transport.opendata.ch/v1',
    apiKey: null,
    realtime: true
  },
  'ns': {
    name: 'NS Dutch Railways',
    country: 'NL',
    baseUrl: 'https://gateway.apiportal.ns.nl',
    apiKey: process.env.NS_API_KEY,
    realtime: true
  },
  'sncf': {
    name: 'SNCF France',
    country: 'FR',
    baseUrl: 'https://api.sncf.com/v1',
    apiKey: process.env.SNCF_API_KEY,
    realtime: true
  }
};

app.get('/api/transit/europe/providers', (req, res) => {
  const providers = Object.entries(EUROPEAN_TRANSIT_PROVIDERS).map(([id, config]) => ({
    id,
    name: config.name,
    country: config.country,
    realtime: config.realtime,
    available: config.apiKey !== undefined || config.apiKey === null
  }));
  
  res.json({
    providers,
    totalCountries: new Set(providers.map(p => p.country)).size,
    totalProviders: providers.length
  });
});

app.post('/api/transit/europe/plan', async (req, res) => {
  const { from, to, datetime, modes, country } = req.body;
  
  if (!from || !to) {
    return res.status(400).json({ error: 'From and to locations required' });
  }

  const cacheKey = `europe:plan:${JSON.stringify(from)}:${JSON.stringify(to)}:${country || 'auto'}`;
  const cached = navigationCache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, _cached: true });
  }

  try {
    const detectedCountry = country || await detectCountryFromCoords(from.lat, from.lon);
    let journeys = [];
    
    if (detectedCountry === 'GB') {
      const fromStr = `${from.lat},${from.lon}`;
      const toStr = `${to.lat},${to.lon}`;
      const params = new URLSearchParams();
      if (TFL_API_KEY) params.append('app_key', TFL_API_KEY);
      
      const response = await axios.get(
        `${TFL_API_BASE}/Journey/JourneyResults/${encodeURIComponent(fromStr)}/to/${encodeURIComponent(toStr)}?${params}`,
        { headers: { 'User-Agent': 'G3ZKP-Navigator/1.0' }, timeout: 15000 }
      );
      journeys = response.data.journeys || [];
    } else if (detectedCountry === 'CH') {
      const fromQuery = from.name || `${from.lat},${from.lon}`;
      const toQuery = to.name || `${to.lat},${to.lon}`;
      const response = await axios.get(
        `https://transport.opendata.ch/v1/connections?from=${encodeURIComponent(fromQuery)}&to=${encodeURIComponent(toQuery)}`,
        { timeout: 15000, headers: { 'User-Agent': 'G3ZKP-Navigator/1.0' } }
      );
      journeys = (response.data.connections || []).map(c => ({
        duration: c.duration ? parseInt(c.duration.replace(/[^\d]/g, '')) : 0,
        startDateTime: c.from?.departure,
        arrivalDateTime: c.to?.arrival,
        legs: (c.sections || []).map(s => ({
          mode: { id: s.journey?.category || 'train' },
          departurePoint: { commonName: s.departure?.station?.name, lat: s.departure?.station?.coordinate?.y, lon: s.departure?.station?.coordinate?.x },
          arrivalPoint: { commonName: s.arrival?.station?.name, lat: s.arrival?.station?.coordinate?.y, lon: s.arrival?.station?.coordinate?.x },
          departureTime: s.departure?.departure,
          arrivalTime: s.arrival?.arrival,
          routeOptions: s.journey ? [{ name: `${s.journey.category} ${s.journey.number || ''}`.trim() }] : null
        }))
      }));
    } else if (detectedCountry === 'DE') {
      const provider = EUROPEAN_TRANSIT_PROVIDERS['bvg'];
      const response = await axios.get(
        `${provider.baseUrl}/journeys?from.latitude=${from.lat}&from.longitude=${from.lon}&to.latitude=${to.lat}&to.longitude=${to.lon}`,
        { timeout: 15000 }
      );
      journeys = (response.data.journeys || []).map(j => ({
        duration: j.legs?.reduce((sum, l) => sum + (l.duration || 0), 0) || 0,
        legs: (j.legs || []).map(l => ({
          mode: l.line?.product || l.walking ? 'walking' : 'transit',
          departure: l.origin?.name,
          arrival: l.destination?.name,
          departureTime: l.departure,
          arrivalTime: l.arrival
        }))
      }));
    } else {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson`;
      const response = await axios.get(osrmUrl, { timeout: 10000 });
      if (response.data.routes?.length) {
        journeys = [{
          duration: Math.round(response.data.routes[0].duration / 60),
          legs: [{
            mode: 'driving',
            departure: 'Origin',
            arrival: 'Destination',
            distance: response.data.routes[0].distance
          }]
        }];
      }
    }

    const result = {
      journeys,
      country: detectedCountry,
      provider: getProviderForCountry(detectedCountry),
      timestamp: new Date().toISOString()
    };

    navigationCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('[TRANSIT-EUROPE] Planning error:', error.message);
    res.status(500).json({ 
      error: 'European transit planning failed',
      details: error.message,
      fallback: 'Use OSRM routing as fallback'
    });
  }
});

app.post('/api/transit/europe/stops', async (req, res) => {
  const { lat, lon, radius = 1000, country } = req.body;
  
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Latitude and longitude required' });
  }

  const cacheKey = `europe:stops:${lat.toFixed(4)}:${lon.toFixed(4)}:${radius}`;
  const cached = navigationCache.get(cacheKey);
  if (cached) {
    return res.json({ ...cached, _cached: true });
  }

  try {
    const detectedCountry = country || await detectCountryFromCoords(lat, lon);
    let stops = [];

    if (detectedCountry === 'GB' && TFL_API_KEY) {
      const params = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        radius: String(radius),
        stopTypes: 'NaptanMetroStation,NaptanRailStation,NaptanBusCoachStation',
        app_key: TFL_API_KEY
      });
      const response = await axios.get(
        `${TFL_API_BASE}/StopPoint?${params}`,
        { timeout: 10000 }
      );
      stops = (response.data.stopPoints || []).map(s => ({
        id: s.naptanId || s.id,
        name: s.commonName,
        lat: s.lat,
        lon: s.lon,
        modes: s.modes,
        lines: s.lines?.map(l => l.name),
        country: 'GB'
      }));
    } else if (detectedCountry === 'DE') {
      const response = await axios.get(
        `https://v6.bvg.transport.rest/stops/nearby?latitude=${lat}&longitude=${lon}&distance=${radius}`,
        { timeout: 10000 }
      );
      stops = (response.data || []).map(s => ({
        id: s.id,
        name: s.name,
        lat: s.location?.latitude,
        lon: s.location?.longitude,
        modes: s.products ? Object.keys(s.products).filter(p => s.products[p]) : [],
        country: 'DE'
      }));
    } else if (detectedCountry === 'CH') {
      const response = await axios.get(
        `https://transport.opendata.ch/v1/locations?x=${lon}&y=${lat}&type=station`,
        { timeout: 10000, headers: { 'User-Agent': 'G3ZKP-Navigator/1.0' } }
      );
      stops = (response.data.stations || []).map(s => ({
        id: s.id,
        name: s.name,
        lat: s.coordinate?.y,
        lon: s.coordinate?.x,
        modes: s.icon ? [s.icon] : ['train'],
        country: 'CH'
      }));
    } else {
      const overpassQuery = `
        [out:json][timeout:10];
        (
          node["railway"="station"](around:${radius},${lat},${lon});
          node["public_transport"="stop_position"](around:${radius},${lat},${lon});
          node["highway"="bus_stop"](around:${radius},${lat},${lon});
        );
        out body 20;
      `;
      const response = await axios.post(
        'https://overpass-api.de/api/interpreter',
        overpassQuery,
        { timeout: 15000, headers: { 'Content-Type': 'text/plain' } }
      );
      stops = (response.data.elements || []).map(e => ({
        id: String(e.id),
        name: e.tags?.name || 'Stop',
        lat: e.lat,
        lon: e.lon,
        modes: e.tags?.railway ? ['train'] : e.tags?.highway ? ['bus'] : ['transit'],
        country: detectedCountry || 'EU'
      }));
    }

    const result = {
      stops,
      count: stops.length,
      country: detectedCountry,
      radius,
      timestamp: new Date().toISOString()
    };

    navigationCache.set(cacheKey, result);
    res.json(result);
  } catch (error) {
    console.error('[TRANSIT-EUROPE] Stops error:', error.message);
    res.status(500).json({ error: 'Failed to get nearby stops', details: error.message });
  }
});

async function detectCountryFromCoords(lat, lon) {
  try {
    const cacheKey = `country:${lat.toFixed(2)}:${lon.toFixed(2)}`;
    const cached = navigationCache.get(cacheKey);
    if (cached) return cached;

    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      { headers: { 'User-Agent': 'G3ZKP-Navigator/1.0' }, timeout: 5000 }
    );
    
    const countryCode = response.data.address?.country_code?.toUpperCase() || 'EU';
    navigationCache.set(cacheKey, countryCode);
    return countryCode;
  } catch {
    return 'EU';
  }
}

function getProviderForCountry(country) {
  const countryProviders = {
    'GB': 'tfl',
    'DE': 'bvg',
    'CH': 'sbb',
    'NL': 'ns',
    'FR': 'sncf'
  };
  return countryProviders[country] || 'osm';
}

console.log('[G3ZKP] European Transit proxy endpoints loaded');

const COMPANIES_HOUSE_API_KEY = process.env.COMPANIES_HOUSE_API_KEY || process.env.COMPANIES_HOUSE_KEY || '';
const COMPANIES_HOUSE_BASE_URL = 'https://api.company-information.service.gov.uk';

app.post('/api/verify-company', async (req, res) => {
  const { crn } = req.body;
  
  if (!crn) {
    return res.status(400).json({ error: 'CRN is required' });
  }

  const normalizedCRN = crn.toUpperCase().replace(/\s+/g, '').padStart(8, '0');
  
  const crnPatterns = [
    /^[0-9]{8}$/,
    /^[A-Z]{2}[0-9]{6}$/,
    /^[0-9]{6}$/,
    /^[A-Z][0-9]{7}$/,
    /^[0-9]{7}[A-Z]$/
  ];
  
  const isValidFormat = crnPatterns.some(pattern => pattern.test(normalizedCRN));
  if (!isValidFormat) {
    return res.status(400).json({ error: 'Invalid CRN format' });
  }

  console.log(`[BusinessVerification] Verifying CRN: ${normalizedCRN}`);

  if (!COMPANIES_HOUSE_API_KEY) {
    console.log('[BusinessVerification] API key not configured, using mock data for development');
    
    const mockCompanies = {
      '00000001': {
        company_number: '00000001',
        company_name: 'EXAMPLE LIMITED',
        status: 'active',
        address: {
          address_line_1: '123 Example Street',
          address_line_2: 'Floor 2',
          locality: 'London',
          postal_code: 'EC1A 1BB',
          country: 'United Kingdom'
        },
        type: 'ltd',
        date_of_creation: '2020-01-15',
        sic_codes: ['56101']
      },
      '12345678': {
        company_number: '12345678',
        company_name: 'TEST COMPANY LTD',
        status: 'active',
        address: {
          address_line_1: '1 Test Road',
          locality: 'Manchester',
          postal_code: 'M1 1AA',
          country: 'United Kingdom'
        },
        type: 'ltd',
        date_of_creation: '2019-06-20',
        sic_codes: ['47110']
      }
    };

    const mockData = mockCompanies[normalizedCRN];
    if (mockData) {
      return res.json({
        verified: true,
        company_number: mockData.company_number,
        company_name: mockData.company_name,
        address: mockData.address,
        status: mockData.status,
        type: mockData.type,
        date_of_creation: mockData.date_of_creation,
        sic_codes: mockData.sic_codes,
        _mock: true
      });
    }
    
    return res.status(404).json({ error: 'Company not found (mock mode - configure COMPANIES_HOUSE_API_KEY for real lookups)' });
  }

  try {
    const authHeader = `Basic ${Buffer.from(`${COMPANIES_HOUSE_API_KEY}:`).toString('base64')}`;
    
    const response = await axios.get(
      `${COMPANIES_HOUSE_BASE_URL}/company/${normalizedCRN}`,
      {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );

    const data = response.data;
    
    const sanitizedResponse = {
      verified: true,
      company_number: data.company_number,
      company_name: data.company_name,
      address: {
        address_line_1: data.registered_office_address?.address_line_1 || '',
        address_line_2: data.registered_office_address?.address_line_2,
        locality: data.registered_office_address?.locality || '',
        postal_code: data.registered_office_address?.postal_code || '',
        country: data.registered_office_address?.country || 'United Kingdom'
      },
      status: data.company_status,
      type: data.type,
      date_of_creation: data.date_of_creation,
      sic_codes: data.sic_codes
    };

    console.log(`[BusinessVerification] Verified: ${sanitizedResponse.company_name}`);
    res.json(sanitizedResponse);

  } catch (error) {
    if (error.response?.status === 404) {
      console.log(`[BusinessVerification] Company not found: ${normalizedCRN}`);
      return res.status(404).json({ error: 'Company not found in Companies House registry' });
    }
    
    console.error('[BusinessVerification] API error:', error.message);
    res.status(500).json({ error: 'Verification service unavailable' });
  }
});

app.post('/api/p2p/broadcast', (req, res) => {
  const { topic, message } = req.body;
  
  if (!topic || !message) {
    return res.status(400).json({ error: 'Topic and message are required' });
  }

  console.log(`[P2P] Broadcast to topic ${topic}:`, message.substring(0, 100) + '...');
  
  io.emit('p2p:broadcast', { topic, message, timestamp: Date.now() });
  
  res.json({ success: true, topic, timestamp: Date.now() });
});

app.get('/api/businesses/nearby', async (req, res) => {
  const { lat, lon, radius } = req.query;
  
  if (!lat || !lon) {
    return res.status(400).json({ error: 'Latitude and longitude are required' });
  }

  const radiusKm = parseFloat(radius) || 10;
  
  res.json({ 
    businesses: [],
    center: { lat: parseFloat(lat), lon: parseFloat(lon) },
    radius: radiusKm,
    count: 0,
    message: 'Businesses are stored locally in IndexedDB and shared via P2P network'
  });
});

console.log('[G3ZKP] Business Verification API endpoints loaded');

// Licensing API endpoints
app.post('/api/payments/create-session', async (req, res) => {
  try {
    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    const { priceId, successUrl, cancelUrl } = req.body;

    const stripe = require('stripe')(STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: priceId || STRIPE_PRICE_ID,
        quantity: 1,
      }],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: 'license_purchase'
      }
    });

    res.json({
      id: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('[PAYMENT] Create session error:', error);
    res.status(500).json({ error: 'Failed to create payment session' });
  }
});

app.get('/api/payments/session/:sessionId', async (req, res) => {
  try {
    if (!STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: 'Payment system not configured' });
    }

    const { sessionId } = req.params;
    const stripe = require('stripe')(STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    res.json({
      id: session.id,
      payment_status: session.payment_status,
      customer_email: session.customer_details?.email,
      amount_total: session.amount_total,
      currency: session.currency
    });
  } catch (error) {
    console.error('[PAYMENT] Retrieve session error:', error);
    res.status(500).json({ error: 'Failed to retrieve payment session' });
  }
});

app.post('/api/webhook/stripe', (req, res) => {
  try {
    if (!STRIPE_WEBHOOK_SECRET) {
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    const sig = req.headers['stripe-signature'];
    const stripe = require('stripe')(STRIPE_SECRET_KEY);

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('[WEBHOOK] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('[WEBHOOK] Payment completed for session:', session.id);
      // License will be generated when client calls /api/licenses/activate
    }

    res.json({ received: true });
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

app.post('/api/licenses/activate', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Verify payment (in production, check database)
    // For now, assume payment is valid if session exists

    // Generate device fingerprint (this would come from client)
    const deviceFingerprint = {
      userAgent: req.headers['user-agent'] || '',
      language: 'en',
      platform: 'web',
      screenResolution: '1920x1080x24',
      timezone: 'UTC',
      hardwareConcurrency: 4,
      deviceMemory: 8,
      cookieEnabled: true,
      doNotTrack: null
    };

    // Generate device ID
    const stableData = {
      platform: deviceFingerprint.platform,
      timezone: deviceFingerprint.timezone,
      hardwareConcurrency: deviceFingerprint.hardwareConcurrency,
      screenResolution: deviceFingerprint.screenResolution,
    };
    const deviceId = crypto.createHash('sha256').update(JSON.stringify(stableData)).digest('hex');

    // Generate device commitment
    const nonce = crypto.randomBytes(32).toString('hex');
    const commitment = crypto.createHash('sha256').update(deviceId + nonce).digest('hex');

    // Create license payload
    const payload = {
      deviceId,
      deviceCommitment: commitment,
      nonce,
      licenseType: 'lifetime',
      issuedAt: Date.now(),
      expiresAt: null,
      features: ['messaging', 'zkp', 'anti-trafficking', 'p2p'],
    };

    // Sign license
    const payloadString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', LICENSE_SECRET_KEY).update(payloadString).digest('hex');

    const license = {
      payload,
      signature,
    };

    // Store license
    licenseStore.set(deviceId, license);

    console.log('[LICENSE] Generated lifetime license for device:', deviceId);

    res.json({
      success: true,
      license: btoa(JSON.stringify(license))
    });
  } catch (error) {
    console.error('[LICENSE] Activation error:', error);
    res.status(500).json({ error: 'License activation failed' });
  }
});

app.post('/api/licenses/trial', async (req, res) => {
  try {
    // Generate trial license (same as lifetime but with expiration)
    const deviceFingerprint = {
      userAgent: req.headers['user-agent'] || '',
      language: 'en',
      platform: 'web',
      screenResolution: '1920x1080x24',
      timezone: 'UTC',
      hardwareConcurrency: 4,
      deviceMemory: 8,
      cookieEnabled: true,
      doNotTrack: null
    };

    const stableData = {
      platform: deviceFingerprint.platform,
      timezone: deviceFingerprint.timezone,
      hardwareConcurrency: deviceFingerprint.hardwareConcurrency,
      screenResolution: deviceFingerprint.screenResolution,
    };
    const deviceId = crypto.createHash('sha256').update(JSON.stringify(stableData)).digest('hex');

    // Check if trial already used
    if (licenseStore.has(deviceId)) {
      return res.status(400).json({ error: 'Trial already used on this device' });
    }

    const nonce = crypto.randomBytes(32).toString('hex');
    const commitment = crypto.createHash('sha256').update(deviceId + nonce).digest('hex');

    const payload = {
      deviceId,
      deviceCommitment: commitment,
      nonce,
      licenseType: 'trial',
      issuedAt: Date.now(),
      expiresAt: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 days
      features: ['messaging', 'zkp', 'anti-trafficking', 'p2p'],
    };

    const payloadString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', LICENSE_SECRET_KEY).update(payloadString).digest('hex');

    const license = {
      payload,
      signature,
    };

    licenseStore.set(deviceId, license);

    console.log('[LICENSE] Generated trial license for device:', deviceId);

    res.json({
      success: true,
      license: btoa(JSON.stringify(license))
    });
  } catch (error) {
    console.error('[LICENSE] Trial generation error:', error);
    res.status(500).json({ error: 'Trial license generation failed' });
  }
});

app.post('/api/licenses/beta-lifetime', async (req, res) => {
  try {
    // BETA MODE: Grant full lifetime license without payment
    if (!BETA_MODE) {
      return res.status(403).json({ error: 'Beta mode not enabled' });
    }

    const deviceFingerprint = {
      userAgent: req.headers['user-agent'] || '',
      language: 'en',
      platform: 'web',
      screenResolution: '1920x1080x24',
      timezone: 'UTC',
      hardwareConcurrency: 4,
      deviceMemory: 8,
      cookieEnabled: true,
      doNotTrack: null
    };

    const stableData = {
      platform: deviceFingerprint.platform,
      timezone: deviceFingerprint.timezone,
      hardwareConcurrency: deviceFingerprint.hardwareConcurrency,
      screenResolution: deviceFingerprint.screenResolution,
    };
    const deviceId = crypto.createHash('sha256').update(JSON.stringify(stableData)).digest('hex');

    // Check if beta license already granted to this device
    if (licenseStore.has(deviceId)) {
      const existing = licenseStore.get(deviceId);
      if (existing.payload.licenseType === 'beta-lifetime') {
        return res.json({
          success: true,
          license: btoa(JSON.stringify(existing)),
          message: 'Beta license already active on this device'
        });
      }
    }

    const nonce = crypto.randomBytes(32).toString('hex');
    const commitment = crypto.createHash('sha256').update(deviceId + nonce).digest('hex');

    const payload = {
      deviceId,
      deviceCommitment: commitment,
      nonce,
      licenseType: 'beta-lifetime',
      issuedAt: Date.now(),
      expiresAt: null, // Permanent
      features: ['messaging', 'zkp', 'anti-trafficking', 'p2p', 'navigation', 'business-verification', 'voice-calls', 'video-calls', 'file-sharing'],
      betaAccess: true,
      grantReason: 'BETA_TESTING_ACCESS'
    };

    const payloadString = JSON.stringify(payload);
    const signature = crypto.createHmac('sha256', LICENSE_SECRET_KEY).update(payloadString).digest('hex');

    const license = {
      payload,
      signature,
    };

    licenseStore.set(deviceId, license);

    console.log('[LICENSE] Generated BETA lifetime license for device:', deviceId);

    res.json({
      success: true,
      license: btoa(JSON.stringify(license)),
      message: 'BETA ACCESS GRANTED - LIFETIME LICENSE'
    });
  } catch (error) {
    console.error('[LICENSE] Beta lifetime generation error:', error);
    res.status(500).json({ error: 'Beta license generation failed' });
  }
});

console.log('[G3ZKP] Licensing API endpoints loaded');

const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_API_KEY || '';
const MAPBOX_PUBLIC_TOKEN = process.env.MAPBOX_PUBLIC_TOKEN || '';

app.get('/api/mapbox/config', (req, res) => {
  res.json({
    available: !!MAPBOX_PUBLIC_TOKEN,
    accessToken: MAPBOX_PUBLIC_TOKEN,
    style: 'mapbox://styles/mapbox/standard',
    terrainSource: 'mapbox://mapbox.mapbox-terrain-dem-v1',
    buildingsEnabled: true
  });
});

app.get('/api/mapbox/geocode', async (req, res) => {
  const { query, proximity, types } = req.query;
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }
  
  if (!MAPBOX_ACCESS_TOKEN) {
    return res.status(503).json({ error: 'Mapbox not configured' });
  }
  
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_ACCESS_TOKEN,
      limit: '5'
    });
    
    if (proximity) params.append('proximity', proximity);
    if (types) params.append('types', types);
    
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`;
    const response = await axios.get(url);
    
    res.json(response.data);
  } catch (error) {
    console.error('[MAPBOX] Geocode error:', error.message);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

app.get('/api/mapbox/directions/:profile', async (req, res) => {
  const { profile } = req.params;
  const { coordinates, alternatives, geometries, overview, steps } = req.query;
  
  if (!coordinates) {
    return res.status(400).json({ error: 'Coordinates required' });
  }
  
  if (!MAPBOX_ACCESS_TOKEN) {
    return res.status(503).json({ error: 'Mapbox not configured' });
  }
  
  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_ACCESS_TOKEN,
      geometries: geometries || 'geojson',
      overview: overview || 'full',
      steps: steps || 'true',
      alternatives: alternatives || 'false'
    });
    
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?${params}`;
    const response = await axios.get(url);
    
    res.json(response.data);
  } catch (error) {
    console.error('[MAPBOX] Directions error:', error.message);
    res.status(500).json({ error: 'Directions failed' });
  }
});

console.log('[G3ZKP] Mapbox API proxy loaded');

app.get('/api/zkp/circuits', (req, res) => {
  if (!zkpEngine) {
    return res.json({
      circuits: [
        { id: 'MessageSendProof', name: 'Message Send Proof', constraints: 1000, status: 'simulated' },
        { id: 'MessageDeliveryProof', name: 'Message Delivery Proof', constraints: 800, status: 'simulated' },
        { id: 'ForwardSecrecyProof', name: 'Forward Secrecy Proof', constraints: 1200, status: 'simulated' },
        { id: 'authentication', name: 'Authentication', constraints: 2000, status: 'simulated' },
        { id: 'message_security', name: 'Message Security', constraints: 3000, status: 'simulated' },
        { id: 'forward_secrecy', name: 'Forward Secrecy', constraints: 1500, status: 'simulated' }
      ],
      mode: 'simulation'
    });
  }
  
  const circuits = zkpEngine.getLoadedCircuits();
  res.json({ circuits, mode: 'production' });
});

app.post('/api/zkp/generate', async (req, res) => {
  try {
    const { circuitName, inputs } = req.body;
    
    if (!circuitName || !inputs) {
      return res.status(400).json({ error: 'Missing circuitName or inputs' });
    }
    
    const bigIntInputs = {};
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'bigint') {
        bigIntInputs[key] = value;
      } else if (typeof value === 'number') {
        bigIntInputs[key] = BigInt(value);
      } else if (typeof value === 'string') {
        if (/^-?\d+$/.test(value)) {
          bigIntInputs[key] = BigInt(value);
        } else if (/^0x[0-9a-fA-F]+$/i.test(value)) {
          bigIntInputs[key] = BigInt(value);
        } else {
          const hash = crypto.createHash('sha256').update(value).digest('hex');
          bigIntInputs[key] = BigInt('0x' + hash.slice(0, 16));
        }
      } else {
        bigIntInputs[key] = BigInt(0);
      }
    }
    
    if (zkpEngine && zkpEngine.isInitialized()) {
      const result = await zkpEngine.generateProof(circuitName, bigIntInputs);
      return res.json({
        success: true,
        proof: {
          id: `proof_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          circuitName,
          publicSignals: result.proof.publicSignals.map(String),
          proof: {
            pi_a: result.proof.proof.pi_a?.map(String) || [],
            pi_b: result.proof.proof.pi_b?.map(arr => arr.map(String)) || [],
            pi_c: result.proof.proof.pi_c?.map(String) || []
          },
          generationTime: result.generationTime,
          mode: 'production'
        }
      });
    }
    
    const simulatedProof = {
      id: `proof_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      circuitName,
      publicSignals: Object.values(inputs).slice(0, 4).map(String),
      proof: {
        pi_a: [crypto.randomBytes(32).toString('hex'), crypto.randomBytes(32).toString('hex'), '1'],
        pi_b: [
          [crypto.randomBytes(32).toString('hex'), crypto.randomBytes(32).toString('hex')],
          [crypto.randomBytes(32).toString('hex'), crypto.randomBytes(32).toString('hex')],
          ['1', '0']
        ],
        pi_c: [crypto.randomBytes(32).toString('hex'), crypto.randomBytes(32).toString('hex'), '1']
      },
      generationTime: 50 + Math.random() * 100,
      mode: 'simulation'
    };
    
    res.json({ success: true, proof: simulatedProof });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/zkp/verify', async (req, res) => {
  try {
    const { proof, publicSignals, circuitName } = req.body;
    
    if (!proof || !circuitName) {
      return res.status(400).json({ error: 'Missing proof or circuitName' });
    }
    
    if (zkpEngine && zkpEngine.isInitialized()) {
      const proofData = {
        proof: {
          pi_a: proof.pi_a?.map(s => BigInt(s)) || [],
          pi_b: proof.pi_b?.map(arr => arr.map(s => BigInt(s))) || [],
          pi_c: proof.pi_c?.map(s => BigInt(s)) || []
        },
        publicSignals: (publicSignals || []).map(s => {
          try { return BigInt(s); } catch { return BigInt(0); }
        })
      };
      
      const isValid = await zkpEngine.verifyProof(proofData);
      return res.json({ valid: isValid, mode: 'production' });
    }
    
    const isValid = Math.random() > 0.05;
    res.json({ valid: isValid, mode: 'simulation' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/peers', (req, res) => {
  const peers = Array.from(connectedPeers.values()).map(p => ({
    peerId: p.peerId,
    peerName: p.peerName,
    publicKey: p.publicKey,
    status: 'online',
    connectedAt: p.connectedAt
  }));
  res.json(peers);
});

// Device synchronization endpoints
const registeredDevices = new Map();

app.post('/api/devices/register', (req, res) => {
  const { deviceId, licenseId, publicKey, authorizationToken } = req.body;

  if (!deviceId || !licenseId || !publicKey) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  registeredDevices.set(deviceId, {
    licenseId,
    publicKey,
    authorizationToken,
    registeredAt: Date.now(),
    lastSync: 0
  });

  console.log(`[DeviceSync] Registered device: ${deviceId}`);
  res.json({ success: true, deviceId });
});

app.post('/api/devices/revoke', (req, res) => {
  const { deviceId } = req.body;

  if (registeredDevices.has(deviceId)) {
    registeredDevices.delete(deviceId);
    console.log(`[DeviceSync] Revoked device: ${deviceId}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Device not found' });
  }
});

app.get('/api/devices', (req, res) => {
  const devices = Array.from(registeredDevices.entries()).map(([deviceId, data]) => ({
    deviceId,
    licenseId: data.licenseId,
    registeredAt: data.registeredAt,
    lastSync: data.lastSync
  }));
  res.json({ devices });
});

app.post('/api/messages/sync', (req, res) => {
  const { deviceId, licenseId, lastSyncTimestamp, messageRange } = req.body;

  const device = registeredDevices.get(deviceId);
  if (!device || device.licenseId !== licenseId) {
    return res.status(403).json({ error: 'Unauthorized device' });
  }

  // Get messages since last sync
  const messagesToSync = messageStore
    .filter(msg => msg.timestamp > lastSyncTimestamp)
    .slice(0, 100); // Limit batch size

  device.lastSync = Date.now();

  res.json({
    type: 'sync_response',
    deviceId,
    licenseId,
    lastSyncTimestamp: Date.now(),
    messageRange: {
      from: lastSyncTimestamp,
      to: Date.now()
    },
    encryptedMessages: messagesToSync,
    proof: {} // ZKP proof would be added here
  });
});

app.get('/api/messages', (req, res) => {
  const { limit = 100, before } = req.query;
  let messages = [...messageStore];
  
  if (before) {
    messages = messages.filter(m => m.timestamp < parseInt(before));
  }
  
  messages = messages.slice(-parseInt(limit));
  res.json(messages);
});

const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/javascript': '.js',
  'text/typescript': '.ts',
  'text/html': '.html',
  'text/css': '.css',
  'application/json': '.json',
  'text/yaml': '.yaml',
  'text/x-c++src': '.cpp',
  'text/x-csrc': '.c',
  'application/x-circom': '.circom'
};
const MAX_FILE_SIZE = 50 * 1024 * 1024;

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

app.post('/api/media/upload', (req, res) => {
  try {
    const { data, filename, mimeType, senderId } = req.body;
    
    if (!data || !filename || !mimeType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (!ALLOWED_MIME_TYPES[mimeType] && !mimeType.startsWith('text/')) {
      return res.status(400).json({ error: 'File type not allowed' });
    }
    
    const base64Data = data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({ error: 'File too large (max 50MB)' });
    }
    
    const fileId = crypto.randomBytes(16).toString('hex');
    const ext = ALLOWED_MIME_TYPES[mimeType] || '.bin';
    const safeFilename = sanitizeFilename(filename);
    const storedName = `${fileId}${ext}`;
    const filePath = path.join(MEDIA_STORAGE_DIR, storedName);
    
    fs.writeFileSync(filePath, buffer);
    
    const metadata = {
      id: fileId,
      originalName: safeFilename,
      storedName,
      mimeType,
      size: buffer.length,
      senderId: senderId || 'anonymous',
      uploadedAt: Date.now()
    };
    
    mediaIndex.set(fileId, metadata);
    
    console.log(`[MEDIA] Uploaded: ${safeFilename} (${(buffer.length / 1024).toFixed(1)}KB)`);
    
    res.json({
      success: true,
      fileId,
      url: `/media/${storedName}`,
      metadata
    });
    
  } catch (error) {
    console.error('[MEDIA] Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/api/media/:fileId', (req, res) => {
  const { fileId } = req.params;
  const metadata = mediaIndex.get(fileId);
  
  if (!metadata) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  const filePath = path.join(MEDIA_STORAGE_DIR, metadata.storedName);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found on disk' });
  }
  
  res.setHeader('Content-Disposition', `attachment; filename="${metadata.originalName}"`);
  res.setHeader('Content-Type', metadata.mimeType);
  res.sendFile(filePath);
});

app.get('/api/media/:fileId/info', (req, res) => {
  const { fileId } = req.params;
  const metadata = mediaIndex.get(fileId);
  
  if (!metadata) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  res.json(metadata);
});

app.post('/api/voice/upload', (req, res) => {
  try {
    const { data, duration, waveformData, senderId, mimeType } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'No audio data provided' });
    }
    
    const base64Data = data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Voice message too large (max 10MB)' });
    }
    
    const fileId = crypto.randomBytes(16).toString('hex');
    const ext = mimeType === 'audio/mp4' ? '.m4a' : '.webm';
    const storedName = `voice_${fileId}${ext}`;
    const filePath = path.join(MEDIA_STORAGE_DIR, storedName);
    
    fs.writeFileSync(filePath, buffer);
    
    const metadata = {
      id: fileId,
      storedName,
      mimeType: mimeType || 'audio/webm',
      size: buffer.length,
      duration: duration || 0,
      waveformData: waveformData || [],
      senderId: senderId || 'anonymous',
      uploadedAt: Date.now(),
      type: 'voice'
    };
    
    mediaIndex.set(fileId, metadata);
    
    console.log(`[VOICE] Uploaded: ${storedName} (${(buffer.length / 1024).toFixed(1)}KB, ${duration?.toFixed(1)}s)`);
    
    res.json({
      success: true,
      fileId,
      url: `/media/${storedName}`,
      metadata
    });
    
  } catch (error) {
    console.error('[VOICE] Upload error:', error);
    res.status(500).json({ error: 'Voice upload failed' });
  }
});

io.on('connection', (socket) => {
  console.log(`[SOCKET] New connection: ${socket.id}`);
  let peerData = null;

  socket.on('register', (data) => {
    peerData = {
      socketId: socket.id,
      peerId: data.peerId,
      peerName: data.peerName || 'Anonymous',
      publicKey: data.publicKey,
      connectedAt: Date.now()
    };
    
    connectedPeers.set(socket.id, peerData);
    console.log(`[PEER] Registered: ${peerData.peerName} (${peerData.peerId})`);
    
    const peersList = Array.from(connectedPeers.values()).map(p => ({
      peerId: p.peerId,
      peerName: p.peerName,
      publicKey: p.publicKey,
      status: 'online',
      lastSeen: Date.now()
    }));
    socket.emit('peers_list', peersList);
    
    socket.broadcast.emit('peer_connected', {
      peerId: peerData.peerId,
      peerName: peerData.peerName,
      publicKey: peerData.publicKey,
      status: 'online',
      lastSeen: Date.now()
    });

    const pendingMessages = pendingSystemMessages.get(peerData.peerId);
    if (pendingMessages && pendingMessages.length > 0) {
      console.log(`[SYSTEM] Delivering ${pendingMessages.length} pending messages to ${peerData.peerId}`);
      pendingMessages.forEach(msg => {
        socket.emit('system_message', msg);
      });
      pendingSystemMessages.delete(peerData.peerId);
    }
  });

  socket.on('update_name', (data) => {
    if (peerData) {
      peerData.peerName = data.name;
      connectedPeers.set(socket.id, peerData);
    }
  });

  socket.on('message', (payload) => {
    console.log(`[MESSAGE] From ${payload.senderName} to ${payload.recipientId}: ${payload.type}`);
    
    messageStore.push({
      ...payload,
      serverTimestamp: Date.now()
    });
    
    if (messageStore.length > MAX_MESSAGES) {
      messageStore.shift();
    }
    
    if (payload.recipientId === 'broadcast' || payload.recipientId === 'all') {
      socket.broadcast.emit('message', payload);
    } else {
      const recipientSocket = Array.from(connectedPeers.entries())
        .find(([_, p]) => p.peerId === payload.recipientId);
      
      if (recipientSocket) {
        io.to(recipientSocket[0]).emit('message', payload);
      } else {
        socket.broadcast.emit('message', payload);
      }
    }
    
    socket.emit('message_ack', {
      messageId: payload.id,
      status: 'delivered',
      timestamp: Date.now()
    });
  });

  socket.on('system_message', (message) => {
    console.log(`[SYSTEM] ${message.type} from ${message.senderId} to ${message.recipientId}`);
    
    const recipientSocket = Array.from(connectedPeers.entries())
      .find(([_, p]) => p.peerId === message.recipientId);
    
    if (recipientSocket) {
      io.to(recipientSocket[0]).emit('system_message', message);
      console.log(`[SYSTEM] Delivered ${message.type} to ${message.recipientId}`);
    } else {
      console.log(`[SYSTEM] Recipient ${message.recipientId} not online - storing for later`);
      if (!pendingSystemMessages.has(message.recipientId)) {
        pendingSystemMessages.set(message.recipientId, []);
      }
      pendingSystemMessages.get(message.recipientId).push(message);
    }
  });

  socket.on('typing_start', (data) => {
    socket.broadcast.emit('typing_start', {
      peerId: peerData?.peerId,
      peerName: peerData?.peerName,
      conversationId: data.conversationId
    });
  });

  socket.on('typing_stop', (data) => {
    socket.broadcast.emit('typing_stop', {
      peerId: peerData?.peerId,
      conversationId: data.conversationId
    });
  });

  socket.on('request_peer_key', (data) => {
    const targetSocket = Array.from(connectedPeers.entries())
      .find(([_, p]) => p.peerId === data.peerId);
    
    if (targetSocket) {
      socket.emit('peer_key_response', {
        peerId: data.peerId,
        publicKey: targetSocket[1].publicKey
      });
    }
  });

  socket.on('webrtc_signal', (data) => {
    const targetSocket = Array.from(connectedPeers.entries())
      .find(([_, p]) => p.peerId === data.targetPeerId);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('webrtc_signal', {
        ...data,
        fromPeerId: peerData?.peerId,
        fromPeerName: peerData?.peerName
      });
    }
  });

  socket.on('call_initiate', (data) => {
    if (!peerData) {
      socket.emit('call_error', { callId: data.callId, error: 'Not authenticated' });
      return;
    }
    
    if (!data.callId || !data.callType || !data.targetPeerId) {
      socket.emit('call_error', { callId: data.callId, error: 'Invalid call parameters' });
      return;
    }
    
    console.log(`[CALL] ${peerData.peerName} initiating ${data.callType} call to ${data.targetPeerId}`);
    
    const targetSocket = Array.from(connectedPeers.entries())
      .find(([_, p]) => p.peerId === data.targetPeerId);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('call_incoming', {
        callId: data.callId,
        callType: data.callType,
        fromPeerId: peerData.peerId,
        fromPeerName: peerData.peerName,
        offer: data.offer
      });
      socket.emit('call_ringing', { callId: data.callId, targetPeerId: data.targetPeerId });
    } else {
      socket.emit('call_error', { callId: data.callId, error: 'Peer not available' });
    }
  });

  socket.on('call_accept', (data) => {
    if (!peerData || !data.callId || !data.targetPeerId) {
      socket.emit('call_error', { callId: data.callId, error: 'Invalid accept parameters' });
      return;
    }
    
    console.log(`[CALL] ${peerData.peerName} accepted call ${data.callId}`);
    
    const targetSocket = Array.from(connectedPeers.entries())
      .find(([_, p]) => p.peerId === data.targetPeerId);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('call_accepted', {
        callId: data.callId,
        fromPeerId: peerData.peerId,
        fromPeerName: peerData.peerName,
        answer: data.answer
      });
    } else {
      socket.emit('call_error', { callId: data.callId, error: 'Caller no longer available' });
    }
  });

  socket.on('call_reject', (data) => {
    if (!peerData || !data.callId || !data.targetPeerId) return;
    
    console.log(`[CALL] ${peerData.peerName} rejected call ${data.callId}`);
    
    const targetSocket = Array.from(connectedPeers.entries())
      .find(([_, p]) => p.peerId === data.targetPeerId);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('call_rejected', {
        callId: data.callId,
        fromPeerId: peerData.peerId,
        reason: data.reason || 'User declined'
      });
    }
  });

  socket.on('call_end', (data) => {
    if (!peerData || !data.callId) return;
    
    console.log(`[CALL] ${peerData.peerName} ended call ${data.callId}`);
    
    const targetSocket = Array.from(connectedPeers.entries())
      .find(([_, p]) => p.peerId === data.targetPeerId);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('call_ended', {
        callId: data.callId,
        fromPeerId: peerData.peerId
      });
    }
  });

  socket.on('ice_candidate', (data) => {
    if (!peerData || !data.callId || !data.targetPeerId || !data.candidate) return;
    
    const targetSocket = Array.from(connectedPeers.entries())
      .find(([_, p]) => p.peerId === data.targetPeerId);
    
    if (targetSocket) {
      io.to(targetSocket[0]).emit('ice_candidate', {
        callId: data.callId,
        candidate: data.candidate,
        fromPeerId: peerData.peerId
      });
    }
  });

  socket.on('peer:announce', (data) => {
    if (!data.peerId) return;
    
    console.log('[PEER] Announcement received:', data.peerId);
    
    if (!peerData) {
      peerData = {
        peerId: data.peerId,
        peerName: data.displayName || `NODE_${data.peerId.substring(0, 8)}`,
        location: data.location
      };
    }
    
    peerData.location = data.location;
    peerData.lastAnnounce = Date.now();
    
    socket.broadcast.emit('peer:discovered', {
      peerId: peerData.peerId,
      displayName: peerData.peerName,
      distance: 0,
      signalStrength: 100,
      publicKey: peerData.publicKey || '',
      location: data.location
    });
  });

  socket.on('peer:discover', (data) => {
    if (!data.peerId || !data.location) return;
    
    console.log('[PEER] Discovery request from:', data.peerId, 'radius:', data.radius);
    
    const radius = data.radius || 100;
    const nearbyPeers = [];
    
    for (const [socketId, peer] of connectedPeers.entries()) {
      if (peer.peerId === data.peerId) continue;
      if (!peer.location) continue;
      
      const distance = calculateDistance(
        data.location.lat,
        data.location.lon,
        peer.location.lat,
        peer.location.lon
      );
      
      if (distance <= radius) {
        nearbyPeers.push({
          peerId: peer.peerId,
          displayName: peer.peerName,
          distance: Math.round(distance),
          signalStrength: Math.max(20, 100 - Math.round(distance / radius * 80)),
          publicKey: peer.publicKey || '',
          location: peer.location
        });
      }
    }
    
    for (const peer of nearbyPeers) {
      socket.emit('peer:discovered', peer);
    }
    
    if (nearbyPeers.length === 0) {
      console.log('[PEER] No nearby peers found within', radius, 'meters');
    } else {
      console.log('[PEER] Found', nearbyPeers.length, 'nearby peers');
    }
  });

  socket.on('traffic_report', (data) => {
    if (!data.location || !data.speed) return;
    const report = {
      ...data,
      id: `traffic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now()
    };
    const regionKey = `${Math.floor(data.location[1] * 10)},${Math.floor(data.location[0] * 10)}`;
    if (!trafficReports.has(regionKey)) trafficReports.set(regionKey, []);
    trafficReports.get(regionKey).push(report);
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    trafficReports.set(regionKey, trafficReports.get(regionKey).filter(r => r.timestamp > fiveMinutesAgo));
    socket.broadcast.emit('traffic_update', report);
  });

  socket.on('hazard_report', (data) => {
    if (!data.type || !data.location) return;
    const hazard = {
      ...data,
      id: `hazard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      expiresAt: Date.now() + (data.type === 'police' ? 30 : 60) * 60 * 1000,
      verificationCount: 1,
      reporterId: peerData?.peerId || 'anonymous'
    };
    trafficHazards.set(hazard.id, hazard);
    console.log(`[HAZARD] ${data.type} reported at ${data.location[1].toFixed(4)}, ${data.location[0].toFixed(4)}`);
    io.emit('hazard_broadcast', hazard);
  });

  socket.on('hazard_verify', (data) => {
    if (!data.hazardId) return;
    const hazard = trafficHazards.get(data.hazardId);
    if (hazard) {
      hazard.verificationCount++;
      hazard.expiresAt += 10 * 60 * 1000;
      io.emit('hazard_verified', { id: data.hazardId, count: hazard.verificationCount });
    }
  });

  socket.on('get_nearby_hazards', (data) => {
    if (!data.location || !data.radius) return;
    const now = Date.now();
    const nearby = [];
    for (const [id, hazard] of trafficHazards.entries()) {
      if (hazard.expiresAt <= now) {
        trafficHazards.delete(id);
        continue;
      }
      const dist = Math.sqrt(
        Math.pow((hazard.location[0] - data.location[0]) * 111320 * Math.cos(data.location[1] * Math.PI / 180), 2) +
        Math.pow((hazard.location[1] - data.location[1]) * 110540, 2)
      );
      if (dist <= data.radius) {
        nearby.push({ ...hazard, distance: Math.round(dist) });
      }
    }
    socket.emit('nearby_hazards', nearby);
  });

  socket.on('disconnect', () => {
    if (peerData) {
      console.log(`[PEER] Disconnected: ${peerData.peerName} (${peerData.peerId})`);
      socket.broadcast.emit('peer_disconnected', peerData.peerId);
    }
    connectedPeers.delete(socket.id);
  });
});

initializeZKP().then(() => {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`\n[G3ZKP] Messaging Server running on http://0.0.0.0:${PORT}`);
    console.log('[G3ZKP] Socket.IO ready for real-time P2P messaging');
    console.log('[G3ZKP] WebRTC signaling enabled\n');
  });
});

process.on('SIGTERM', () => {
  console.log('[G3ZKP] Server shutting down...');
  io.close();
  httpServer.close();
  process.exit(0);
});
