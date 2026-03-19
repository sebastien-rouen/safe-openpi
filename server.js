#!/usr/bin/env node
// ============================================================
// server.js - Serveur local JIRA Dashboard (port 3001)
//
// Rôles :
//   1. Serveur de fichiers statiques (HTML/CSS/JS)
//   2. Proxy JIRA   : GET  /jira/*          → JIRA_URL/rest/* (Basic auth)
//   3. Cache data   : GET  /data/*.json     → sert les fichiers data/
//                     POST /data/*.json     → écrit dans data/ (cache du browser)
//
// Usage :
//   npm install        (première fois)
//   npm start          (lance le serveur)
//   Ouvrir http://localhost:3001
//
// Sans sync JIRA : tout serveur HTTP statique suffit (Live Server, etc.)
// ============================================================

const express = require('express');
const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');

const PORT     = 3001;
const ROOT     = __dirname;
const DATA_DIR = path.join(ROOT, 'data');

// ---------------------------------------------------------------------------
// Lecture de .env
// ---------------------------------------------------------------------------

function loadEnv() {
  const file = path.join(ROOT, '.env');
  const env  = {};
  if (!fs.existsSync(file)) return env;
  fs.readFileSync(file, 'utf8').split('\n').forEach(line => {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) return;
    const idx = clean.indexOf('=');
    if (idx < 0) return;
    env[clean.slice(0, idx).trim()] = clean.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  });
  return env;
}

const env        = loadEnv();
const JIRA_URL   = (env.JIRA_URL   || '').replace(/\/$/, '');
const JIRA_USER  = env.JIRA_USER   || '';
const JIRA_TOKEN = env.JIRA_TOKEN  || '';
const JIRA_AUTH  = JIRA_USER && JIRA_TOKEN
  ? 'Basic ' + Buffer.from(`${JIRA_USER}:${JIRA_TOKEN}`).toString('base64')
  : '';
// ---------------------------------------------------------------------------
// Proxy HTTP/HTTPS générique
// ---------------------------------------------------------------------------

function proxyRequest(targetUrl, options, bodyBuffer) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(targetUrl);
    const isHttps = parsed.protocol === 'https:';
    const lib     = isHttps ? https : http;
    const reqOpts = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   options.method || 'GET',
      headers:  options.headers || {},
    };
    const proxyReq = lib.request(reqOpts, proxyRes => {
      const chunks = [];
      proxyRes.on('data', c => chunks.push(c));
      proxyRes.on('end', () => resolve({ status: proxyRes.statusCode, body: Buffer.concat(chunks) }));
    });
    proxyReq.on('error', reject);
    if (bodyBuffer) proxyReq.write(bodyBuffer);
    proxyReq.end();
  });
}

// ---------------------------------------------------------------------------
// App Express
// ---------------------------------------------------------------------------

const app = express();

// CORS
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin',  '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Body brut (pour POST proxy / cache)
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// ---- GET /jira/* → proxy JIRA ----------------------------------------

app.get('/jira/*', async (req, res) => {
  if (!JIRA_URL)  return res.status(503).json({ error: 'JIRA_URL non configuré' });
  if (!JIRA_AUTH) return res.status(503).json({ error: 'JIRA_USER / JIRA_TOKEN non configurés' });

  const target = JIRA_URL + '/rest' + req.path.slice(5) + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');
  console.log(`[JIRA]  GET ${target}`);
  try {
    const { status, body } = await proxyRequest(target, {
      headers: { Authorization: JIRA_AUTH, Accept: 'application/json' },
    });
    res.status(status).type('json').send(body);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ---- GET /data/*.json → servir le cache --------------------------------

app.get('/data/:file', (req, res) => {
  const file = req.params.file;
  if (!file.endsWith('.json')) return res.status(400).json({ error: 'Fichier .json uniquement' });
  const fp = path.join(DATA_DIR, path.basename(file));
  if (!fs.existsSync(fp)) return res.status(404).json({ error: 'Cache introuvable' });
  res.type('json').sendFile(fp);
});

// ---- POST /data/*.json → écrire le cache --------------------------------

app.post('/data/:file', (req, res) => {
  const file = req.params.file;
  if (!/^[\w\-]+\.json$/.test(file)) return res.status(400).json({ error: 'Nom de fichier invalide' });
  const body = req.body instanceof Buffer ? req.body : Buffer.from(JSON.stringify(req.body));
  try { JSON.parse(body); } catch { return res.status(400).json({ error: 'JSON invalide' }); }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, file), body);
  console.log(`[Cache] Sauvegardé → ${file} (${body.length} octets)`);
  res.json({ ok: true, file });
});

// ---- Fichiers statiques (dernier, catch-all) ----------------------------

app.use(express.static(ROOT));
app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'index.html')));

// ---------------------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------------------

function mask(s) { return s ? (s.slice(0, 4) + '••••' + s.slice(-4)) : '(non configuré)'; }

app.listen(PORT, () => {
  const cached = fs.existsSync(DATA_DIR) ? fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).length : 0;
  console.log(`\n  JIRA Dashboard - http://localhost:${PORT}`);
  console.log(`  JIRA  : ${JIRA_URL || '(non configuré)'}  |  user: ${JIRA_USER || '-'}  |  token: ${mask(JIRA_TOKEN)}`);
  console.log(`  Cache : ${cached} fichier(s) dans data/\n`);
});
