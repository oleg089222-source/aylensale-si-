#!/usr/bin/env node
/**
 * Upload install-app-icon (or BRAND_SOURCE) to Firebase branding → live PWA home-screen icons.
 * Requires FIREBASE_SERVICE_ACCOUNT in env (or .env.local from vercel env pull).
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { generateIconSet } from '../lib/server/branding-icons.mjs';
import { loadBrandingDoc, uploadBrandingBuffers } from '../lib/server/branding-store.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env.local');

function loadEnvFile() {
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key] && val) process.env[key] = val;
  }
}

loadEnvFile();
const source = process.env.BRAND_SOURCE || join(root, 'install-app-icon.jpeg');

if (!existsSync(source)) {
  console.error('Source image not found:', source);
  process.exit(1);
}

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.error('FIREBASE_SERVICE_ACCOUNT is not set. Run: vercel env pull .env.local');
  process.exit(1);
}

const buf = readFileSync(source);
const buffers = await generateIconSet(buf);
const existing = await loadBrandingDoc();
const nextVersion = Number((existing && existing.cacheVersion) || 0) + 1;

const saved = await uploadBrandingBuffers(buffers, {
  cacheVersion: nextVersion,
  themeColor: (existing && existing.themeColor) || '#070a14',
  backgroundColor: (existing && existing.backgroundColor) || '#070a14',
  updatedBy: 'push-pwa-branding'
});

console.log('PWA branding saved → v' + saved.cacheVersion);
console.log('apple-touch-icon:', saved.icons['apple-touch-icon']);
console.log('icon-512:', saved.icons['icon-512']);
