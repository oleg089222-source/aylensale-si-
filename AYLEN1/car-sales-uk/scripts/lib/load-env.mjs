import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function parseEnvFile(filePath) {
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
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

export function loadProjectEnv() {
  const files = [
    join(root, '.env.local'),
    join(root, '.env.local.bak'),
    join(root, '.env'),
    join(root, '..', '..', '.env.local')
  ];
  for (const filePath of files) {
    if (!existsSync(filePath)) continue;
    parseEnvFile(filePath);
  }

  const pathKeys = ['FIREBASE_SERVICE_ACCOUNT_PATH', 'GOOGLE_APPLICATION_CREDENTIALS'];
  for (const key of pathKeys) {
    const filePath = process.env[key];
    if (!filePath || process.env.FIREBASE_SERVICE_ACCOUNT) continue;
    if (!existsSync(filePath)) continue;
    process.env.FIREBASE_SERVICE_ACCOUNT = readFileSync(filePath, 'utf8').trim();
  }
}

export const projectRoot = root;
