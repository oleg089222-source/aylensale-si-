#!/usr/bin/env node
/**
 * Regenerate css/font-awesome-storefront.css from Font Awesome 6.5 all.min.css.
 * Usage: node scripts/build-fa-storefront-subset.js
 */
const fs = require('fs');
const https = require('https');
const path = require('path');

const FA_URL = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css';
const OUT = path.join(__dirname, '../css/font-awesome-storefront.css');

const SOLID_ICONS = [
  'bolt', 'store', 'ticket', 'shopping-cart', 'box', 'gavel', 'map-marker-alt', 'crown', 'box-open',
  'location-dot', 'mobile-screen-button', 'flag', 'calendar-check', 'warehouse', 'thumbs-up', 'signal',
  'cart-shopping', 'comment-dots', 'file-arrow-down', 'info-circle', 'check', 'clipboard-list', 'paper-plane',
  'eye', 'external-link-alt', 'truck-ramp-box', 'map-pin', 'city', 'envelope', 'calendar', 'note-sticky',
  'circle', 'map', 'chevron-left', 'chevron-right', 'fire', 'bell', 'cart-plus', 'expand', 'file-lines',
  'download', 'print', 'file-csv', 'hourglass-half', 'flag-checkered', 'history', 'trophy', 'scale-balanced',
  'arrow-up-right-from-square', 'spinner', 'images', 'hourglass-end', 'check-circle', 'list', 'search-plus',
  'cloud-sun'
];

const BRAND_ICONS = ['telegram', 'whatsapp'];

function fetchText(url) {
  return new Promise(function(resolve, reject) {
    https.get(url, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve(data); });
    }).on('error', reject);
  });
}

function contentFor(css, name) {
  var re = new RegExp('\\.fa-' + name + ':before[^{]*\\{content:"(\\\\[^"]+)"\\}');
  var m = css.match(re);
  return m ? m[1] : null;
}

function buildRules(css, names) {
  var rules = [];
  var missing = [];
  names.forEach(function(name) {
    var c = contentFor(css, name);
    if (!c) missing.push(name);
    else rules.push('.fa-' + name + ':before{content:"' + c + '"}');
  });
  return { rules: rules, missing: missing };
}

async function main() {
  var css = await fetchText(FA_URL);
  var header = [
    '/* Font Awesome 6.5 storefront subset — homepage (generated) */',
    '@font-face{font-family:"Font Awesome 6 Brands";font-style:normal;font-weight:400;font-display:swap;src:url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-brands-400.woff2") format("woff2")}',
    '@font-face{font-family:"Font Awesome 6 Free";font-style:normal;font-weight:900;font-display:swap;src:url("https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/webfonts/fa-solid-900.woff2") format("woff2")}',
    '.fa{font-family:var(--fa-style-family,"Font Awesome 6 Free");font-weight:var(--fa-style,900)}',
    '.fa,.fa-brands,.fa-classic,.fa-regular,.fa-sharp,.fa-solid,.fab,.far,.fas{-moz-osx-font-smoothing:grayscale;-webkit-font-smoothing:antialiased;display:var(--fa-display,inline-block);font-style:normal;font-variant:normal;line-height:1;text-rendering:auto}',
    '.fab,.fa-brands{font-family:"Font Awesome 6 Brands";font-weight:400}',
    '.fas,.fa-solid{font-family:"Font Awesome 6 Free";font-weight:900}',
    '.fa-spin{animation:fa-spin 2s infinite linear}',
    '@keyframes fa-spin{0%{transform:rotate(0deg)}to{transform:rotate(1turn)}}',
    ''
  ].join('\n');

  var solid = buildRules(css, SOLID_ICONS);
  var brand = buildRules(css, BRAND_ICONS);
  if (solid.missing.length) {
    console.error('Missing solid icons:', solid.missing.join(', '));
    process.exit(1);
  }
  if (brand.missing.length) {
    console.error('Missing brand icons:', brand.missing.join(', '));
    process.exit(1);
  }

  fs.writeFileSync(OUT, header + solid.rules.join('') + brand.rules.join('') + '\n');
  console.log('Wrote', OUT, '(' + (header + solid.rules.join('') + brand.rules.join('')).length + ' bytes)');
}

main().catch(function(err) {
  console.error(err);
  process.exit(1);
});
