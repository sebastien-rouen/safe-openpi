#!/usr/bin/env node
// ============================================================
// generate-env.js — Génère assets/js/env.js depuis .env
//
// Usage :
//   node scripts/generate-env.js
//
// Prérequis : copier .env.example en .env et renseigner les valeurs.
// Le fichier assets/js/env.js est gitignore (comme .env).
// ============================================================

const fs   = require('fs');
const path = require('path');

const root    = path.join(__dirname, '..');
const envFile = path.join(root, '.env');
const outFile = path.join(root, 'assets', 'js', 'env.js');

if (!fs.existsSync(envFile)) {
  console.error('❌  Fichier .env introuvable. Copier .env.example en .env et renseigner les valeurs.');
  process.exit(1);
}

// Parse .env (ignore commentaires et lignes vides)
const env = {};
fs.readFileSync(envFile, 'utf8').split('\n').forEach(line => {
  const clean = line.trim();
  if (!clean || clean.startsWith('#')) return;
  const idx = clean.indexOf('=');
  if (idx === -1) return;
  const key = clean.slice(0, idx).trim();
  const val = clean.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
  env[key] = val;
});

const output = `// ============================================================
// env.js — Généré automatiquement par scripts/generate-env.js
// NE PAS COMMITTER CE FICHIER (contient des informations sensibles).
// ============================================================

window.ENV = ${JSON.stringify(env, null, 2)};
`;

fs.writeFileSync(outFile, output, 'utf8');
console.log(`✅  assets/js/env.js généré depuis .env`);
