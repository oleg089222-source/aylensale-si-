/**
 * Bundle node-qrcode for admin visit cards (browser IIFE → window.QRCode).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const entry = path.join(root, 'node_modules', 'qrcode', 'lib', 'browser.js');
const outFile = path.join(root, 'js', 'vendor', 'qrcode.browser.min.js');

if (!fs.existsSync(entry)) {
  console.error('bundle-qrcode: install qrcode first (npm install)');
  process.exit(1);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });

await esbuild.build({
  entryPoints: [entry],
  bundle: true,
  format: 'iife',
  globalName: 'QRCode',
  minify: true,
  outfile: outFile,
  logLevel: 'silent'
});

console.log('bundle-qrcode OK → js/vendor/qrcode.browser.min.js');
